# Installing HSK-Superpowers for Codex

Enable HSK-Superpowers skills in Codex via native skill discovery. Just clone and symlink.

## Prerequisites

- Git

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/HashKeyChain/HSK-Superpowers.git ~/.codex/hsk-superpowers
   ```

2. **Create the skills symlink:**
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/hsk-superpowers/skills ~/.agents/skills/hsk-superpowers
   ```

   **Windows (PowerShell):**
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\hsk-superpowers" "$env:USERPROFILE\.codex\hsk-superpowers\skills"
   ```

3. **Restart Codex** (quit and relaunch the CLI) to discover the skills.

## Verify

```bash
ls -la ~/.agents/skills/hsk-superpowers
```

You should see a symlink (or junction on Windows) pointing to your HSK-Superpowers skills directory.

## Updating

```bash
cd ~/.codex/hsk-superpowers && git pull
```

Skills update instantly through the symlink.

## Uninstalling

```bash
rm ~/.agents/skills/hsk-superpowers
```

Optionally delete the clone: `rm -rf ~/.codex/hsk-superpowers`.

## Coexistence with Original Superpowers

HSK-Superpowers can coexist with the original Superpowers plugin. Both will be discovered as separate skill sets:
- `superpowers/*` — Original Superpowers general development skills
- `hsk-superpowers/*` — HashKey Chain L2 blockchain skills

## Getting Help

- Report issues: https://github.com/HashKeyChain/HSK-Superpowers/issues
- Full documentation: https://github.com/HashKeyChain/HSK-Superpowers
