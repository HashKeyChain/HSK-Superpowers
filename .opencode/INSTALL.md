# Installing HSK-Superpowers for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add hsk-superpowers to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["hsk-superpowers@git+https://github.com/HashKeyChain/HSK-Superpowers.git"]
}
```

Restart OpenCode. That's it — the plugin auto-installs and registers all skills.

Verify by asking: "Tell me about your superpowers"

## Usage

Use OpenCode's native `skill` tool:

```
use skill tool to list skills
use skill tool to load hsk-superpowers/brainstorming
```

## Updating

HSK-Superpowers updates automatically when you restart OpenCode.

To pin a specific version:

```json
{
  "plugin": ["hsk-superpowers@git+https://github.com/HashKeyChain/HSK-Superpowers.git#v1.0.0"]
}
```

## Coexistence with Original Superpowers

You can install both plugins simultaneously:

```json
{
  "plugin": [
    "superpowers@git+https://github.com/obra/superpowers.git",
    "hsk-superpowers@git+https://github.com/HashKeyChain/HSK-Superpowers.git"
  ]
}
```

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode run --print-logs "hello" 2>&1 | grep -i hsk-superpowers`
2. Verify the plugin line in your `opencode.json`
3. Make sure you're running a recent version of OpenCode

### Skills not found

1. Use `skill` tool to list what's discovered
2. Check that the plugin is loading (see above)

### Tool mapping

When skills reference Claude Code tools:
- `TodoWrite` → `todowrite`
- `Task` with subagents → `@mention` syntax
- `Skill` tool → OpenCode's native `skill` tool
- File operations → your native tools

## Getting Help

- Report issues: https://github.com/HashKeyChain/HSK-Superpowers/issues
- Full documentation: https://github.com/HashKeyChain/HSK-Superpowers
