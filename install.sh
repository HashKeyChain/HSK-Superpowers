#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/HashKeyChain/HSK-Superpowers.git"
NAME="hsk-superpowers"

echo "=== HSK-Superpowers Installer ==="
echo ""

installed=false

install_cursor() {
  local target="$HOME/.cursor/plugins/local/$NAME"
  if [ -d "$target" ]; then
    echo "[Cursor] Updating existing installation..."
    git -C "$target" pull --ff-only
  else
    echo "[Cursor] Installing to $target ..."
    mkdir -p "$HOME/.cursor/plugins/local"
    git clone "$REPO" "$target"
  fi
  echo "[Cursor] Done. Restart Cursor to activate."
  installed=true
}

install_claude_code() {
  echo "[Claude Code] Installing plugin..."
  claude plugin add "$REPO"
  echo "[Claude Code] Done. Restart Claude Code to activate."
  installed=true
}

install_codex() {
  local target="$HOME/.codex/$NAME"
  if [ -d "$target" ]; then
    echo "[Codex] Updating existing installation..."
    git -C "$target" pull --ff-only
  else
    echo "[Codex] Cloning to $target ..."
    git clone "$REPO" "$target"
  fi
  mkdir -p "$HOME/.agents/skills"
  if [ ! -L "$HOME/.agents/skills/$NAME" ]; then
    ln -s "$target/skills" "$HOME/.agents/skills/$NAME"
  fi
  echo "[Codex] Done. Restart Codex to activate."
  installed=true
}

install_opencode() {
  local config_file="$HOME/.config/opencode/opencode.json"
  local plugin_entry="$NAME@git+$REPO"
  if [ -f "$config_file" ]; then
    if grep -q "$NAME" "$config_file"; then
      echo "[OpenCode] Plugin already configured in $config_file"
    else
      echo "[OpenCode] Add the following to your opencode.json plugin array:"
      echo "  \"$plugin_entry\""
    fi
  else
    echo "[OpenCode] No opencode.json found. Add to your config:"
    echo "  { \"plugin\": [\"$plugin_entry\"] }"
  fi
  echo "[OpenCode] Done. Restart OpenCode to activate."
  installed=true
}

# Detect and install for available platforms
if [ -d "$HOME/.cursor" ]; then
  install_cursor
  echo ""
fi

if command -v claude &>/dev/null; then
  install_claude_code
  echo ""
fi

if [ -d "$HOME/.codex" ] || command -v codex &>/dev/null; then
  install_codex
  echo ""
fi

if command -v opencode &>/dev/null; then
  install_opencode
  echo ""
fi

if [ "$installed" = false ]; then
  echo "No supported IDE detected (Cursor / Claude Code / Codex / OpenCode)."
  echo ""
  echo "Manual installation:"
  echo "  Cursor:      git clone $REPO ~/.cursor/plugins/local/$NAME"
  echo "  Claude Code: claude plugin add $REPO"
  echo "  Codex:       git clone $REPO ~/.codex/$NAME"
  echo "  OpenCode:    Add \"$NAME@git+$REPO\" to opencode.json plugin array"
  exit 1
fi

echo ""
echo "=== Installation complete ==="
echo ""
echo "Verify: start a new Agent session and ask it to write an ERC-20 contract."
echo "If it asks security/compliance questions first, HSK-Superpowers is active."
