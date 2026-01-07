# Contributing to Coag-Sense Tracker

Thank you for your interest in contributing to Coag-Sense Tracker! This document provides guidelines for contributing to the project.

## Important Note

This is a health-related application. While we welcome contributions, please keep in mind:

- This is **NOT** a medical device
- Changes to clinical calculations (TTR, variability, etc.) should be well-researched and documented
- Any medical recommendations shown to users must include appropriate disclaimers
- When in doubt, err on the side of caution

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](../../issues)
2. If not, create a new issue using the Bug Report template
3. Include as much detail as possible (OS, Python version, browser, steps to reproduce)

### Suggesting Features

1. Check if the feature has already been requested in [Issues](../../issues)
2. If not, create a new issue using the Feature Request template
3. Describe the use case and potential benefit

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/davecap/coag-sense-tracker.git
cd coag-sense-tracker

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

## Code Style

- Python: Follow PEP 8
- JavaScript: Use consistent formatting (the project uses vanilla JS)
- HTML/CSS: Maintain the existing style patterns
- Comments: Add comments for complex logic, especially clinical calculations

## Testing

Before submitting a PR:

1. Test the web interface in multiple browsers (Chrome, Firefox, Safari)
2. Test device sync if you have access to a PT2 device
3. Verify PDF export works correctly
4. Check that existing features still work (no regressions)

## Questions?

Feel free to open an issue for questions about contributing.
