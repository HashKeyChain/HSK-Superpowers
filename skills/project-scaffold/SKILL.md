---
name: project-scaffold
description: "Use when creating a new HashKey Chain L2 project — generates standardized repo structures for Foundry contracts, Next.js frontend, and Go backend with HSK chain configuration"
---

# Project Scaffold

Generate standardized project structures for HashKey Chain L2 development. Supports three repo types: Foundry contracts, Next.js frontend, Go backend.

**Announce at start:** "I'm using the project-scaffold skill to initialize the project structure."

## ethskills Reference

Fetch the latest tooling and architecture guidance:

```
fetch https://ethskills.com/ship/SKILL.md
fetch https://ethskills.com/tools/SKILL.md
```

## When to Use

- Starting a new HashKey Chain project from scratch
- Adding a new service (frontend/backend) to an existing project
- Setting up the initial repo structure with HSK chain config
- Creating the cross-repo coordination setup (ABI sync, shared config)

## Repo Strategy

Default: **Separate repos** (one each for contracts, frontend, backend).

```
hashkeychain/
  project-contracts/     # Foundry + Solidity
  project-frontend/      # Next.js + wagmi + viem
  project-backend/       # Go service
```

For small teams (1-3 devs) or MVPs, a monorepo is acceptable.

## Template 1: Foundry Contract Repo

```
project-contracts/
├── src/
│   └── MyContract.sol
├── test/
│   ├── unit/
│   │   └── MyContract.t.sol
│   ├── fuzz/
│   ├── fork/
│   └── invariant/
├── script/
│   ├── Deploy.s.sol
│   └── helpers/
│       └── DeployHelper.sol
├── abi-export/               # Exported ABI for frontend/backend
├── scripts/
│   └── export-abi.sh         # ABI export script
├── lib/                      # forge install dependencies
├── .github/
│   └── workflows/
│       ├── test.yml          # forge build + test + slither
│       └── abi-export.yml    # Export ABI on main push
├── foundry.toml
├── .env.example
├── .gitignore
└── README.md
```

### `foundry.toml`

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = false

[rpc_endpoints]
hashkey_mainnet = "https://mainnet.hsk.xyz"
hashkey_testnet = "https://testnet.hsk.xyz"
localhost = "http://127.0.0.1:8545"

[etherscan]
hashkey_mainnet = { key = "${EXPLORER_API_KEY}", url = "https://explorer.hsk.xyz/api" }
hashkey_testnet = { key = "${EXPLORER_API_KEY}", url = "https://testnet-explorer.hsk.xyz/api" }

[fmt]
line_length = 120
tab_width = 4
bracket_spacing = false
```

### `.env.example`

```bash
PRIVATE_KEY=
EXPLORER_API_KEY=
HASHKEY_TESTNET_RPC=https://testnet.hsk.xyz
HASHKEY_MAINNET_RPC=https://mainnet.hsk.xyz
```

### `.github/workflows/test.yml`

```yaml
name: Smart Contract CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { submodules: recursive }
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge build
      - run: forge test -vvv
      - run: forge snapshot --check
```

## Template 2: Next.js Frontend Repo

```
project-frontend/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── (dapp)/
│   │   │       └── dashboard/
│   │   │           └── page.tsx
│   │   └── api/
│   │       └── health/
│   │           └── route.ts
│   ├── components/
│   │   ├── ui/                 # shadcn/ui
│   │   ├── web3/
│   │   │   ├── ConnectButton.tsx
│   │   │   ├── Address.tsx
│   │   │   ├── TokenAmount.tsx
│   │   │   └── TxStatus.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       └── Footer.tsx
│   ├── hooks/
│   ├── lib/
│   │   ├── chains.ts           # HSK chain definitions
│   │   ├── wagmi.ts            # wagmi config
│   │   └── contracts/
│   │       └── generated.ts    # wagmi CLI output
│   └── messages/
│       ├── zh.json
│       └── en.json
├── abi/                        # ABI files from contract repo
├── public/
├── wagmi.config.ts
├── next.config.js
├── tailwind.config.ts
├── .env.local
├── .env.testnet
├── .env.mainnet
├── Dockerfile
├── .github/
│   └── workflows/
│       └── ci.yml
├── package.json
└── README.md
```

### Key Config Files

**`next.config.js`:**

```javascript
const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin()

module.exports = withNextIntl({
  output: 'standalone',
  // wagmi requires these for SSR
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false }
    return config
  },
})
```

**`src/lib/wagmi.ts`:**

```typescript
import { createConfig, http } from 'wagmi'
import { hashkeyMainnet, hashkeyTestnet } from './chains'
import { injected, walletConnect } from 'wagmi/connectors'

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID)

export const config = createConfig({
  chains: [hashkeyMainnet, hashkeyTestnet],
  connectors: [injected(), walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! })],
  transports: {
    [hashkeyMainnet.id]: http(undefined, { batch: { multicall: { batchSize: 1024, wait: 50 } } }),
    [hashkeyTestnet.id]: http(undefined, { batch: { multicall: { batchSize: 1024, wait: 50 } } }),
  },
})
```

## Template 3: Go Backend Repo

```
project-backend/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── contracts/
│   │   ├── generate.go         # //go:generate abigen
│   │   └── (generated files)
│   ├── handler/
│   │   ├── api.go
│   │   └── events.go
│   ├── repository/
│   │   └── events.go
│   ├── service/
│   │   ├── indexer.go
│   │   └── sync.go
│   └── middleware/
│       ├── cors.go
│       └── logging.go
├── pkg/
│   └── ethutil/
│       ├── client.go           # ethclient wrapper with reconnect
│       └── multicall.go
├── abi/                        # ABI files from contract repo
├── migrations/
│   └── 001_init.sql
├── Dockerfile
├── docker-compose.yml          # local dev (postgres, redis, anvil)
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

### `Makefile`

```makefile
.PHONY: generate build test lint run

generate:
	go generate ./internal/contracts/

build: generate
	go build -o bin/server ./cmd/server

test:
	go test -short ./...

test-integration:
	go test -count=1 ./...

lint:
	golangci-lint run

run: build
	./bin/server

docker:
	docker build -t project-backend .
```

### `docker-compose.yml` (local dev)

```yaml
services:
  anvil:
    image: ghcr.io/foundry-rs/foundry:latest
    command: anvil --host 0.0.0.0 --chain-id 133
    ports: ["8545:8545"]

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: indexer
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  pgdata:
```

## Cross-Repo Coordination

### Shared Contract Addresses

Create a shared JSON that all repos reference:

```json
{
  "31337": {
    "MyToken": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  },
  "133": {
    "MyToken": "0x..."
  },
  "177": {
    "MyToken": "0x..."
  }
}
```

### ABI Sync Setup

See `hsk-superpowers:abi-sync` skill for the full pipeline. During scaffolding:

1. Create `abi/` directory in frontend and backend repos
2. Add `scripts/export-abi.sh` to contract repo
3. Configure wagmi CLI in frontend repo
4. Add `//go:generate` directives in backend repo

## Quick Start Commands

After scaffolding, the developer's first session:

```bash
# Terminal 1: Contract repo
cd project-contracts
forge install
forge build
forge test

# Terminal 2: Backend
cd project-backend
docker compose up -d          # postgres, redis, anvil
make generate && make run

# Terminal 3: Frontend
cd project-frontend
npm install
npx wagmi generate
npm run dev
```

## Integration

**Related skills (auto-triggered by context):**
- `hsk-superpowers:abi-sync` — Set up ABI sync pipeline during scaffolding
- `hsk-superpowers:dapp-frontend` — Frontend patterns and wagmi configuration
- `hsk-superpowers:go-backend` — Backend patterns and ethclient setup
- `hsk-superpowers:fullstack-deploy` — Dockerfile and CI/CD templates
- `hsk-superpowers:l2-deployment` — Contract deployment configuration (foundry.toml RPC endpoints)

## Checklist

When scaffolding a new project:

- [ ] Contract repo has foundry.toml with HSK RPC endpoints
- [ ] Contract repo has ABI export script and GitHub Actions workflow
- [ ] Frontend repo has HSK chain definitions with correct Chain IDs (133/177)
- [ ] Frontend repo has wagmi config with Multicall3 batching enabled
- [ ] Frontend repo has next-intl setup (zh/en)
- [ ] Frontend repo has shadcn/ui initialized
- [ ] Frontend Dockerfile uses `output: 'standalone'`
- [ ] Backend repo has go-ethereum dependency and abigen generate directives
- [ ] Backend repo has docker-compose for local dev (anvil + postgres + redis)
- [ ] Backend Dockerfile produces static binary
- [ ] All repos have `.env.example` (no secrets committed)
- [ ] All repos have GitHub Actions CI workflow
- [ ] Contract addresses managed in a shared location
