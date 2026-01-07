#!/usr/bin/env python3
"""
Coag-Sense PT2 Web Application

Full-stack application with:
- POCT1-A device communication
- Real-time WebSocket updates
- Beautiful web UI for viewing INR/PT data
"""

import asyncio
import socket
import datetime
import os
import json
import re
import threading
from pathlib import Path
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# Configuration
DEVICE_PORT = 5050
WEB_PORT = 8000
DATA_FILE = "inr_results.json"
CAPTURES_DIR = Path("captures")
CAPTURES_DIR.mkdir(exist_ok=True)

# Global state
class AppState:
    def __init__(self):
        self.device_connected = False
        self.transfer_in_progress = False
        self.observations_received = 0
        self.device_info = {}
        self.websocket_clients: List[WebSocket] = []
        self.server_running = False
        self.local_ip = self._get_local_ip()

    def _get_local_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"

state = AppState()

# WebSocket broadcast
async def broadcast(message: dict):
    """Send message to all connected WebSocket clients."""
    for client in state.websocket_clients[:]:
        try:
            await client.send_json(message)
        except:
            state.websocket_clients.remove(client)

def sync_broadcast(message: dict):
    """Synchronous wrapper for broadcast."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    # We'll use a queue instead for thread safety
    pass

# POCT1-A Protocol Implementation
class POCT1AHandler:
    def __init__(self):
        self.control_id = 20000

    def timestamp(self):
        return datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S-05:00")

    def next_control_id(self):
        self.control_id += 1
        return str(self.control_id)

    def create_ack(self):
        return f"""<ACK.R01>
   <HDR>
       <HDR.control_id V="{self.next_control_id()}"/>
       <HDR.version_id V="POCT1"/>
       <HDR.creation_dttm V="{self.timestamp()}"/>
   </HDR>
   <ACK>
       <ACK.type_cd V="AA"/>
   </ACK>
</ACK.R01>
"""

    def create_request_observations(self):
        return f"""<REQ.R01>
   <HDR>
       <HDR.control_id V="{self.next_control_id()}"/>
       <HDR.version_id V="POCT1"/>
       <HDR.creation_dttm V="{self.timestamp()}"/>
   </HDR>
   <REQ>
       <REQ.request_cd V="ROBS"/>
   </REQ>
</REQ.R01>
"""

# Message queue for thread-safe WebSocket updates
message_queue = asyncio.Queue()

async def process_message_queue():
    """Process messages from device thread and broadcast to WebSocket clients."""
    while True:
        try:
            message = await asyncio.wait_for(message_queue.get(), timeout=0.1)
            await broadcast(message)
        except asyncio.TimeoutError:
            await asyncio.sleep(0.05)
        except Exception as e:
            print(f"Queue error: {e}")

def queue_message(message: dict):
    """Thread-safe way to queue a message for WebSocket broadcast."""
    try:
        asyncio.get_event_loop().call_soon_threadsafe(
            lambda: message_queue.put_nowait(message)
        )
    except:
        pass

# Device server thread
def run_device_server(loop):
    """Run POCT1-A server in a separate thread."""
    handler = POCT1AHandler()
    state.server_running = True

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.settimeout(1.0)
        s.bind(('0.0.0.0', DEVICE_PORT))
        s.listen(1)

        print(f"📡 Device server listening on port {DEVICE_PORT}")

        while state.server_running:
            try:
                conn, addr = s.accept()
                handle_device_connection(conn, addr, handler, loop)
            except socket.timeout:
                continue
            except Exception as e:
                print(f"Server error: {e}")

def handle_device_connection(conn, addr, handler, loop):
    """Handle a device connection."""
    state.device_connected = True
    state.transfer_in_progress = True
    state.observations_received = 0

    asyncio.run_coroutine_threadsafe(
        broadcast({"type": "status", "status": "connected", "ip": addr[0]}),
        loop
    )

    with conn:
        conn.settimeout(120.0)
        sent_request = False
        total_available = 0

        try:
            while True:
                data = conn.recv(8192)
                if not data:
                    break

                text = data.decode('utf-8', errors='replace')

                # HEL.R01 (Device Hello)
                if '<HEL.R01>' in text:
                    serial_match = re.search(r'DEV\.serial_id V="([^"]+)"', text)
                    model_match = re.search(r'DEV\.model_id V="([^"]+)"', text)
                    state.device_info = {
                        'serial': serial_match.group(1) if serial_match else 'Unknown',
                        'model': model_match.group(1) if model_match else 'Coag-Sense PT/INR'
                    }
                    asyncio.run_coroutine_threadsafe(
                        broadcast({"type": "hello", "device": state.device_info}),
                        loop
                    )
                    conn.sendall(handler.create_ack().encode('utf-8'))

                # DST.R01 (Device Status)
                elif '<DST.R01>' in text:
                    count_match = re.search(r'new_observations_qty V="(\d+)"', text)
                    total_available = int(count_match.group(1)) if count_match else 0
                    asyncio.run_coroutine_threadsafe(
                        broadcast({"type": "status_report", "total": total_available}),
                        loop
                    )
                    conn.sendall(handler.create_ack().encode('utf-8'))

                    if not sent_request:
                        asyncio.run_coroutine_threadsafe(
                            broadcast({"type": "requesting"}),
                            loop
                        )
                        conn.sendall(handler.create_request_observations().encode('utf-8'))
                        sent_request = True

                # OBS.R01 (Observations)
                elif '<OBS.R01>' in text or ('<OBS' in text and '<SVC' in text):
                    svc_count = text.count('<SVC>')
                    state.observations_received += svc_count

                    # Save raw data
                    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
                    filename = CAPTURES_DIR / f"OBS_DATA_{ts}.xml"
                    with open(filename, 'w') as f:
                        f.write(text)

                    asyncio.run_coroutine_threadsafe(
                        broadcast({
                            "type": "progress",
                            "received": state.observations_received,
                            "total": total_available
                        }),
                        loop
                    )
                    conn.sendall(handler.create_ack().encode('utf-8'))

                # EOT.R01 (End of Topic)
                elif '<EOT.R01>' in text:
                    conn.sendall(handler.create_ack().encode('utf-8'))

                # Errors
                elif '<ESC.R01>' in text or '<ERR' in text:
                    asyncio.run_coroutine_threadsafe(
                        broadcast({"type": "error", "message": text[:200]}),
                        loop
                    )

        except socket.timeout:
            pass
        except Exception as e:
            print(f"Connection error: {e}")

    # Transfer complete
    state.device_connected = False
    state.transfer_in_progress = False

    # Parse results
    results = parse_all_observations()

    asyncio.run_coroutine_threadsafe(
        broadcast({
            "type": "complete",
            "observations": state.observations_received,
            "results": results
        }),
        loop
    )

def parse_obs_file(filepath):
    """Parse a single OBS XML file."""
    with open(filepath, 'r') as f:
        content = f.read()

    observations = []
    svc_pattern = r'<SVC>(.*?)</SVC>'
    svc_matches = re.findall(svc_pattern, content, re.DOTALL)

    for svc in svc_matches:
        obs = {}

        dttm_match = re.search(r'<SVC\.observation_dttm V="([^"]+)"', svc)
        if dttm_match:
            obs['timestamp'] = dttm_match.group(1)

        seq_match = re.search(r'<SVC\.sequence_nbr V="(\d+)"', svc)
        if seq_match:
            obs['sequence'] = int(seq_match.group(1))

        status_match = re.search(r'<SVC\.status_cd V="([^"]+)"', svc)
        if status_match:
            obs['status'] = status_match.group(1)

        patient_match = re.search(r'<PT\.patient_id V="([^"]+)"', svc)
        if patient_match:
            obs['patient_id'] = patient_match.group(1)

        inr_match = re.search(r'<OBS\.observation_id V="34714-6"[^/]*/>\s*<OBS\.value V="([^"]+)"', svc)
        if inr_match:
            try:
                obs['inr'] = float(inr_match.group(1))
            except ValueError:
                obs['inr'] = None

        pt_match = re.search(r'<OBS\.observation_id V="5902-2"[^/]*/>\s*<OBS\.value V="([^"]+)"', svc)
        if pt_match:
            try:
                obs['pt_seconds'] = float(pt_match.group(1))
            except ValueError:
                obs['pt_seconds'] = None

        lot_match = re.search(r'<RGT\.lot_number V="([^"]+)"', svc)
        if lot_match:
            obs['reagent_lot'] = lot_match.group(1)

        note_match = re.search(r'<NTE\.text V="([^"]+)"', svc)
        if note_match:
            obs['notes'] = note_match.group(1)

        if obs.get('timestamp'):
            observations.append(obs)

    return observations

def parse_all_observations():
    """Parse all captured observations into a results object."""
    all_observations = []

    for filepath in sorted(CAPTURES_DIR.glob('OBS_DATA*.xml')):
        obs_list = parse_obs_file(filepath)
        all_observations.extend(obs_list)

    # Remove duplicates
    seen_sequences = set()
    unique_observations = []
    for obs in all_observations:
        seq = obs.get('sequence')
        if seq and seq not in seen_sequences:
            seen_sequences.add(seq)
            unique_observations.append(obs)
        elif not seq:
            unique_observations.append(obs)

    # Sort by timestamp
    unique_observations.sort(key=lambda x: x.get('timestamp', ''))

    # Filter invalid readings
    valid_observations = [
        obs for obs in unique_observations
        if obs.get('inr') and obs.get('inr') > 0 and obs.get('pt_seconds') and obs.get('pt_seconds') > 0
    ]

    results = {
        'device': state.device_info,
        'export_date': datetime.datetime.now().isoformat(),
        'total_readings': len(valid_observations),
        'readings': valid_observations
    }

    # Save to file
    with open(DATA_FILE, 'w') as f:
        json.dump(results, f, indent=2)

    return results

# FastAPI App
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start device server in background thread
    loop = asyncio.get_event_loop()
    server_thread = threading.Thread(target=run_device_server, args=(loop,), daemon=True)
    server_thread.start()

    # Start message queue processor
    asyncio.create_task(process_message_queue())

    yield

    # Shutdown
    state.server_running = False

app = FastAPI(lifespan=lifespan)

@app.get("/")
async def index():
    return FileResponse("static/index.html")

@app.get("/api/status")
async def get_status():
    return {
        "server_ip": state.local_ip,
        "device_port": DEVICE_PORT,
        "device_connected": state.device_connected,
        "transfer_in_progress": state.transfer_in_progress,
        "observations_received": state.observations_received
    }

@app.get("/api/results")
async def get_results():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {"readings": [], "total_readings": 0}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state.websocket_clients.append(websocket)

    # Send initial status
    await websocket.send_json({
        "type": "init",
        "server_ip": state.local_ip,
        "device_port": DEVICE_PORT,
        "has_data": os.path.exists(DATA_FILE)
    })

    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        state.websocket_clients.remove(websocket)

# Create static directory
Path("static").mkdir(exist_ok=True)

if __name__ == "__main__":
    import uvicorn
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║           Coag-Sense PT2 Data Extractor                      ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║   Web Interface: http://localhost:{WEB_PORT:<26}║
║   Device Port:   {DEVICE_PORT:<42}║
║   Your IP:       {state.local_ip:<42}║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
""")
    uvicorn.run(app, host="0.0.0.0", port=WEB_PORT, log_level="warning")
