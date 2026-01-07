# Coag-Sense Tracker Mobile App

A React Native mobile app for syncing INR/PT data from your Coag-Sense PT2 device via Bluetooth.

## Features

- **Bluetooth sync** - Connect directly to your PT2 device via BLE
- **HealthKit/Health Connect** - Sync readings to Apple Health or Android Health Connect
- **Offline storage** - All data stored locally on your device
- **Dark mode UI** - Matches the desktop Electron app

## Prerequisites

- Node.js 18+
- iOS: Xcode 15+ (for iOS development)
- Android: Android Studio (for Android development)
- A physical device (BLE doesn't work in simulators)

## Quick Start

```bash
# Install dependencies
npm install

# Start the development server
npx expo start

# Run on iOS device (requires dev build)
npx expo run:ios --device

# Run on Android device (requires dev build)
npx expo run:android --device
```

## Development Builds

This app uses native modules (BLE, HealthKit) that require a custom development build. It **will not work in Expo Go**.

```bash
# Create a development build for iOS
npx expo prebuild --platform ios
npx expo run:ios --device

# Create a development build for Android
npx expo prebuild --platform android
npx expo run:android --device
```

## Project Structure

```
mobile-app/
├── App.tsx                 # Main app with navigation
├── app.json                # Expo configuration
├── src/
│   ├── screens/
│   │   ├── DashboardScreen.tsx   # Main dashboard with stats
│   │   ├── SyncScreen.tsx        # BLE device sync
│   │   └── SettingsScreen.tsx    # App settings
│   ├── services/
│   │   ├── bluetooth.ts    # BLE communication (TODO: implement PT2 protocol)
│   │   ├── health.ts       # HealthKit/Health Connect integration
│   │   └── storage.ts      # AsyncStorage data persistence
│   └── types/
│       └── index.ts        # TypeScript type definitions
```

## TODO: Bluetooth Implementation

The BLE service (`src/services/bluetooth.ts`) has placeholder code. To complete:

1. **Discover PT2 BLE UUIDs** - Scan the device to find service/characteristic UUIDs
2. **Implement data protocol** - Parse the data format from PT2 (may be POCT1-A or custom)
3. **Handle pairing** - Implement device pairing flow

To discover the PT2's BLE services, you can use a BLE scanner app like "nRF Connect" on your phone.

## Building for Production

```bash
# Build for iOS (requires Apple Developer account)
eas build --platform ios

# Build for Android
eas build --platform android

# Build for both
eas build --platform all
```

## Privacy

- All health data stays on your device
- BLE communication is local only
- No data is sent to external servers
