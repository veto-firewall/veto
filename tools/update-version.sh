#!/bin/bash
set -e

# Simple version update script for VETO
# Usage: ./update-version.sh [patch|minor|major]

# Validate input
TYPE=${1:-patch}
if [[ ! "$TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Error: Version type must be 'patch', 'minor', or 'major'"
  exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(jq -r '.version' package.json)
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"

MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

# Update version based on type
case $TYPE in
  patch)
    PATCH=$((PATCH + 1))
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
esac

# Construct new version
NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# Update package.json
jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json

# Update package-lock.json if it exists
if [ -f "package-lock.json" ]; then
  jq ".version = \"$NEW_VERSION\"" package-lock.json > package-lock.json.tmp && mv package-lock.json.tmp package-lock.json
fi

# Update manifest.json
jq ".version = \"$NEW_VERSION\"" src/manifest.json > src/manifest.json.tmp && mv src/manifest.json.tmp src/manifest.json

# Status message to stderr (won't be captured in command substitution)
echo "Version updated from $CURRENT_VERSION to $NEW_VERSION" >&2

# Only output the version number to stdout for capture by the workflow
echo "$NEW_VERSION"
