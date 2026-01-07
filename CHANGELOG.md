# Changelog

All notable changes to Coag-Sense Tracker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-07

### Added
- Initial release of Coag-Sense Tracker
- **Device Sync**: Real-time data download from Coag-Sense PT2 via POCT1-A protocol
- **Dashboard**: Interactive INR chart with target range visualization
- **Clinical Metrics**:
  - TTR (Time in Therapeutic Range) using Rosendaal linear interpolation method
  - INR Variability (Standard Deviation) for stability assessment
- **Table View**: Sortable table with color-coded INR values
- **Notes**: Click any reading to add personal notes (stored locally)
- **AI Predictions Tab**:
  - Next test recommendation based on stability
  - INR trend forecasting using linear regression
  - Stability score with personalized insights
- **Dose Tracking Tab**:
  - Weekly warfarin schedule management
  - Quick adjustment buttons (±5%, ±10%)
  - Smart dose distribution in 0.5mg increments
  - Dose change history
- **Documentation Tab**: Comprehensive in-app documentation
- **PDF Export**: Professional reports for healthcare providers
- **Time Filters**: 30D, 90D, 6M, 1Y, All, and custom date ranges
- **Target Range**: Configurable INR target range (default 2.0-3.0)
- **Stale Data Alert**: Warning when last reading is over 7 days old
- **Privacy**: 100% local - no data transmitted to external servers

### Technical
- FastAPI backend with WebSocket real-time updates
- POCT1-A protocol implementation for device communication
- Single-page web application with vanilla JavaScript
- Chart.js for interactive visualizations
- jsPDF + html2canvas for PDF generation
- localStorage for user preferences, doses, and notes
