import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Share,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  loadData,
  updateSettings,
  clearReadings,
  exportData,
} from '../services/storage';
import { healthService } from '../services/health';
import { generateAndSharePDF } from '../services/pdf';
import { Settings, DEFAULT_SETTINGS, INRReading } from '../types';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [readings, setReadings] = useState<INRReading[]>([]);
  const [totalReadings, setTotalReadings] = useState(0);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [editingRange, setEditingRange] = useState(false);
  const [tempMin, setTempMin] = useState('');
  const [tempMax, setTempMax] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadSettings = useCallback(async () => {
    const data = await loadData();
    setSettings(data.settings);
    setReadings(data.readings);
    setTotalReadings(data.readings.length);

    const available = await healthService.isAvailable();
    setHealthAvailable(available);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const handleUpdateSetting = async (key: keyof Settings, value: any) => {
    const updated = await updateSettings({ [key]: value });
    setSettings(updated);
  };

  const handleEditRange = () => {
    setTempMin(settings.targetRangeMin.toString());
    setTempMax(settings.targetRangeMax.toString());
    setEditingRange(true);
  };

  const handleSaveRange = async () => {
    const min = parseFloat(tempMin);
    const max = parseFloat(tempMax);

    if (isNaN(min) || isNaN(max) || min <= 0 || max <= 0 || min >= max) {
      Alert.alert('Invalid Range', 'Please enter valid INR values (min < max)');
      return;
    }

    await updateSettings({ targetRangeMin: min, targetRangeMax: max });
    setSettings((prev) => ({ ...prev, targetRangeMin: min, targetRangeMax: max }));
    setEditingRange(false);
  };

  const handleExportJSON = async () => {
    try {
      const json = await exportData();
      await Share.share({
        message: json,
        title: 'Coag-Sense INR Data',
      });
    } catch (error: any) {
      Alert.alert('Export Error', error.message);
    }
  };

  const handleExportPDF = async () => {
    if (readings.length === 0) {
      Alert.alert('No Data', 'No readings to export. Sync your device first.');
      return;
    }

    setExporting(true);
    try {
      await generateAndSharePDF(readings, settings);
    } catch (error: any) {
      Alert.alert('Export Error', error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to delete all INR/PT readings? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await clearReadings();
            setTotalReadings(0);
            Alert.alert('Data Cleared', 'All readings have been deleted.');
          },
        },
      ]
    );
  };

  const handleRequestHealthPermissions = async () => {
    const granted = await healthService.requestPermissions();
    if (granted) {
      Alert.alert('Success', 'Health permissions granted');
    } else {
      Alert.alert('Error', 'Health permissions not granted');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Target Range */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>INR Target Range</Text>
        <View style={styles.card}>
          {editingRange ? (
            <View style={styles.rangeEditRow}>
              <TextInput
                style={styles.rangeInput}
                value={tempMin}
                onChangeText={setTempMin}
                keyboardType="decimal-pad"
                placeholder="Min"
                placeholderTextColor="#6b7280"
              />
              <Text style={styles.rangeSeparator}>to</Text>
              <TextInput
                style={styles.rangeInput}
                value={tempMax}
                onChangeText={setTempMax}
                keyboardType="decimal-pad"
                placeholder="Max"
                placeholderTextColor="#6b7280"
              />
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveRange}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.row} onPress={handleEditRange}>
              <Text style={styles.rowLabel}>Target Range</Text>
              <Text style={styles.rowValue}>
                {settings.targetRangeMin} - {settings.targetRangeMax}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.hint}>
            Common ranges: 2.0-3.0 (AFib), 2.5-3.5 (mechanical valve)
          </Text>
        </View>
      </View>

      {/* Health Integration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Integration</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Sync to Health App</Text>
              <Text style={styles.rowHint}>
                {healthAvailable
                  ? 'Write INR readings to Apple Health / Health Connect'
                  : 'Health app not available on this device'}
              </Text>
            </View>
            <Switch
              value={settings.syncToHealthKit}
              onValueChange={(value) =>
                handleUpdateSetting('syncToHealthKit', value)
              }
              disabled={!healthAvailable}
              trackColor={{ false: '#2a3441', true: '#4a9ece' }}
              thumbColor="#fff"
            />
          </View>
          {healthAvailable && (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleRequestHealthPermissions}
            >
              <Text style={styles.linkButtonText}>
                Request Health Permissions
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bluetooth */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bluetooth</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Auto-Connect</Text>
              <Text style={styles.rowHint}>
                Automatically connect to last used device
              </Text>
            </View>
            <Switch
              value={settings.autoConnect}
              onValueChange={(value) =>
                handleUpdateSetting('autoConnect', value)
              }
              trackColor={{ false: '#2a3441', true: '#4a9ece' }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>

      {/* Data Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total Readings</Text>
            <Text style={styles.rowValue}>{totalReadings}</Text>
          </View>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleExportPDF}
            disabled={exporting}
          >
            <Text style={styles.actionText}>
              {exporting ? 'Generating PDF...' : 'Export PDF Report'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={handleExportJSON}>
            <Text style={styles.actionText}>Export JSON Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, styles.dangerRow]}
            onPress={handleClearData}
          >
            <Text style={styles.dangerText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          <Text style={styles.disclaimer}>
            This app is for informational purposes only. Always consult your
            healthcare provider for medical advice.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a3441',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3441',
  },
  rowContent: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    color: '#e5e7eb',
  },
  rowHint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  rowValue: {
    fontSize: 15,
    color: '#4a9ece',
    fontWeight: '500',
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    padding: 16,
    paddingTop: 0,
  },
  rangeEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  rangeInput: {
    flex: 1,
    backgroundColor: '#1a2332',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
  },
  rangeSeparator: {
    fontSize: 15,
    color: '#6b7280',
    marginHorizontal: 12,
  },
  saveButton: {
    backgroundColor: '#4a9ece',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginLeft: 12,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  linkButton: {
    padding: 16,
    paddingTop: 0,
  },
  linkButtonText: {
    fontSize: 15,
    color: '#4a9ece',
  },
  actionRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3441',
  },
  actionText: {
    fontSize: 15,
    color: '#4a9ece',
  },
  dangerRow: {
    borderBottomWidth: 0,
  },
  dangerText: {
    fontSize: 15,
    color: '#f87171',
  },
  disclaimer: {
    fontSize: 13,
    color: '#6b7280',
    padding: 16,
    lineHeight: 20,
  },
});
