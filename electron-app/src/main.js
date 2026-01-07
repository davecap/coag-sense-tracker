/**
 * Coag-Sense Tracker - Electron Main Process
 *
 * Handles:
 * - Window management
 * - TCP server for device communication
 * - POCT1-A protocol
 * - Data persistence
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');

// ============================================================
// Configuration
// ============================================================

const DEVICE_PORT = 5050;
const DATA_FILE = path.join(app.getPath('userData'), 'inr_results.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

// ============================================================
// State
// ============================================================

let mainWindow = null;
let tcpServer = null;

const state = {
    serverRunning: false,
    deviceConnected: false,
    transferInProgress: false,
    observationsReceived: 0,
    deviceInfo: {},
    localIp: getLocalIp()
};

// ============================================================
// Window Management
// ============================================================

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'Coag-Sense Tracker',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        backgroundColor: '#0a0f1a'
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
    startTcpServer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    stopTcpServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ============================================================
// Network Utilities
// ============================================================

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

// ============================================================
// TCP Server
// ============================================================

function startTcpServer() {
    if (tcpServer) return;

    tcpServer = net.createServer((socket) => {
        handleConnection(socket);
    });

    tcpServer.on('error', (err) => {
        console.error('TCP Server error:', err);
        sendToRenderer('server-error', { message: err.message });
    });

    tcpServer.listen(DEVICE_PORT, '0.0.0.0', () => {
        state.serverRunning = true;
        state.localIp = getLocalIp();
        console.log(`TCP server listening on ${state.localIp}:${DEVICE_PORT}`);
        sendToRenderer('server-started', {
            ip: state.localIp,
            port: DEVICE_PORT
        });
    });
}

function stopTcpServer() {
    if (tcpServer) {
        tcpServer.close();
        tcpServer = null;
        state.serverRunning = false;
    }
}

// ============================================================
// Connection Handler
// ============================================================

function handleConnection(socket) {
    console.log('Device connected from:', socket.remoteAddress);

    state.deviceConnected = true;
    state.transferInProgress = true;
    state.observationsReceived = 0;

    sendToRenderer('device-connected', { ip: socket.remoteAddress });

    let buffer = '';
    let controlId = 20000;
    let totalAvailable = 0;
    let sentRequest = false;
    const rawObservations = [];

    // Get settings for accept/reject mode
    const settings = loadSettings();
    const acceptObservations = settings.acceptObservations === true;

    socket.on('data', (data) => {
        buffer += data.toString('utf8');

        // Process complete messages
        processMessages();
    });

    socket.on('close', () => {
        console.log('Device disconnected');
        state.deviceConnected = false;
        state.transferInProgress = false;

        // Process and save all observations
        finalizeTransfer(rawObservations);
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err);
    });

    function processMessages() {
        // HEL.R01 (Hello)
        if (buffer.includes('</HEL.R01>')) {
            const endIdx = buffer.indexOf('</HEL.R01>') + 10;
            const message = buffer.substring(0, endIdx);
            buffer = buffer.substring(endIdx);

            console.log('Received HEL.R01 (Hello)');

            // Extract device info
            const serialMatch = message.match(/DEV\.serial_id V="([^"]+)"/);
            const modelMatch = message.match(/DEV\.model_id V="([^"]+)"/);

            state.deviceInfo = {
                serial: serialMatch ? serialMatch[1] : 'Unknown',
                model: modelMatch ? modelMatch[1] : 'Coag-Sense PT/INR'
            };

            sendToRenderer('device-info', { device: state.deviceInfo });
            sendAck(true);
        }

        // DST.R01 (Device Status)
        if (buffer.includes('</DST.R01>')) {
            const endIdx = buffer.indexOf('</DST.R01>') + 10;
            const message = buffer.substring(0, endIdx);
            buffer = buffer.substring(endIdx);

            console.log('Received DST.R01 (Device Status)');

            const countMatch = message.match(/new_observations_qty V="(\d+)"/);
            totalAvailable = countMatch ? parseInt(countMatch[1]) : 0;

            sendToRenderer('status-report', { total: totalAvailable });
            sendAck(true);

            // Request observations
            if (!sentRequest) {
                sentRequest = true;
                sendToRenderer('requesting', {});
                sendRequestObservations();
            }
        }

        // OBS.R01 (Observations)
        if (buffer.includes('</OBS.R01>')) {
            const endIdx = buffer.indexOf('</OBS.R01>') + 10;
            const message = buffer.substring(0, endIdx);
            buffer = buffer.substring(endIdx);

            const svcCount = (message.match(/<SVC>/g) || []).length;
            state.observationsReceived += svcCount;

            console.log(`Received OBS.R01 with ${svcCount} observations (total: ${state.observationsReceived})`);

            rawObservations.push(message);

            sendToRenderer('progress', {
                received: state.observationsReceived,
                total: totalAvailable
            });

            // Send ACK (accept or reject based on settings)
            sendAck(acceptObservations);
        }

        // EOT.R01 (End of Topic)
        if (buffer.includes('</EOT.R01>')) {
            const endIdx = buffer.indexOf('</EOT.R01>') + 10;
            buffer = buffer.substring(endIdx);

            console.log('Received EOT.R01 (End of Topic)');
            sendAck(true);
        }

        // ESC.R01 (Escape) or ERR (Error)
        if (buffer.includes('</ESC.R01>') || buffer.includes('<ERR')) {
            console.log('Received escape or error');
            sendToRenderer('error', { message: 'Device sent escape/error signal' });
        }
    }

    function getTimestamp() {
        return new Date().toISOString().replace('Z', '-05:00');
    }

    function nextControlId() {
        return (++controlId).toString();
    }

    function sendAck(accept) {
        const ackCode = accept ? 'AA' : 'AR';
        const message = `<ACK.R01>
   <HDR>
       <HDR.control_id V="${nextControlId()}"/>
       <HDR.version_id V="POCT1"/>
       <HDR.creation_dttm V="${getTimestamp()}"/>
   </HDR>
   <ACK>
       <ACK.type_cd V="${ackCode}"/>
   </ACK>
</ACK.R01>
`;
        socket.write(message);
    }

    function sendRequestObservations() {
        const message = `<REQ.R01>
   <HDR>
       <HDR.control_id V="${nextControlId()}"/>
       <HDR.version_id V="POCT1"/>
       <HDR.creation_dttm V="${getTimestamp()}"/>
   </HDR>
   <REQ>
       <REQ.request_cd V="ROBS"/>
   </REQ>
</REQ.R01>
`;
        socket.write(message);
    }
}

// ============================================================
// Data Processing
// ============================================================

function parseObservationsXml(xml) {
    const observations = [];
    const svcPattern = /<SVC>([\s\S]*?)<\/SVC>/g;
    let match;

    while ((match = svcPattern.exec(xml)) !== null) {
        const svc = match[1];
        const obs = {};

        // Timestamp
        const dttmMatch = svc.match(/<SVC\.observation_dttm V="([^"]+)"/);
        if (dttmMatch) obs.timestamp = dttmMatch[1];

        // Sequence number
        const seqMatch = svc.match(/<SVC\.sequence_nbr V="(\d+)"/);
        if (seqMatch) obs.sequence = parseInt(seqMatch[1]);

        // Status
        const statusMatch = svc.match(/<SVC\.status_cd V="([^"]+)"/);
        if (statusMatch) obs.status = statusMatch[1];

        // INR value (LOINC 34714-6)
        const inrMatch = svc.match(/<OBS\.observation_id V="34714-6"[^/]*\/>\s*<OBS\.value V="([^"]+)"/);
        if (inrMatch) {
            const val = parseFloat(inrMatch[1]);
            if (!isNaN(val)) obs.inr = val;
        }

        // PT seconds (LOINC 5902-2)
        const ptMatch = svc.match(/<OBS\.observation_id V="5902-2"[^/]*\/>\s*<OBS\.value V="([^"]+)"/);
        if (ptMatch) {
            const val = parseFloat(ptMatch[1]);
            if (!isNaN(val)) obs.pt_seconds = val;
        }

        // Only include valid observations
        if (obs.timestamp && obs.inr && obs.inr > 0 && obs.pt_seconds && obs.pt_seconds > 0) {
            observations.push(obs);
        }
    }

    return observations;
}

function finalizeTransfer(rawObservations) {
    console.log('Transfer complete, parsing observations...');

    const newReadings = [];
    for (const xml of rawObservations) {
        const parsed = parseObservationsXml(xml);
        newReadings.push(...parsed);
    }

    // Load existing data
    const existingData = loadData();
    const existingReadings = existingData.readings || [];

    // Use timestamps for deduplication (more reliable than sequence numbers)
    const existingTimestamps = new Set(existingReadings.map(r => r.timestamp).filter(Boolean));

    // Filter out duplicates by timestamp
    const uniqueNew = newReadings.filter(r => !existingTimestamps.has(r.timestamp));

    // Merge
    const allReadings = [...existingReadings, ...uniqueNew];

    // Sort by timestamp
    allReadings.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Renumber sequences
    allReadings.forEach((r, i) => r.sequence = i + 1);

    // Save
    const data = {
        device: state.deviceInfo,
        lastSync: new Date().toISOString(),
        totalReadings: allReadings.length,
        readings: allReadings
    };

    saveData(data);

    console.log(`Saved ${allReadings.length} total readings (${uniqueNew.length} new)`);

    sendToRenderer('transfer-complete', {
        newReadings: uniqueNew.length,
        totalReadings: allReadings.length,
        readings: allReadings
    });
}

// ============================================================
// Data Persistence
// ============================================================

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const content = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(content);
        }
    } catch (err) {
        console.error('Error loading data:', err);
    }
    return { readings: [] };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error saving data:', err);
    }
}

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
            return JSON.parse(content);
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }
    return {};
}

function saveSettings(settings) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (err) {
        console.error('Error saving settings:', err);
    }
}

// ============================================================
// IPC Handlers
// ============================================================

function sendToRenderer(channel, data) {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send(channel, data);
    }
}

// Get server status
ipcMain.handle('get-status', () => {
    return {
        serverRunning: state.serverRunning,
        localIp: state.localIp,
        port: DEVICE_PORT,
        deviceConnected: state.deviceConnected,
        transferInProgress: state.transferInProgress,
        observationsReceived: state.observationsReceived,
        deviceInfo: state.deviceInfo
    };
});

// Get all readings
ipcMain.handle('get-readings', () => {
    return loadData();
});

// Save settings
ipcMain.handle('save-settings', (event, settings) => {
    const current = loadSettings();
    const merged = { ...current, ...settings };
    saveSettings(merged);
    return { success: true };
});

// Get settings
ipcMain.handle('get-settings', () => {
    return loadSettings();
});

// Clear all data
ipcMain.handle('clear-data', async () => {
    const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Cancel', 'Delete All Data'],
        defaultId: 0,
        cancelId: 0,
        title: 'Clear All Data',
        message: 'Are you sure you want to delete all INR/PT data?',
        detail: 'This action cannot be undone. If your device has marked this data as sent, you may not be able to re-download it.'
    });

    if (result.response === 1) {
        saveData({ readings: [] });
        return { success: true, cleared: true };
    }
    return { success: true, cleared: false };
});

// Export data to file
ipcMain.handle('export-data', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export INR Data',
        defaultPath: `inr_results_${new Date().toISOString().split('T')[0]}.json`,
        filters: [
            { name: 'JSON', extensions: ['json'] }
        ]
    });

    if (!result.canceled && result.filePath) {
        const data = loadData();
        fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
        return { success: true, path: result.filePath };
    }
    return { success: false };
});

// Import data from file
ipcMain.handle('import-data', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import INR Data',
        filters: [
            { name: 'JSON', extensions: ['json'] }
        ],
        properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        try {
            const content = fs.readFileSync(result.filePaths[0], 'utf8');
            const data = JSON.parse(content);

            if (data.readings && Array.isArray(data.readings)) {
                saveData(data);
                return { success: true, readings: data.readings.length };
            }
            return { success: false, error: 'Invalid data format' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
    return { success: false };
});

// Get app version
ipcMain.handle('get-version', () => {
    return app.getVersion();
});
