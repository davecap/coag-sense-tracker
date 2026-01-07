import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, INRReading, Settings, DEFAULT_SETTINGS } from '../types';

const STORAGE_KEY = '@coagsense_data';

// Load all app data
export async function loadData(): Promise<AppData> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (json) {
      const data = JSON.parse(json) as AppData;
      return {
        ...data,
        settings: { ...DEFAULT_SETTINGS, ...data.settings },
      };
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
  return {
    readings: [],
    settings: DEFAULT_SETTINGS,
  };
}

// Save all app data
export async function saveData(data: AppData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Add new readings (merges with existing, deduplicates by timestamp)
export async function addReadings(newReadings: INRReading[]): Promise<AppData> {
  const data = await loadData();

  const existingTimestamps = new Set(data.readings.map(r => r.timestamp));
  const uniqueNew = newReadings.filter(r => !existingTimestamps.has(r.timestamp));

  data.readings = [...data.readings, ...uniqueNew];
  data.readings.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  data.lastSync = new Date().toISOString();

  await saveData(data);
  return data;
}

// Update settings
export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  const data = await loadData();
  data.settings = { ...data.settings, ...settings };
  await saveData(data);
  return data.settings;
}

// Clear all readings (with confirmation already done in UI)
export async function clearReadings(): Promise<void> {
  const data = await loadData();
  data.readings = [];
  data.lastSync = undefined;
  await saveData(data);
}

// Export data as JSON string
export async function exportData(): Promise<string> {
  const data = await loadData();
  return JSON.stringify(data, null, 2);
}

// Import data from JSON string
export async function importData(json: string): Promise<AppData> {
  const imported = JSON.parse(json) as AppData;

  // Validate structure
  if (!imported.readings || !Array.isArray(imported.readings)) {
    throw new Error('Invalid data format');
  }

  // Merge with existing data
  const data = await loadData();
  const existingTimestamps = new Set(data.readings.map(r => r.timestamp));
  const uniqueNew = imported.readings.filter(r => !existingTimestamps.has(r.timestamp));

  data.readings = [...data.readings, ...uniqueNew];
  data.readings.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  data.settings = { ...data.settings, ...imported.settings };

  await saveData(data);
  return data;
}
