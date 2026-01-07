# Coag-Sense Tracker

A local, open-source application to download, view, and analyze INR/PT test results from your **Coag-Sense PT2** device.

> **Your data, your device, your computer. No cloud required.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.9+-green.svg)

## Features

- **Real-time Sync** - Connect to your PT2 device over Wi-Fi and download all test results
- **Clinical Metrics** - TTR (Time in Therapeutic Range) using the Rosendaal method, INR variability
- **Interactive Dashboard** - Charts, tables, filtering by date range and target INR
- **AI Predictions** - Next test recommendations, INR trend forecasting, stability assessment
- **Dose Tracking** - Track your warfarin schedule with smart adjustment tools
- **PDF Export** - Generate professional reports to share with your healthcare provider
- **100% Local** - All data stays on your computer. No accounts, no cloud, no tracking.

## Important Disclaimers

**Please read carefully before using this software.**

### No Affiliation

This software is an **independent, community-developed project**. It is:

- **NOT** affiliated with, endorsed by, or supported by CoaguSense, Inc.
- **NOT** affiliated with any medical device manufacturer
- **NOT** an official product or companion application
- **NOT** reviewed, approved, or certified by any regulatory body (FDA, CE, etc.)

"Coag-Sense" and "CoaguSense" are trademarks of CoaguSense, Inc. All trademarks belong to their respective owners.

### Not a Medical Device

This software is provided for **educational and personal informational purposes only**. It is:

- **NOT** a medical device
- **NOT** intended to diagnose, treat, cure, or prevent any disease
- **NOT** a substitute for professional medical advice, diagnosis, or treatment

**ALWAYS consult your healthcare provider** before making any decisions about your anticoagulation therapy. Never change your warfarin dose without guidance from your doctor.

### No Warranty / Limitation of Liability

This software is provided **"AS IS"** without warranty of any kind. **USE AT YOUR OWN RISK.** The authors are not liable for any damages, health outcomes, or other issues arising from use of this software.

### Privacy

- No data is transmitted to external servers
- No personal information is collected
- Only test results from your device are stored locally
- All data remains on your computer

## Requirements

- Python 3.9+
- A Coag-Sense PT2 device with Wi-Fi enabled
- Both your computer and the PT2 on the same local network

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/YOUR_USERNAME/coag-sense-tracker.git
cd coag-sense-tracker
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run the Application

```bash
python app.py
```

This starts:
- **Web server** on `http://localhost:8000`
- **Device server** on port `5050`

### 3. Configure Your Device

On your Coag-Sense PT2:
1. Go to **Settings** → **External Connection** → **Server**
2. Enter the **Server IP** shown in the web interface
3. Set **Port** to `5050`

### 4. Sync Your Data

1. Open `http://localhost:8000` in your browser
2. On your PT2, go to **External Connection** and press **Connect**
3. Watch the real-time progress as your data downloads
4. View your results in the dashboard!

## Application Tabs

### Dashboard
- View all INR/PT readings with interactive chart or table
- Clinical metrics: TTR (Rosendaal method), INR variability (SD)
- Filter by time period (30D, 90D, 6M, 1Y, All, Custom)
- Set your personal target INR range
- Color-coded readings (in-range, high, low)

### AI Predictions
- **Next Test Recommendation** - Based on your stability and recent trends
- **INR Trend Forecast** - Linear regression projection
- **Stability Score** - Composite assessment of control quality
- **Personalized Insights** - Context-aware tips based on your data

### Dose Tracking
- Enter your weekly warfarin schedule
- Quick adjustment buttons (±5%, ±10%)
- Smart dose distribution in 0.5mg increments
- Track dose change history

### Documentation
- Complete usage guide
- Understanding TTR and INR variability
- Clinical threshold explanations
- Privacy and disclaimer information

## Understanding the Metrics

### TTR (Time in Therapeutic Range)

Calculated using the **Rosendaal linear interpolation method** - the gold standard used in clinical trials. Rather than counting what percentage of tests were in range, it estimates what percentage of *time* you spent in range.

| TTR | Quality |
|-----|---------|
| ≥70% | Excellent control |
| 65-70% | Good control |
| <65% | Suboptimal - discuss with provider |

### INR Variability (Standard Deviation)

Measures the stability of your anticoagulation. Lower is better.

| SD | Stability |
|----|-----------|
| <0.5 | Very stable |
| 0.5-0.85 | Moderate |
| ≥0.85 | Unstable - higher risk |

## Project Structure

```
coag-sense-tracker/
├── app.py                 # Main application (FastAPI + WebSocket + POCT1-A server)
├── requirements.txt       # Python dependencies
├── static/
│   └── index.html         # Web application UI
├── captures/              # Raw XML data from device (gitignored)
├── inr_results.json       # Parsed results (gitignored)
├── LICENSE
└── README.md
```

## How It Works

The Coag-Sense PT2 uses the **POCT1-A** protocol, an XML-based standard for medical device communication.

### Connection Flow

1. Device sends `HEL.R01` (Hello) with serial number
2. Server sends `ACK.R01` (Acknowledge)
3. Device sends `DST.R01` (Device Status) with observation count
4. Server sends `ACK.R01` + `REQ.R01` with `ROBS` (Request Observations)
5. Device sends `OBS.R01` messages containing test results
6. Server acknowledges each message
7. Device sends `EOT.R01` (End of Topic)

### Data Format

Results are saved to `inr_results.json`:

```json
{
  "device": {
    "serial": "D001292H0487",
    "model": "Coag-Sense PT/INR"
  },
  "export_date": "2026-01-07T09:51:48",
  "total_readings": 197,
  "readings": [
    {
      "timestamp": "2026-01-07T10:30:00-05:00",
      "sequence": 197,
      "inr": 2.4,
      "pt_seconds": 28.5,
      "status": "NRM",
      "reagent_lot": "20000250130371"
    }
  ]
}
```

## Troubleshooting

### Device won't connect
- Verify both devices are on the same network
- Check your firewall allows port 5050
- Verify the server IP matches what's shown in the web interface

### No data received
- Ensure the device has stored test results
- Check the terminal output for error messages
- Try restarting both the application and device

### Web interface not loading
- Make sure the application is running (`python app.py`)
- Check that port 8000 is not in use by another application
- Try `http://127.0.0.1:8000` instead of `localhost`

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE)

## Acknowledgments

- Protocol analysis based on publicly available POCT1-A documentation
- Inspired by the need for patients to access their own health data
- Thanks to the open-source medical device interoperability community

## Related Resources

- [CLSI POCT1-A Standard](https://clsi.org/) (official specification)
- [IHE Laboratory Technical Framework](https://www.ihe.net/resources/technical_frameworks/#laboratory)
