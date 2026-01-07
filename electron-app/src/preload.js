/**
 * Coag-Sense Tracker - Preload Script
 *
 * Provides a secure bridge between the main process and renderer.
 * Exposes only specific APIs to the renderer via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer
contextBridge.exposeInMainWorld('api', {
    // Get server status
    getStatus: () => ipcRenderer.invoke('get-status'),

    // Get all readings
    getReadings: () => ipcRenderer.invoke('get-readings'),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Data management
    clearData: () => ipcRenderer.invoke('clear-data'),
    exportData: () => ipcRenderer.invoke('export-data'),
    importData: () => ipcRenderer.invoke('import-data'),

    // App info
    getVersion: () => ipcRenderer.invoke('get-version'),

    // Event listeners
    onServerStarted: (callback) => {
        ipcRenderer.on('server-started', (event, data) => callback(data));
    },

    onDeviceConnected: (callback) => {
        ipcRenderer.on('device-connected', (event, data) => callback(data));
    },

    onDeviceInfo: (callback) => {
        ipcRenderer.on('device-info', (event, data) => callback(data));
    },

    onStatusReport: (callback) => {
        ipcRenderer.on('status-report', (event, data) => callback(data));
    },

    onRequesting: (callback) => {
        ipcRenderer.on('requesting', (event, data) => callback(data));
    },

    onProgress: (callback) => {
        ipcRenderer.on('progress', (event, data) => callback(data));
    },

    onTransferComplete: (callback) => {
        ipcRenderer.on('transfer-complete', (event, data) => callback(data));
    },

    onServerError: (callback) => {
        ipcRenderer.on('server-error', (event, data) => callback(data));
    },

    onError: (callback) => {
        ipcRenderer.on('error', (event, data) => callback(data));
    },

    // Remove all listeners (for cleanup)
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners('server-started');
        ipcRenderer.removeAllListeners('device-connected');
        ipcRenderer.removeAllListeners('device-info');
        ipcRenderer.removeAllListeners('status-report');
        ipcRenderer.removeAllListeners('requesting');
        ipcRenderer.removeAllListeners('progress');
        ipcRenderer.removeAllListeners('transfer-complete');
        ipcRenderer.removeAllListeners('server-error');
        ipcRenderer.removeAllListeners('error');
    }
});
