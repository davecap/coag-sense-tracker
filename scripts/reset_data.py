#!/usr/bin/env python3
"""
Reset all user data for Coag-Sense Tracker.

This will delete:
- All synced readings (inr_results.json)
- Raw device captures (captures/*.xml)

Note: This does NOT clear browser localStorage (doses, notes, preferences).
To clear those, use your browser's developer tools or clear site data.

Usage:
    python scripts/reset_data.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_FILE = ROOT / "inr_results.json"
CAPTURES_DIR = ROOT / "captures"


def main():
    print("\n" + "="*60)
    print("⚠️  WARNING: IRREVERSIBLE DATA DELETION")
    print("="*60)
    print("\nThis will PERMANENTLY delete:")
    print("  • All synced INR/PT readings (inr_results.json)")
    print("  • All raw device captures (captures/*.xml)")
    print("\n🚨 IMPORTANT: If your device has already marked this data")
    print("   as 'sent', you will NOT be able to re-download it!")
    print("\n   Consider backing up inr_results.json before proceeding.")
    print("="*60 + "\n")

    response = input("Type 'DELETE' (all caps) to confirm: ")
    if response != 'DELETE':
        print("Cancelled. No data was deleted.")
        sys.exit(0)

    # Remove data file
    if DATA_FILE.exists():
        DATA_FILE.unlink()
        print(f"  Deleted {DATA_FILE.name}")

    # Remove capture files
    count = 0
    for xml_file in CAPTURES_DIR.glob("*.xml"):
        xml_file.unlink()
        count += 1

    if count > 0:
        print(f"  Deleted {count} capture files from captures/")

    print("\n✓ Data reset complete!")
    print("\nNote: To clear browser data (doses, notes, preferences):")
    print("  1. Open http://localhost:8000 in your browser")
    print("  2. Open Developer Tools (F12)")
    print("  3. Go to Application > Storage > Clear site data")
    print("")


if __name__ == "__main__":
    main()
