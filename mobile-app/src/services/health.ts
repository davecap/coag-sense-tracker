/**
 * Health integration service
 *
 * iOS: Apple HealthKit
 * Android: Health Connect
 */

import { Platform } from 'react-native';
import { INRReading } from '../types';

// HealthKit types we need (iOS only)
// INR maps to a lab result or clinical record
// For simplicity, we'll store as a custom data type or use existing quantity types

interface HealthService {
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  writeINRReading(reading: INRReading): Promise<boolean>;
  writeMultipleReadings(readings: INRReading[]): Promise<number>;
}

// iOS HealthKit implementation
const iosHealthService: HealthService = {
  async isAvailable(): Promise<boolean> {
    try {
      const AppleHealthKit = require('react-native-health').default;
      return new Promise((resolve) => {
        AppleHealthKit.isAvailable((error: any, available: boolean) => {
          resolve(!error && available);
        });
      });
    } catch {
      return false;
    }
  },

  async requestPermissions(): Promise<boolean> {
    try {
      const AppleHealthKit = require('react-native-health').default;

      const permissions = {
        permissions: {
          read: [],
          write: [
            // INR isn't directly supported, but we can use BloodGlucose as a workaround
            // or store in a custom app-specific record
            // For now, we'll note this limitation
          ],
        },
      };

      return new Promise((resolve) => {
        AppleHealthKit.initHealthKit(permissions, (error: any) => {
          resolve(!error);
        });
      });
    } catch {
      return false;
    }
  },

  async writeINRReading(reading: INRReading): Promise<boolean> {
    // TODO: Implement HealthKit writing
    // Note: HealthKit doesn't have a direct INR type
    // Options:
    // 1. Use HKClinicalRecord (requires clinical data entitlement)
    // 2. Store in app and export as PDF/CSV for healthcare providers
    // 3. Use a third-party health aggregator API
    console.log('TODO: Write INR to HealthKit:', reading);
    return true;
  },

  async writeMultipleReadings(readings: INRReading[]): Promise<number> {
    let count = 0;
    for (const reading of readings) {
      if (await this.writeINRReading(reading)) {
        count++;
      }
    }
    return count;
  },
};

// Android Health Connect implementation
const androidHealthService: HealthService = {
  async isAvailable(): Promise<boolean> {
    try {
      const { getSdkStatus, SdkAvailabilityStatus } = require('react-native-health-connect');
      const status = await getSdkStatus();
      return status === SdkAvailabilityStatus.SDK_AVAILABLE;
    } catch {
      return false;
    }
  },

  async requestPermissions(): Promise<boolean> {
    try {
      const { requestPermission } = require('react-native-health-connect');
      // Health Connect doesn't have INR directly either
      // Would need to use a generic measurement type
      const granted = await requestPermission([
        // Add relevant permission types
      ]);
      return granted.length > 0;
    } catch {
      return false;
    }
  },

  async writeINRReading(reading: INRReading): Promise<boolean> {
    // TODO: Implement Health Connect writing
    console.log('TODO: Write INR to Health Connect:', reading);
    return true;
  },

  async writeMultipleReadings(readings: INRReading[]): Promise<number> {
    let count = 0;
    for (const reading of readings) {
      if (await this.writeINRReading(reading)) {
        count++;
      }
    }
    return count;
  },
};

// Stub for unsupported platforms
const stubHealthService: HealthService = {
  async isAvailable() {
    return false;
  },
  async requestPermissions() {
    return false;
  },
  async writeINRReading() {
    return false;
  },
  async writeMultipleReadings() {
    return 0;
  },
};

// Export platform-appropriate service
export const healthService: HealthService =
  Platform.OS === 'ios'
    ? iosHealthService
    : Platform.OS === 'android'
    ? androidHealthService
    : stubHealthService;

export default healthService;
