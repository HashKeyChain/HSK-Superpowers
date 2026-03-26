---
name: abi-sync
description: "Use when contract interfaces change and ABI needs syncing to frontend (wagmi CLI) and Go backend (abigen) — covers the full pipeline from forge build to generated code"
---

# ABI Synchronization Pipeline

Guide the ABI sync workflow across separate contract, frontend, and Go backend repositories for HashKey Chain L2 projects.

**Announce at start:** "I'm using the abi-sync skill for contract-to-frontend-to-backend ABI synchronization."

## When to Use

- Contract ABI has changed (new functions, events, or errors)
- Deploying a new contract that frontend/backend need to integrate with
- Setting up the initial ABI pipeline for a new project
- Debugging type mismatches between contract and frontend/backend

## The Problem

With separate repos (contract / frontend / backend), ABI changes must propagate reliably:

```
Contract Repo          Frontend Repo           Backend Repo
forge build  ───ABI JSON───►  wagmi CLI  ───►  typed hooks
             ───ABI JSON───────────────────►  abigen bindings
```

Manual copying is error-prone. This skill establishes automated pipelines.

## Pipeline Overview

### Step 1: Contract Build Output

After `forge build`, ABI files are at:

```
out/{ContractName}.sol/{ContractName}.abi.json
```

Create an export script in the contract repo:

```bash
#!/usr/bin/env bash
# scripts/export-abi.sh
set -euo pipefail

CONTRACTS=(MyToken Vault Staking)
OUT_DIR="abi-export"

mkdir -p "$OUT_DIR"

for name in "${CONTRACTS[@]}"; do
  # Extract ABI from forge output
  jq '.abi' "out/${name}.sol/${name}.json" > "${OUT_DIR}/${name}.abi.json"
  echo "Exported ${name}.abi.json"
done

# Include deployment addresses
cat > "${OUT_DIR}/addresses.json" << 'EOF'
{
  "133": {
    "MyToken": "0x...",
    "Vault": "0x...",
    "Staking": "0x..."
  },
  "177": {
    "MyToken": "0x...",
    "Vault": "0x...",
    "Staking": "0x..."
  }
}
EOF

echo "ABI export complete. Files in ${OUT_DIR}/"
```

### Step 2: Frontend — wagmi CLI

In the frontend repo, configure wagmi CLI to generate typed hooks:

```typescript
// wagmi.config.ts
import { defineConfig } from '@wagmi/cli'
import { actions, react } from '@wagmi/cli/plugins'

export default defineConfig({
  out: 'src/lib/contracts/generated.ts',
  contracts: [
    {
      name: 'MyToken',
      abi: require('./abi/MyToken.abi.json'),
    },
    {
      name: 'Vault',
      abi: require('./abi/Vault.abi.json'),
    },
  ],
  plugins: [
    actions(),
    react(),
  ],
})
```

Generate hooks:

```bash
npx wagmi generate
```

This produces typed React hooks:

```typescript
import { useReadMyToken, useWriteMyToken, useWatchMyTokenEvent } from '@/lib/contracts/generated'

const { data: balance } = useReadMyToken({
  functionName: 'balanceOf',
  args: [address],
})
```

### Step 3: Backend — abigen

In the Go backend repo, generate typed bindings:

```go
// internal/contracts/generate.go
package contracts

//go:generate abigen --abi ../../abi/MyToken.abi.json --pkg contracts --type MyToken --out mytoken.go
//go:generate abigen --abi ../../abi/Vault.abi.json --pkg contracts --type Vault --out vault.go
```

Run:

```bash
go generate ./internal/contracts/
```

## Cross-Repo Automation

### Option A: GitHub Actions (Recommended)

In the contract repo, add a workflow that exports ABI and dispatches to dependent repos:

```yaml
# .github/workflows/abi-export.yml
name: Export ABI

on:
  push:
    branches: [main]
    paths: ['src/**/*.sol']

jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1

      - name: Build contracts
        run: forge build

      - name: Export ABI
        run: bash scripts/export-abi.sh

      - name: Dispatch to frontend
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.CROSS_REPO_TOKEN }}
          repository: HashKeyChain/project-frontend
          event-type: abi-updated
          client-payload: '{"commit": "${{ github.sha }}"}'

      - name: Dispatch to backend
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.CROSS_REPO_TOKEN }}
          repository: HashKeyChain/project-backend
          event-type: abi-updated
          client-payload: '{"commit": "${{ github.sha }}"}'

      - name: Upload ABI artifacts
        uses: actions/upload-artifact@v4
        with:
          name: abi-export
          path: abi-export/
```

In the frontend repo, receive the dispatch:

```yaml
# .github/workflows/sync-abi.yml
name: Sync ABI

on:
  repository_dispatch:
    types: [abi-updated]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download ABI from contract repo
        run: |
          gh api repos/HashKeyChain/project-contracts/actions/artifacts \
            --jq '.artifacts[0].archive_download_url' | xargs curl -L -o abi.zip
          unzip abi.zip -d abi/

      - name: Generate wagmi hooks
        run: npx wagmi generate

      - name: Create PR
        uses: peter-evans/create-pull-request@v6
        with:
          title: "chore: sync ABI from contracts (${{ github.event.client_payload.commit }})"
          branch: abi-sync/${{ github.event.client_payload.commit }}
```

### Option B: Shared ABI Package

Publish ABI as an npm package from the contract repo:

```json
{
  "name": "@hashkeychain/project-abi",
  "version": "1.0.0",
  "files": ["abi-export/"],
  "exports": {
    "./MyToken": "./abi-export/MyToken.abi.json",
    "./Vault": "./abi-export/Vault.abi.json",
    "./addresses": "./abi-export/addresses.json"
  }
}
```

Frontend and backend import from the package. Version bumps signal ABI changes.

### Option C: Git Submodule

Add the contract repo's `abi-export/` as a submodule:

```bash
git submodule add git@github.com:HashKeyChain/project-contracts.git abi
```

Simplest setup, but requires manual `git submodule update`.

## Version Tracking

Every ABI export should include metadata:

```json
{
  "version": "1.0.0",
  "contractCommit": "abc123",
  "exportedAt": "2026-03-25T10:00:00Z",
  "network": {
    "133": { "MyToken": "0x...", "Vault": "0x..." },
    "177": { "MyToken": "0x...", "Vault": "0x..." }
  }
}
```

Frontend and backend should log ABI version on startup for debugging.

## Integration

**Related skills (auto-triggered by context):**
- `hsk-superpowers:dapp-frontend` — Consumes wagmi typed hooks generated from ABI
- `hsk-superpowers:go-backend` — Consumes abigen Go bindings generated from ABI
- `hsk-superpowers:l2-deployment` — Produces ABI artifacts after contract deployment
- `hsk-superpowers:project-scaffold` — Sets up ABI sync pipeline in new projects
- `hsk-superpowers:fullstack-deploy` — CI/CD pipeline includes ABI export step

## End-to-End Workflow: Contract Change → Full Stack Update

When a contract interface changes (new function, event, or error), follow this complete workflow:

```
1. Contract: Add/modify function + event + tests    → hsk-superpowers:onchain-testing
2. Contract: forge build + forge test               → hsk-superpowers:verification-before-completion
3. Contract: Deploy to testnet                      → hsk-superpowers:l2-deployment
4. ABI: Run export-abi.sh                           → this skill (abi-sync)
5. Frontend: npx wagmi generate → use new hooks     → hsk-superpowers:dapp-frontend
6. Backend: go generate → add event handler         → hsk-superpowers:go-backend
7. Indexer: Update Subgraph schema + mapping        → hsk-superpowers:data-indexing
8. Test: End-to-end smoke test on testnet           → hsk-superpowers:fullstack-testing
9. Deploy: Build and push frontend + backend        → hsk-superpowers:fullstack-deploy
```

This checklist ensures no step is missed when propagating contract changes across the full stack.

## Checklist

When syncing ABI:

- [ ] `forge build` succeeds in contract repo
- [ ] ABI JSON exported for all public contracts
- [ ] Deployment addresses included per network (133, 177)
- [ ] Frontend: `npx wagmi generate` produces typed hooks without errors
- [ ] Backend: `go generate ./internal/contracts/` produces bindings without errors
- [ ] TypeScript compilation passes (`npx tsc --noEmit`)
- [ ] Go compilation passes (`go build ./...`)
- [ ] ABI version metadata tracks contract commit hash
