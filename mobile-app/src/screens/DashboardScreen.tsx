import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadData } from '../services/storage';
import { INRReading, Settings, DEFAULT_SETTINGS } from '../types';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const [readings, setReadings] = useState<INRReading[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | undefined>();

  const loadReadings = useCallback(async () => {
    const data = await loadData();
    setReadings(data.readings);
    setSettings(data.settings);
    setLastSync(data.lastSync);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReadings();
    }, [loadReadings])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReadings();
    setRefreshing(false);
  };

  // Calculate stats
  const totalReadings = readings.length;
  const latestReading = readings[readings.length - 1];
  const inrValues = readings.map(r => r.inr).filter(v => v > 0);
  const avgINR = inrValues.length > 0
    ? (inrValues.reduce((a, b) => a + b, 0) / inrValues.length).toFixed(2)
    : '--';

  const inRangeCount = readings.filter(
    r => r.inr >= settings.targetRangeMin && r.inr <= settings.targetRangeMax
  ).length;
  const inRangePercent = totalReadings > 0
    ? Math.round((inRangeCount / totalReadings) * 100)
    : 0;

  const getINRColor = (inr: number) => {
    if (inr >= settings.targetRangeMin && inr <= settings.targetRangeMax) {
      return '#4ade80'; // Green - in range
    } else if (
      inr >= settings.targetRangeMin - 0.3 &&
      inr <= settings.targetRangeMax + 0.3
    ) {
      return '#fbbf24'; // Yellow - slightly out
    }
    return '#f87171'; // Red - significantly out
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalReadings}</Text>
          <Text style={styles.statLabel}>Total Readings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{avgINR}</Text>
          <Text style={styles.statLabel}>Average INR</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{inRangePercent}%</Text>
          <Text style={styles.statLabel}>In Range</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {settings.targetRangeMin}-{settings.targetRangeMax}
          </Text>
          <Text style={styles.statLabel}>Target Range</Text>
        </View>
      </View>

      {/* Latest Reading */}
      {latestReading && (
        <View style={styles.latestCard}>
          <Text style={styles.latestLabel}>Latest Reading</Text>
          <View style={styles.latestRow}>
            <Text
              style={[
                styles.latestINR,
                { color: getINRColor(latestReading.inr) },
              ]}
            >
              {latestReading.inr.toFixed(1)}
            </Text>
            <View style={styles.latestDetails}>
              <Text style={styles.latestPT}>
                PT: {latestReading.pt_seconds.toFixed(1)}s
              </Text>
              <Text style={styles.latestDate}>
                {formatDate(latestReading.timestamp)}
              </Text>
              <Text style={styles.latestTime}>
                {formatTime(latestReading.timestamp)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Recent Readings */}
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Readings</Text>
        {readings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No readings yet</Text>
            <Text style={styles.emptySubtext}>
              Sync your PT2 device to see your INR results
            </Text>
          </View>
        ) : (
          readings
            .slice(-10)
            .reverse()
            .map((reading, index) => (
              <View key={reading.id || index} style={styles.readingRow}>
                <View
                  style={[
                    styles.inrBadge,
                    { backgroundColor: getINRColor(reading.inr) + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.inrValue,
                      { color: getINRColor(reading.inr) },
                    ]}
                  >
                    {reading.inr.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.readingDetails}>
                  <Text style={styles.readingDate}>
                    {formatDate(reading.timestamp)}
                  </Text>
                  <Text style={styles.readingPT}>
                    PT: {reading.pt_seconds.toFixed(1)}s
                  </Text>
                </View>
                <Text style={styles.readingTime}>
                  {formatTime(reading.timestamp)}
                </Text>
              </View>
            ))
        )}
      </View>

      {lastSync && (
        <Text style={styles.lastSync}>
          Last sync: {new Date(lastSync).toLocaleString()}
        </Text>
      )}
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
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  statCard: {
    width: (width - 44) / 2,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    margin: 6,
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4a9ece',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#9ca3af',
  },
  latestCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  latestLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
  },
  latestRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  latestINR: {
    fontSize: 56,
    fontWeight: '700',
    marginRight: 20,
  },
  latestDetails: {
    flex: 1,
  },
  latestPT: {
    fontSize: 18,
    color: '#e5e7eb',
    marginBottom: 4,
  },
  latestDate: {
    fontSize: 14,
    color: '#9ca3af',
  },
  latestTime: {
    fontSize: 14,
    color: '#6b7280',
  },
  recentSection: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3441',
  },
  inrBadge: {
    width: 56,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inrValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  readingDetails: {
    flex: 1,
  },
  readingDate: {
    fontSize: 15,
    color: '#e5e7eb',
  },
  readingPT: {
    fontSize: 13,
    color: '#9ca3af',
  },
  readingTime: {
    fontSize: 13,
    color: '#6b7280',
  },
  lastSync: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
});
