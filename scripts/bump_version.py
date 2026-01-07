#!/usr/bin/env python3
"""
Version bump script for Coag-Sense Tracker.

Usage:
    python scripts/bump_version.py patch   # 1.0.0 -> 1.0.1
    python scripts/bump_version.py minor   # 1.0.0 -> 1.1.0
    python scripts/bump_version.py major   # 1.0.0 -> 2.0.0
    python scripts/bump_version.py 1.2.3   # Set specific version
"""

import sys
import re
from pathlib import Path
from datetime import date

ROOT = Path(__file__).parent.parent
VERSION_FILE = ROOT / "VERSION"
CHANGELOG_FILE = ROOT / "CHANGELOG.md"
README_FILE = ROOT / "README.md"


def get_current_version():
    return VERSION_FILE.read_text().strip()


def bump_version(current, bump_type):
    parts = [int(x) for x in current.split('.')]

    if bump_type == 'major':
        return f"{parts[0] + 1}.0.0"
    elif bump_type == 'minor':
        return f"{parts[0]}.{parts[1] + 1}.0"
    elif bump_type == 'patch':
        return f"{parts[0]}.{parts[1]}.{parts[2] + 1}"
    else:
        # Assume it's a specific version
        if re.match(r'^\d+\.\d+\.\d+$', bump_type):
            return bump_type
        raise ValueError(f"Invalid bump type or version: {bump_type}")


def update_version_file(new_version):
    VERSION_FILE.write_text(new_version + "\n")
    print(f"  Updated VERSION to {new_version}")


def update_readme_badge(new_version):
    content = README_FILE.read_text()
    updated = re.sub(
        r'version-[\d.]+',
        f'version-{new_version}',
        content
    )
    README_FILE.write_text(updated)
    print(f"  Updated README.md badge")


def add_changelog_entry(new_version):
    content = CHANGELOG_FILE.read_text()
    today = date.today().isoformat()

    new_entry = f"""## [{new_version}] - {today}

### Added
-

### Changed
-

### Fixed
-

"""

    # Insert after the header
    marker = "and this project adheres to [Semantic Versioning]"
    if marker in content:
        idx = content.find(marker)
        end_of_line = content.find("\n\n", idx) + 2
        updated = content[:end_of_line] + new_entry + content[end_of_line:]
        CHANGELOG_FILE.write_text(updated)
        print(f"  Added CHANGELOG.md entry for {new_version}")
    else:
        print("  Warning: Could not find changelog marker, skipping")


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    bump_type = sys.argv[1]
    current = get_current_version()
    new_version = bump_version(current, bump_type)

    print(f"\nBumping version: {current} -> {new_version}\n")

    update_version_file(new_version)
    update_readme_badge(new_version)
    add_changelog_entry(new_version)

    print(f"\nDone! Don't forget to:")
    print(f"  1. Update CHANGELOG.md with your changes")
    print(f"  2. Commit: git commit -am 'Bump version to {new_version}'")
    print(f"  3. Tag: git tag v{new_version}")
    print(f"  4. Push: git push && git push --tags")


if __name__ == "__main__":
    main()
