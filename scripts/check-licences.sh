#!/usr/bin/env bash
# scripts/check-licences.sh
#
# Checks all production dependencies for licence compatibility.
# Run this before adding new dependencies to verify compliance.
#
# Usage:
#   ./scripts/check-licences.sh            # Check production deps only
#   ./scripts/check-licences.sh --all      # Include dev dependencies

set -euo pipefail

PROHIBITED="GPL-2.0;GPL-3.0;AGPL-3.0;SSPL-1.0;CC-BY-NC-4.0;CC-BY-ND-4.0"

PRODUCTION_ONLY=true
if [[ "${1:-}" == "--all" ]]; then
  PRODUCTION_ONLY=false
fi

echo "🔍 Checking dependency licences..."
echo ""

if $PRODUCTION_ONLY; then
  FLAGS="--production"
  echo "Scope: production dependencies only (use --all to include devDependencies)"
else
  FLAGS=""
  echo "Scope: all dependencies (including devDependencies)"
fi
echo ""

if npx --yes license-checker $FLAGS --failOn "$PROHIBITED" --summary; then
  echo ""
  echo "✅ All licences are compliant — no prohibited licences found."
else
  echo ""
  echo "❌ Prohibited licence detected!"
  echo "   Prohibited: $(echo "$PROHIBITED" | tr ';' ', ')"
  echo "   Please remove the dependency or find a compatible alternative."
  exit 1
fi
