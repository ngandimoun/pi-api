#!/usr/bin/env sh
set -e

echo "Summoning the Hokage..."
echo ""

if command -v bun >/dev/null 2>&1; then
  echo "Bun detected — bunx pi-hokage@latest"
  exec bunx pi-hokage@latest
fi

if command -v npx >/dev/null 2>&1; then
  echo "npm detected — npx pi-hokage@latest"
  exec npx pi-hokage@latest
fi

if command -v pnpx >/dev/null 2>&1; then
  echo "pnpm detected — pnpx pi-hokage@latest"
  exec pnpx pi-hokage@latest
fi

echo "Error: install Node.js (https://nodejs.org) or Bun (https://bun.sh) first."
exit 1
