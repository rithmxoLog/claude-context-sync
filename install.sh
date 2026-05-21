#!/usr/bin/env bash
# install.sh — build and install claude-sync on Linux/macOS
set -e

COMET_API='http://192.168.70.40:3001'

echo "Building claude-sync..."
npm run build

echo "Installing CLI..."
# Try npm link (requires write access to global node_modules)
# Fall back to ~/.local/bin symlink (no sudo needed)
if npm link 2>/dev/null; then
    echo "Installed via npm link"
else
    mkdir -p "$HOME/.local/bin"
    chmod +x "$(pwd)/dist/index.js"
    ln -sf "$(pwd)/dist/index.js" "$HOME/.local/bin/claude-sync"
    echo "Installed to ~/.local/bin/claude-sync"
    # Ensure ~/.local/bin is in PATH for future sessions
    if ! grep -q 'local/bin' "$HOME/.bashrc" 2>/dev/null; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
        echo "Added ~/.local/bin to PATH in ~/.bashrc"
    fi
fi

# Write starter config pointing at comet if none exists yet
CONFIG_DIR="$HOME/.claude-sync"
CONFIG_FILE="$CONFIG_DIR/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    mkdir -p "$CONFIG_DIR"
    printf '{"api_url":"%s"}\n' "$COMET_API" > "$CONFIG_FILE"
    echo "Config created: api_url → $COMET_API"
else
    echo "Existing config kept ($CONFIG_FILE)"
fi

echo ""
echo "Done. Run 'claude-sync --help' to get started."
