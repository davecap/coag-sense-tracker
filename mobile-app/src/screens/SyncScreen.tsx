import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { bluetoothService, BLEState, SyncProgress } from '../services/bluetooth';
import { addReadings } from '../services/storage';
import { DeviceInfo } from '../types';

type ScreenStatus = 'idle' | 'scanning' | 'connecting' | 'syncing' | 'complete' | 'error';

export default function SyncScreen() {
  const [bleState, setBleState] = useState<BLEState>('unknown');
  const [status, setStatus] = useState<ScreenStatus>('idle');
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [syncResult, setSyncResult] = useState<{ received: number; total: number } | null>(null);

  useEffect(() => {
    // Subscribe to BLE state changes
    const unsubscribe = bluetoothService.onStateChange((state) => {
      setBleState(state);
    });

    return () => {
      unsubscribe();
      bluetoothService.stopScan();
    };
  }, []);

  const startScan = async () => {
    if (bleState !== 'poweredOn') {
      Alert.alert(
        'Bluetooth Required',
        'Please enable Bluetooth to scan for devices.'
      );
      return;
    }

    setDevices([]);
    setStatus('scanning');
    setProgressMessage('Scanning for PT2 devices...');
    setSyncResult(null);

    try {
      await bluetoothService.scanForDevices(
        (device) => {
          setDevices((prev) => {
            if (prev.find((d) => d.id === device.id)) {
              return prev;
            }
            return [...prev, device];
          });
        },
        15000 // 15 second timeout
      );

      setProgressMessage('Scan complete');
      setStatus('idle');
    } catch (error: any) {
      console.error('Scan error:', error);
      Alert.alert('Scan Error', error.message);
      setStatus('error');
      setProgressMessage('Scan failed: ' + error.message);
    }
  };

  const stopScan = () => {
    bluetoothService.stopScan();
    setStatus('idle');
    setProgressMessage('');
  };

  const connectAndSync = async (device: DeviceInfo) => {
    setSelectedDevice(device);
    setStatus('connecting');
    setProgressMessage(`Connecting to ${device.name}...`);

    try {
      // Connect to device
      await bluetoothService.connect(device.id);
      setStatus('syncing');

      // Start data sync with progress updates
      const readings = await bluetoothService.syncData((progress: SyncProgress) => {
        setProgressMessage(progress.message);
        if (progress.received !== undefined && progress.total !== undefined) {
          setSyncResult({ received: progress.received, total: progress.total });
        }
      });

      // Save readings to storage
      if (readings.length > 0) {
        await addReadings(readings);
        setProgressMessage(`Saved ${readings.length} readings`);
        setSyncResult({ received: readings.length, total: readings.length });
      }

      setStatus('complete');
    } catch (error: any) {
      console.error('Sync error:', error);
      setStatus('error');
      setProgressMessage('Error: ' + error.message);
      Alert.alert('Sync Error', error.message);
    }
  };

  const disconnect = async () => {
    await bluetoothService.disconnect();
    setSelectedDevice(null);
    setStatus('idle');
    setProgressMessage('');
    setSyncResult(null);
  };

  const reset = () => {
    setStatus('idle');
    setProgressMessage('');
    setSyncResult(null);
    setSelectedDevice(null);
    setDevices([]);
  };

  const getBleStatusColor = () => {
    switch (bleState) {
      case 'poweredOn':
        return '#4ade80';
      case 'poweredOff':
        return '#f87171';
      default:
        return '#fbbf24';
    }
  };

  const getBleStatusText = () => {
    switch (bleState) {
      case 'poweredOn':
        return 'Bluetooth Ready';
      case 'poweredOff':
        return 'Bluetooth Off';
      case 'unauthorized':
        return 'Bluetooth Unauthorized';
      case 'unsupported':
        return 'Bluetooth Not Supported';
      default:
        return 'Checking Bluetooth...';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'scanning':
        return '📡';
      case 'connecting':
        return '🔗';
      case 'syncing':
        return '📥';
      case 'complete':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      {/* Bluetooth Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View
            style={[styles.statusDot, { backgroundColor: getBleStatusColor() }]}
          />
          <Text style={styles.statusText}>{getBleStatusText()}</Text>
        </View>
      </View>

      {/* Progress Card */}
      {(status !== 'idle' || progressMessage) && (
        <View style={styles.progressCard}>
          {(status === 'scanning' || status === 'connecting' || status === 'syncing') && (
            <ActivityIndicator color="#4a9ece" style={styles.spinner} />
          )}
          {status === 'complete' && <Text style={styles.statusIcon}>✅</Text>}
          {status === 'error' && <Text style={styles.statusIcon}>❌</Text>}
          <View style={styles.progressContent}>
            <Text style={styles.progressText}>{progressMessage}</Text>
            {syncResult && (
              <Text style={styles.progressSubtext}>
                {syncResult.received} of {syncResult.total} readings
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsCard}>
        {status === 'idle' && (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              bleState !== 'poweredOn' && styles.disabledButton,
            ]}
            onPress={startScan}
            disabled={bleState !== 'poweredOn'}
          >
            <Text style={styles.primaryButtonText}>
              {devices.length > 0 ? 'Scan Again' : 'Scan for Devices'}
            </Text>
          </TouchableOpacity>
        )}

        {status === 'scanning' && (
          <TouchableOpacity style={styles.secondaryButton} onPress={stopScan}>
            <Text style={styles.secondaryButtonText}>Stop Scanning</Text>
          </TouchableOpacity>
        )}

        {(status === 'complete' || status === 'error') && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, styles.flexButton]}
              onPress={disconnect}
            >
              <Text style={styles.secondaryButtonText}>Disconnect</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, styles.flexButton]}
              onPress={reset}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Device List */}
      {devices.length > 0 && status === 'idle' && (
        <View style={styles.devicesCard}>
          <Text style={styles.sectionTitle}>Found Devices</Text>
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.deviceRow}
                onPress={() => connectAndSync(item)}
              >
                <View style={styles.deviceIcon}>
                  <Text style={styles.deviceIconText}>PT2</Text>
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{item.name}</Text>
                  <Text style={styles.deviceId}>
                    {item.id.substring(0, 17)}...
                  </Text>
                </View>
                <Text style={styles.connectArrow}>→</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* No Devices Found */}
      {devices.length === 0 && status === 'idle' && progressMessage.includes('complete') && (
        <View style={styles.noDevicesCard}>
          <Text style={styles.noDevicesText}>No PT2 devices found</Text>
          <Text style={styles.noDevicesSubtext}>
            Make sure your device is turned on and Bluetooth is enabled
          </Text>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.sectionTitle}>How to Sync via Bluetooth</Text>
        <View style={styles.instructionRow}>
          <Text style={styles.instructionNumber}>1</Text>
          <Text style={styles.instructionText}>
            On your PT2: Settings → Data Transfer → Bluetooth → On
          </Text>
        </View>
        <View style={styles.instructionRow}>
          <Text style={styles.instructionNumber}>2</Text>
          <Text style={styles.instructionText}>
            On your PT2: Settings → Communication Settings → Bluetooth → Connect
          </Text>
        </View>
        <View style={styles.instructionRow}>
          <Text style={styles.instructionNumber}>3</Text>
          <Text style={styles.instructionText}>
            Tap "Scan for Devices" above
          </Text>
        </View>
        <View style={styles.instructionRow}>
          <Text style={styles.instructionNumber}>4</Text>
          <Text style={styles.instructionText}>
            Select your device, enter the PIN shown on the PT2, then confirm on both devices
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 15,
    color: '#e5e7eb',
  },
  progressCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a9ece',
  },
  spinner: {
    marginRight: 12,
  },
  statusIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  progressContent: {
    flex: 1,
  },
  progressText: {
    fontSize: 15,
    color: '#e5e7eb',
  },
  progressSubtext: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  actionsCard: {
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#4a9ece',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#1a2332',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  disabledButton: {
    opacity: 0.5,
  },
  devicesCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 16,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3441',
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4a9ece20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceIconText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4a9ece',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#e5e7eb',
  },
  deviceId: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  connectArrow: {
    fontSize: 20,
    color: '#4a9ece',
  },
  noDevicesCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 24,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  noDevicesText: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 8,
  },
  noDevicesSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  instructionsCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4a9ece20',
    color: '#4a9ece',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 22,
  },
});
