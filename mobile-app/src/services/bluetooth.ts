/**
 * Bluetooth Low Energy service for Coag-Sense PT2 device
 *
 * Best-guess implementation based on:
 * - Common BLE serial protocols (Nordic UART Service)
 * - POCT1-A protocol used by PT2 over TCP/WiFi
 *
 * The PT2 likely exposes a BLE serial service that speaks the same
 * POCT1-A XML protocol as the WiFi interface.
 */

import { BleManager, Device, State, Characteristic } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { DeviceInfo, INRReading } from '../types';

// Map BLE library state to our app state
export type BLEState = 'unknown' | 'resetting' | 'unsupported' | 'unauthorized' | 'poweredOff' | 'poweredOn';

const mapBleState = (state: State): BLEState => {
  switch (state) {
    case State.PoweredOn: return 'poweredOn';
    case State.PoweredOff: return 'poweredOff';
    case State.Unauthorized: return 'unauthorized';
    case State.Unsupported: return 'unsupported';
    case State.Resetting: return 'resetting';
    default: return 'unknown';
  }
};

// Coag-Sense PT2 specific UUIDs (discovered from device)
const PT2_DATA_SERVICE = '194f9cb0-364b-4a00-84a1-5e30b969ba23';
const PT2_RX_CHAR = '194f9cb1-364b-4a00-84a1-5e30b969ba23'; // Notify - data FROM device
const PT2_TX_CHAR = '194f9cb2-364b-4a00-84a1-5e30b969ba23'; // Write + Notify - commands TO device

// Standard BLE services for device info
const DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';

// Device name patterns to look for
const DEVICE_NAME_PATTERNS = ['Coag', 'PT2', 'PT-2', 'CoagSense', 'Coag-Sense', 'INR'];

// POCT1-A message types
const MESSAGE_TYPES = {
  HELLO: 'HEL.R01',
  DEVICE_STATUS: 'DST.R01',
  OBSERVATIONS: 'OBS.R01',
  END_OF_TOPIC: 'EOT.R01',
  ACK: 'ACK.R01',
  REQUEST: 'REQ.R01',
  ESCAPE: 'ESC.R01',
};

export interface SyncProgress {
  status: 'connecting' | 'connected' | 'requesting' | 'downloading' | 'complete' | 'error';
  message: string;
  received?: number;
  total?: number;
}

class BluetoothService {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private rxCharacteristic: Characteristic | null = null;
  private txCharacteristic: Characteristic | null = null;
  private dataBuffer: string = '';
  private controlId: number = 20000;

  constructor() {
    this.manager = new BleManager();
  }

  // Get current Bluetooth state
  async getState(): Promise<BLEState> {
    const state = await this.manager.state();
    return mapBleState(state);
  }

  // Subscribe to Bluetooth state changes
  onStateChange(callback: (state: BLEState) => void): () => void {
    const subscription = this.manager.onStateChange((state) => {
      callback(mapBleState(state));
    }, true);
    return () => subscription.remove();
  }

  // Scan for PT2 devices
  async scanForDevices(
    onDeviceFound: (device: DeviceInfo) => void,
    timeoutMs: number = 15000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const foundDevices = new Set<string>();

      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        resolve();
      }, timeoutMs);

      this.manager.startDeviceScan(
        null, // Scan for all services
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            clearTimeout(timeout);
            this.manager.stopDeviceScan();
            reject(error);
            return;
          }

          if (device && device.name && !foundDevices.has(device.id)) {
            // Check if device name matches our patterns
            const nameMatches = DEVICE_NAME_PATTERNS.some(pattern =>
              device.name?.toLowerCase().includes(pattern.toLowerCase())
            );

            if (nameMatches) {
              foundDevices.add(device.id);
              onDeviceFound({
                id: device.id,
                name: device.name,
                isConnected: false,
              });
            }
          }
        }
      );
    });
  }

  // Stop scanning
  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  // Connect to a device and discover services
  async connect(deviceId: string): Promise<DeviceInfo> {
    // Connect to the device
    const device = await this.manager.connectToDevice(deviceId, {
      requestMTU: 512, // Request larger MTU for faster data transfer
    });

    // Discover all services and characteristics
    await device.discoverAllServicesAndCharacteristics();

    // Find the PT2 data service
    const services = await device.services();
    let foundService = false;

    for (const service of services) {
      const serviceUuid = service.uuid.toLowerCase();

      // Look for PT2's custom data service
      if (serviceUuid === PT2_DATA_SERVICE.toLowerCase()) {
        const characteristics = await service.characteristics();

        for (const char of characteristics) {
          const charUuid = char.uuid.toLowerCase();

          // RX characteristic - notifications from device
          if (charUuid === PT2_RX_CHAR.toLowerCase()) {
            this.rxCharacteristic = char;
            console.log('Found RX characteristic:', char.uuid);
          }

          // TX characteristic - write commands to device
          if (charUuid === PT2_TX_CHAR.toLowerCase()) {
            this.txCharacteristic = char;
            console.log('Found TX characteristic:', char.uuid);
          }
        }

        if (this.rxCharacteristic || this.txCharacteristic) {
          foundService = true;
          console.log('Found PT2 data service:', service.uuid);
          break;
        }
      }
    }

    if (!foundService) {
      // Log all services for debugging
      console.log('Available services:');
      for (const service of services) {
        console.log('  Service:', service.uuid);
        const chars = await service.characteristics();
        for (const char of chars) {
          console.log('    Char:', char.uuid, {
            read: char.isReadable,
            write: char.isWritableWithResponse || char.isWritableWithoutResponse,
            notify: char.isNotifiable,
          });
        }
      }
      throw new Error('Could not find PT2 data service. Check console for available services.');
    }

    this.connectedDevice = device;

    // Set up disconnect listener
    device.onDisconnected(() => {
      console.log('Device disconnected');
      this.connectedDevice = null;
      this.rxCharacteristic = null;
      this.txCharacteristic = null;
    });

    return {
      id: device.id,
      name: device.name || 'Unknown',
      isConnected: true,
    };
  }

  // Disconnect from current device
  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      await this.connectedDevice.cancelConnection();
      this.connectedDevice = null;
      this.rxCharacteristic = null;
      this.txCharacteristic = null;
    }
  }

  // Sync data from device using POCT1-A protocol
  async syncData(onProgress: (progress: SyncProgress) => void): Promise<INRReading[]> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    const readings: INRReading[] = [];
    let totalAvailable = 0;
    this.dataBuffer = '';

    return new Promise(async (resolve, reject) => {
      try {
        const handleData = (charName: string) => (error: any, char: any) => {
          if (error) {
            console.error(`${charName} notification error:`, error);
            return;
          }

          if (char?.value) {
            // Decode base64 data from BLE
            const data = Buffer.from(char.value, 'base64').toString('utf8');
            console.log(`${charName} received (${data.length} chars):`, data.substring(0, 100));
            this.dataBuffer += data;

            // Process complete messages
            this.processMessages(
              readings,
              (total) => {
                totalAvailable = total;
                onProgress({
                  status: 'downloading',
                  message: `${total} readings available`,
                  total,
                });
              },
              (received) => {
                onProgress({
                  status: 'downloading',
                  message: `Downloaded ${received} of ${totalAvailable}`,
                  received,
                  total: totalAvailable,
                });
              }
            );
          }
        };

        // Subscribe to RX characteristic (primary data channel)
        if (this.rxCharacteristic?.isNotifiable) {
          console.log('Subscribing to RX notifications...');
          await this.rxCharacteristic.monitor(handleData('RX'));
        }

        // Also subscribe to TX characteristic if it supports notifications
        if (this.txCharacteristic?.isNotifiable) {
          console.log('Subscribing to TX notifications...');
          await this.txCharacteristic.monitor(handleData('TX'));
        }

        onProgress({ status: 'connected', message: 'Waiting for device data...' });

        // Try reading characteristics directly
        if (this.rxCharacteristic?.isReadable) {
          console.log('Trying to read RX characteristic...');
          const value = await this.rxCharacteristic.read();
          if (value?.value) {
            const data = Buffer.from(value.value, 'base64');
            console.log('RX read (raw bytes):', Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' '));
            console.log('RX read (as string):', data.toString('utf8'));
          }
        }

        // Wait a bit to see if device sends data automatically
        await new Promise(r => setTimeout(r, 3000));

        // Try different commands to trigger data transfer
        if (readings.length === 0) {
          onProgress({ status: 'requesting', message: 'Requesting data...' });

          // Try simple commands that might trigger response
          console.log('Trying simple commands...');

          // Try sending a simple byte command (some devices use 0x01 to request data)
          await this.sendRawBytes([0x01]);
          await new Promise(r => setTimeout(r, 2000));

          // Try "R" for read
          await this.sendRawBytes([0x52]); // 'R'
          await new Promise(r => setTimeout(r, 2000));

          // Try POCT1-A request
          console.log('Sending ROBS request...');
          await this.sendRequestObservations();
        }

        // Wait for data
        await new Promise(r => setTimeout(r, 15000));

        console.log('Sync complete. Buffer contents:', this.dataBuffer.substring(0, 500));
        console.log('Total readings parsed:', readings.length);

        onProgress({
          status: 'complete',
          message: readings.length > 0
            ? `Downloaded ${readings.length} readings`
            : 'No new readings available',
          received: readings.length,
          total: totalAvailable || readings.length,
        });

        resolve(readings);
      } catch (error) {
        console.error('Sync error:', error);
        reject(error);
      }
    });
  }

  // Process incoming POCT1-A messages
  private processMessages(
    readings: INRReading[],
    onStatusReport: (total: number) => void,
    onProgress: (received: number) => void
  ): void {
    // Process HEL.R01 (Hello)
    if (this.dataBuffer.includes('</HEL.R01>')) {
      const endIdx = this.dataBuffer.indexOf('</HEL.R01>') + 10;
      const message = this.dataBuffer.substring(0, endIdx);
      this.dataBuffer = this.dataBuffer.substring(endIdx);

      console.log('Received HEL.R01 (Hello)');
      this.sendAck(true);
    }

    // Process DST.R01 (Device Status)
    if (this.dataBuffer.includes('</DST.R01>')) {
      const endIdx = this.dataBuffer.indexOf('</DST.R01>') + 10;
      const message = this.dataBuffer.substring(0, endIdx);
      this.dataBuffer = this.dataBuffer.substring(endIdx);

      console.log('Received DST.R01 (Device Status)');

      const countMatch = message.match(/new_observations_qty V="(\d+)"/);
      const total = countMatch ? parseInt(countMatch[1]) : 0;
      onStatusReport(total);

      this.sendAck(true);
    }

    // Process OBS.R01 (Observations)
    if (this.dataBuffer.includes('</OBS.R01>')) {
      const endIdx = this.dataBuffer.indexOf('</OBS.R01>') + 10;
      const message = this.dataBuffer.substring(0, endIdx);
      this.dataBuffer = this.dataBuffer.substring(endIdx);

      console.log('Received OBS.R01 (Observations)');

      const parsed = this.parseObservationsXml(message);
      readings.push(...parsed);
      onProgress(readings.length);

      // Send AR (reject) to keep data on device
      this.sendAck(false);
    }

    // Process EOT.R01 (End of Topic)
    if (this.dataBuffer.includes('</EOT.R01>')) {
      const endIdx = this.dataBuffer.indexOf('</EOT.R01>') + 10;
      this.dataBuffer = this.dataBuffer.substring(endIdx);

      console.log('Received EOT.R01 (End of Topic)');
      this.sendAck(true);
    }
  }

  // Parse POCT1-A observations XML
  private parseObservationsXml(xml: string): INRReading[] {
    const observations: INRReading[] = [];
    const svcPattern = /<SVC>([\s\S]*?)<\/SVC>/g;
    let match;

    while ((match = svcPattern.exec(xml)) !== null) {
      const svc = match[1];
      const reading: Partial<INRReading> = {
        id: `reading_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'NRM',
      };

      // Timestamp
      const dttmMatch = svc.match(/<SVC\.observation_dttm V="([^"]+)"/);
      if (dttmMatch) reading.timestamp = dttmMatch[1];

      // Status
      const statusMatch = svc.match(/<SVC\.status_cd V="([^"]+)"/);
      if (statusMatch) {
        const status = statusMatch[1].toUpperCase();
        if (status === 'NRM' || status === 'HI' || status === 'LO' || status === 'ERR') {
          reading.status = status;
        }
      }

      // INR value (LOINC 34714-6)
      const inrMatch = svc.match(/<OBS\.observation_id V="34714-6"[^/]*\/>\s*<OBS\.value V="([^"]+)"/);
      if (inrMatch) {
        const val = parseFloat(inrMatch[1]);
        if (!isNaN(val)) reading.inr = val;
      }

      // PT seconds (LOINC 5902-2)
      const ptMatch = svc.match(/<OBS\.observation_id V="5902-2"[^/]*\/>\s*<OBS\.value V="([^"]+)"/);
      if (ptMatch) {
        const val = parseFloat(ptMatch[1]);
        if (!isNaN(val)) reading.pt_seconds = val;
      }

      // Only include valid observations
      if (reading.timestamp && reading.inr && reading.inr > 0 && reading.pt_seconds && reading.pt_seconds > 0) {
        observations.push(reading as INRReading);
      }
    }

    return observations;
  }

  // Send ACK response
  private async sendAck(accept: boolean): Promise<void> {
    const ackCode = accept ? 'AA' : 'AR';
    const message = `<ACK.R01>
   <HDR>
       <HDR.control_id V="${++this.controlId}"/>
       <HDR.version_id V="POCT1"/>
       <HDR.creation_dttm V="${this.getTimestamp()}"/>
   </HDR>
   <ACK>
       <ACK.type_cd V="${ackCode}"/>
   </ACK>
</ACK.R01>
`;
    await this.sendData(message);
  }

  // Send request for observations
  private async sendRequestObservations(): Promise<void> {
    const message = `<REQ.R01>
   <HDR>
       <HDR.control_id V="${++this.controlId}"/>
       <HDR.version_id V="POCT1"/>
       <HDR.creation_dttm V="${this.getTimestamp()}"/>
   </HDR>
   <REQ>
       <REQ.request_cd V="ROBS"/>
   </REQ>
</REQ.R01>
`;
    await this.sendData(message);
  }

  // Send data to device (string)
  private async sendData(data: string): Promise<void> {
    if (!this.txCharacteristic) {
      console.warn('No TX characteristic available');
      return;
    }

    try {
      const encoded = Buffer.from(data, 'utf8').toString('base64');

      if (this.txCharacteristic.isWritableWithResponse) {
        await this.txCharacteristic.writeWithResponse(encoded);
      } else if (this.txCharacteristic.isWritableWithoutResponse) {
        await this.txCharacteristic.writeWithoutResponse(encoded);
      }
    } catch (error) {
      console.error('Failed to send data:', error);
    }
  }

  // Send raw bytes to device
  private async sendRawBytes(bytes: number[]): Promise<void> {
    if (!this.txCharacteristic) {
      console.warn('No TX characteristic available');
      return;
    }

    try {
      const encoded = Buffer.from(bytes).toString('base64');
      console.log('Sending raw bytes:', bytes.map(b => '0x' + b.toString(16)).join(' '));

      if (this.txCharacteristic.isWritableWithResponse) {
        await this.txCharacteristic.writeWithResponse(encoded);
      } else if (this.txCharacteristic.isWritableWithoutResponse) {
        await this.txCharacteristic.writeWithoutResponse(encoded);
      }
    } catch (error) {
      console.error('Failed to send raw bytes:', error);
    }
  }

  // Get ISO timestamp
  private getTimestamp(): string {
    return new Date().toISOString().replace('Z', '-00:00');
  }

  // Check if device is connected
  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  // Get connected device info
  getConnectedDevice(): DeviceInfo | null {
    if (!this.connectedDevice) return null;

    return {
      id: this.connectedDevice.id,
      name: this.connectedDevice.name || 'Unknown',
      isConnected: true,
    };
  }

  // Cleanup
  destroy(): void {
    this.manager.destroy();
  }
}

// Singleton instance
export const bluetoothService = new BluetoothService();
export default bluetoothService;
