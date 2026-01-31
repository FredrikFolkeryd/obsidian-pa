#!/bin/bash
# Build and package the plugin for local testing
#
# Usage:
#   ./scripts/package.sh                    # Creates dist/obsidian-pa.zip
#   ./scripts/package.sh /path/to/vault     # Also installs to vault
#
# The zip file can be unzipped directly into <vault>/.obsidian/plugins/
# It creates the obsidian-pa/ folder automatically.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_ROOT/dist"
PLUGIN_DIR="$DIST_DIR/obsidian-pa"
VERSION=$(node -p "require('$PROJECT_ROOT/manifest.json').version")

echo "📦 Packaging obsidian-pa v$VERSION"

# Build
echo "🔨 Building..."
cd "$PROJECT_ROOT"
npm run build

# Create dist structure
echo "📁 Creating distribution..."
rm -rf "$DIST_DIR"
mkdir -p "$PLUGIN_DIR"

# Copy required files
cp "$PROJECT_ROOT/main.js" "$PLUGIN_DIR/"
cp "$PROJECT_ROOT/manifest.json" "$PLUGIN_DIR/"

# Create empty styles.css if not exists
if [ -f "$PROJECT_ROOT/styles.css" ]; then
  cp "$PROJECT_ROOT/styles.css" "$PLUGIN_DIR/"
else
  echo "/* obsidian-pa styles */" > "$PLUGIN_DIR/styles.css"
fi

# Create zip
echo "🗜️  Creating zip..."
cd "$DIST_DIR"
zip -r "obsidian-pa-$VERSION.zip" obsidian-pa

echo ""
echo "✅ Package created: dist/obsidian-pa-$VERSION.zip"
echo ""

# Install to vault if path provided
if [ -n "$1" ]; then
  VAULT_PATH="$1"
  PLUGINS_DIR="$VAULT_PATH/.obsidian/plugins"
  
  if [ ! -d "$VAULT_PATH/.obsidian" ]; then
    echo "❌ Error: $VAULT_PATH doesn't look like an Obsidian vault (no .obsidian folder)"
    exit 1
  fi
  
  echo "📥 Installing to $PLUGINS_DIR/obsidian-pa/"
  mkdir -p "$PLUGINS_DIR"
  rm -rf "$PLUGINS_DIR/obsidian-pa"
  cp -r "$PLUGIN_DIR" "$PLUGINS_DIR/"
  
  echo "✅ Installed! Reload Obsidian and enable the plugin in Settings → Community plugins"
else
  echo "💡 To install, unzip into: <vault>/.obsidian/plugins/"
  echo "   Or run: ./scripts/package.sh /path/to/your/vault"
fi
