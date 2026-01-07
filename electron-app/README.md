# Coag-Sense Tracker (Electron App)

A standalone desktop application for syncing and viewing INR/PT data from your Coag-Sense PT2 device.

## Features

- **Direct device sync** - TCP server connects directly to your PT2 device
- **Offline storage** - All data stored locally on your computer
- **Interactive dashboard** - Charts, tables, statistics
- **Data protection** - Syncs merge new readings without deleting existing data
- **Cross-platform** - Runs on macOS, Windows, and Linux

## Quick Start

```bash
# Install dependencies
npm install

# Run the app
npm start

# Run with DevTools open
npm start -- --dev
```

## Syncing Your Device

1. Click **Sync Device** in the app
2. Note the IP address and port shown (e.g., `192.168.1.100:5050`)
3. On your PT2 device:
   - Go to **Settings → Communication Settings → Server**
   - Enter the IP address shown in the app
   - Set port to `5050`
   - Press **Connect**
4. Data will download automatically

## Building Distributables

### Prerequisites

- Node.js 18+
- For Windows builds on macOS/Linux: Wine
- For Linux builds on macOS: Docker (optional)

### Build Commands

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:mac      # Creates .dmg for macOS
npm run build:win      # Creates .exe installer for Windows
npm run build:linux    # Creates .AppImage and .deb for Linux

# Build for all platforms
npm run build:all
```

### Build Output

Distributables are created in `electron-app/dist/`:

| Platform | Files |
|----------|-------|
| macOS | `Coag-Sense Tracker-{version}.dmg` |
| Windows | `Coag-Sense Tracker Setup {version}.exe` |
| Linux | `Coag-Sense Tracker-{version}.AppImage`, `.deb` |

## Data Storage

Your health data is stored locally:

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/coagsense-tracker/` |
| Windows | `%APPDATA%/coagsense-tracker/` |
| Linux | `~/.config/coagsense-tracker/` |

Files:
- `inr_results.json` - Your INR/PT readings
- `settings.json` - App settings

## Settings

### ACK Mode

By default, the app sends **Reject (AR)** acknowledgments when receiving data. This tells the PT2 device to keep the data marked as "unsent" so you can re-download it later.

To mark data as "sent" on the device (preventing re-download), enable **Accept mode** in Settings.

## Import/Export

- **Export**: Settings → Export Data (saves JSON file)
- **Import**: Settings → Import Data (loads JSON file)
- **Clear**: Settings → Clear All Data (with confirmation)

## Troubleshooting

### "Cannot create TCP server" / Port in use
Another application is using port 5050. Close any other Coag-Sense apps or servers.

```bash
# Find what's using port 5050
lsof -i :5050

# Kill it if needed
kill -9 <PID>
```

### Device won't connect
- Ensure your computer and PT2 are on the same network
- Check that your firewall allows connections on port 5050
- Verify the IP address matches what the app shows

### Data not appearing after sync
- Check that the device had new observations available
- Look at the app's console for errors (View → Toggle Developer Tools)

## Development

```bash
# Run in development mode with DevTools
npm start -- --dev

# Project structure
electron-app/
├── package.json        # Dependencies and build config
├── src/
│   ├── main.js        # Electron main process (TCP server, IPC)
│   ├── preload.js     # Secure bridge between main and renderer
│   ├── index.html     # Dashboard UI
│   ├── chart.min.js   # Chart.js library
│   └── jspdf.min.js   # PDF export library
└── assets/
    └── icon*.png      # App icons
```

## Privacy

- All data stays on your computer
- No network requests except to your PT2 device on your local network
- Nothing is sent to external servers
