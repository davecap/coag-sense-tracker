// INR Reading data structure
export interface INRReading {
  id: string;
  timestamp: string;
  inr: number;
  pt_seconds: number;
  status: 'NRM' | 'HI' | 'LO' | 'ERR';
  notes?: string;
  syncedToHealth?: boolean;
}

// Device info from PT2
export interface DeviceInfo {
  id: string;
  name: string;
  serial?: string;
  model?: string;
  isConnected: boolean;
}

// App settings
export interface Settings {
  targetRangeMin: number;
  targetRangeMax: number;
  syncToHealthKit: boolean;
  autoConnect: boolean;
  lastDeviceId?: string;
}

// BLE connection state
export type BLEState =
  | 'unknown'
  | 'resetting'
  | 'unsupported'
  | 'unauthorized'
  | 'poweredOff'
  | 'poweredOn';

// Sync status
export type SyncStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'complete'
  | 'error';

// App data stored locally
export interface AppData {
  readings: INRReading[];
  device?: DeviceInfo;
  lastSync?: string;
  settings: Settings;
}

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  targetRangeMin: 2.0,
  targetRangeMax: 3.0,
  syncToHealthKit: true,
  autoConnect: true,
};
