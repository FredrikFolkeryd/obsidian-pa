#!/bin/bash
# Interactive installer for obsidian-pa plugin
#
# Usage:
#   ./scripts/install.sh              # Interactive vault selection
#   ./scripts/install.sh --from-zip obsidian-pa-1.0.0.zip  # Install from release
#   ./scripts/install.sh --vault /path/to/vault            # Direct install (no prompt)
#
# Supports: macOS, Linux, Windows (Git Bash/WSL)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Arguments
FROM_ZIP=""
DIRECT_VAULT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --from-zip)
      FROM_ZIP="$2"
      shift 2
      ;;
    --vault)
      DIRECT_VAULT="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./scripts/install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --from-zip FILE   Install from a downloaded release zip"
      echo "  --vault PATH      Install directly to vault (skip interactive selection)"
      echo "  -h, --help        Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./scripts/install.sh                          # Build and interactive install"
      echo "  ./scripts/install.sh --from-zip release.zip   # Install from downloaded release"
      echo "  ./scripts/install.sh --vault ~/Notes          # Direct install to vault"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Detect OS and set Obsidian config path
detect_obsidian_config() {
  case "$(uname -s)" in
    Darwin)
      echo "$HOME/Library/Application Support/obsidian"
      ;;
    Linux)
      # Check XDG first, then fallback
      if [ -d "${XDG_CONFIG_HOME:-$HOME/.config}/obsidian" ]; then
        echo "${XDG_CONFIG_HOME:-$HOME/.config}/obsidian"
      else
        echo "$HOME/.config/obsidian"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      # Windows via Git Bash or similar
      echo "$APPDATA/Obsidian"
      ;;
    *)
      echo ""
      ;;
  esac
}

# Get list of vaults from obsidian.json
get_vaults() {
  local config_dir="$1"
  local config_file="$config_dir/obsidian.json"
  
  if [ ! -f "$config_file" ]; then
    return 1
  fi
  
  # Parse obsidian.json and extract vault paths
  # Format: { "vaults": { "id": { "path": "/path/to/vault", "ts": 123456 }, ... } }
  node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('$config_file', 'utf8'));
    const vaults = config.vaults || {};
    Object.values(vaults)
      .filter(v => v.path && fs.existsSync(v.path))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .forEach(v => console.log(v.path));
  " 2>/dev/null
}

# Get vault name from path (last component)
vault_name() {
  basename "$1"
}

# Install plugin to a vault
install_to_vault() {
  local vault_path="$1"
  local source_dir="$2"
  local plugins_dir="$vault_path/.obsidian/plugins"
  local target_dir="$plugins_dir/obsidian-pa"
  
  # Verify it's a vault
  if [ ! -d "$vault_path/.obsidian" ]; then
    echo -e "${RED}❌ Error: $vault_path doesn't look like an Obsidian vault${NC}"
    echo "   (no .obsidian folder found)"
    return 1
  fi
  
  # Check for existing installation
  if [ -d "$target_dir" ]; then
    echo -e "${YELLOW}⚠️  Plugin already installed at $target_dir${NC}"
    read -p "   Overwrite? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "   Skipped."
      return 0
    fi
    rm -rf "$target_dir"
  fi
  
  # Install
  mkdir -p "$plugins_dir"
  cp -r "$source_dir" "$target_dir"
  
  echo -e "${GREEN}✅ Installed to $target_dir${NC}"
  return 0
}

# Main flow
main() {
  echo -e "${BLUE}🔌 obsidian-pa Installer${NC}"
  echo ""
  
  # Step 1: Prepare plugin files
  local plugin_source=""
  
  if [ -n "$FROM_ZIP" ]; then
    # Install from zip
    if [ ! -f "$FROM_ZIP" ]; then
      echo -e "${RED}❌ Zip file not found: $FROM_ZIP${NC}"
      exit 1
    fi
    
    echo -e "📦 Extracting from ${YELLOW}$FROM_ZIP${NC}..."
    local temp_dir=$(mktemp -d)
    unzip -q "$FROM_ZIP" -d "$temp_dir"
    
    # Find the plugin directory (should be obsidian-pa/)
    if [ -d "$temp_dir/obsidian-pa" ]; then
      plugin_source="$temp_dir/obsidian-pa"
    else
      echo -e "${RED}❌ Invalid zip: expected obsidian-pa/ folder inside${NC}"
      rm -rf "$temp_dir"
      exit 1
    fi
  else
    # Build from source
    echo -e "🔨 Building from source..."
    cd "$PROJECT_ROOT"
    npm run build --silent
    
    # Create temp plugin directory
    local temp_dir=$(mktemp -d)
    plugin_source="$temp_dir/obsidian-pa"
    mkdir -p "$plugin_source"
    
    cp "$PROJECT_ROOT/main.js" "$plugin_source/"
    cp "$PROJECT_ROOT/manifest.json" "$plugin_source/"
    if [ -f "$PROJECT_ROOT/styles.css" ]; then
      cp "$PROJECT_ROOT/styles.css" "$plugin_source/"
    else
      echo "/* obsidian-pa styles */" > "$plugin_source/styles.css"
    fi
    
    local version=$(node -p "require('$PROJECT_ROOT/manifest.json').version")
    echo -e "   Built ${GREEN}v$version${NC}"
  fi
  
  echo ""
  
  # Step 2: Determine target vault
  local target_vault=""
  
  if [ -n "$DIRECT_VAULT" ]; then
    # Direct vault specified
    target_vault="$DIRECT_VAULT"
  else
    # Auto-detect Obsidian installation
    local config_dir=$(detect_obsidian_config)
    
    if [ -z "$config_dir" ] || [ ! -d "$config_dir" ]; then
      echo -e "${YELLOW}⚠️  Obsidian installation not detected${NC}"
      echo ""
      read -p "Enter vault path manually: " target_vault
      
      if [ -z "$target_vault" ]; then
        echo -e "${RED}❌ No vault path provided${NC}"
        rm -rf "$temp_dir" 2>/dev/null
        exit 1
      fi
    else
      echo -e "🔍 Found Obsidian at ${BLUE}$config_dir${NC}"
      
      # Get available vaults
      local vaults=()
      while IFS= read -r vault; do
        [ -n "$vault" ] && vaults+=("$vault")
      done < <(get_vaults "$config_dir")
      
      if [ ${#vaults[@]} -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No vaults found in Obsidian config${NC}"
        echo ""
        read -p "Enter vault path manually: " target_vault
        
        if [ -z "$target_vault" ]; then
          echo -e "${RED}❌ No vault path provided${NC}"
          rm -rf "$temp_dir" 2>/dev/null
          exit 1
        fi
      elif [ ${#vaults[@]} -eq 1 ]; then
        # Only one vault - use it directly
        target_vault="${vaults[0]}"
        echo -e "📚 Found vault: ${GREEN}$(vault_name "$target_vault")${NC}"
      else
        # Multiple vaults - interactive selection
        echo ""
        echo -e "📚 ${GREEN}Available vaults:${NC}"
        for i in "${!vaults[@]}"; do
          local num=$((i + 1))
          local name=$(vault_name "${vaults[$i]}")
          echo -e "   ${BLUE}$num)${NC} $name"
          echo -e "      ${YELLOW}${vaults[$i]}${NC}"
        done
        echo ""
        
        while true; do
          read -p "Select vault [1-${#vaults[@]}]: " selection
          
          if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le "${#vaults[@]}" ]; then
            target_vault="${vaults[$((selection - 1))]}"
            break
          else
            echo -e "${RED}Invalid selection. Please enter a number between 1 and ${#vaults[@]}${NC}"
          fi
        done
      fi
    fi
  fi
  
  echo ""
  
  # Step 3: Install
  echo -e "📥 Installing to ${BLUE}$(vault_name "$target_vault")${NC}..."
  
  if install_to_vault "$target_vault" "$plugin_source"; then
    echo ""
    echo -e "${GREEN}🎉 Installation complete!${NC}"
    echo ""
    echo -e "💡 ${YELLOW}Next steps:${NC}"
    echo "   1. Restart Obsidian (or Cmd+P → 'Reload app without saving')"
    echo "   2. Go to Settings → Community plugins"
    echo "   3. Enable \"Personal Assistant\""
  fi
  
  # Cleanup
  rm -rf "$temp_dir" 2>/dev/null
}

main
