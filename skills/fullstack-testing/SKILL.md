---
name: fullstack-testing
description: "Use when writing frontend integration tests, Go backend tests, or E2E tests for dApp projects — covers wagmi mock providers, anvil fork testing, and Playwright E2E"
---

# Full-Stack Testing

Guide testing beyond Foundry contract tests: frontend component/integration tests, Go backend tests, and end-to-end dApp tests on HashKey Chain L2.

**Announce at start:** "I'm using the fullstack-testing skill for frontend, backend, and E2E testing."

**Coordination:** This skill complements `hsk-superpowers:onchain-testing` (Foundry four-layer tests) and `hsk-superpowers:test-driven-development` (TDD discipline). Use those for contract-level testing. This skill covers everything above the contract layer.

## When to Use

- Writing frontend component tests with contract interactions
- Testing Go backend event listeners and API handlers
- Setting up E2E tests for full transaction flows
- Integration testing contract ↔ frontend ↔ backend

## Testing Pyramid for dApps

```
         /  E2E Tests  \           Playwright + anvil
        / (few, slow)    \         Full user flow through browser
       /------------------\
      / Integration Tests   \      wagmi mock + anvil fork
     / (moderate)             \    Go + anvil fork
    /--------------------------\
   /      Unit Tests            \  vitest (React components)
  / (many, fast)                 \ Go unit tests (mocked ethclient)
 /________________________________\
        Contract Tests              Foundry (see onchain-testing skill)
```

## Frontend Testing

### Setup: vitest + Testing Library + wagmi Mock

```typescript
// test/setup.ts
import { createConfig, http } from 'wagmi'
import { defineChain } from 'viem'
import { mock } from 'wagmi/connectors'

const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'HSK', symbol: 'HSK', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
})

export const testConfig = createConfig({
  chains: [anvil],
  connectors: [
    mock({
      accounts: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'], // anvil account 0
    }),
  ],
  transports: {
    [anvil.id]: http('http://127.0.0.1:8545'),
  },
})
```

### Component Test with Contract Read

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { testConfig } from '../test/setup'
import { BalanceDisplay } from './BalanceDisplay'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={testConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

describe('BalanceDisplay', () => {
  it('shows formatted HSK balance', async () => {
    render(<BalanceDisplay />, { wrapper: TestWrapper })
    await waitFor(() => {
      expect(screen.getByText(/HSK/)).toBeInTheDocument()
    })
  })
})
```

### Transaction Flow Test

```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'

describe('Token Transfer', () => {
  it('sends transfer and waits for confirmation', async () => {
    const { result } = renderHook(() => useWriteContract(), {
      wrapper: TestWrapper,
    })

    await act(async () => {
      result.current.writeContract({
        address: tokenAddress,
        abi: tokenAbi,
        functionName: 'transfer',
        args: [recipient, parseEther('1')],
      })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
      expect(result.current.data).toBeDefined() // tx hash
    })
  })
})
```

Rules:
- Start anvil before running frontend integration tests
- Use `mock` connector for unit tests (no real chain needed)
- Use anvil for integration tests (real contract execution)
- Reset anvil state between test suites (`anvil_reset`)

## Go Backend Testing

### Unit Test: Event Handler (Mocked)

```go
func TestHandleTransferEvent(t *testing.T) {
    db := setupTestDB(t)
    handler := NewEventHandler(db)

    event := &contracts.MyTokenTransfer{
        From:  common.HexToAddress("0xAAA"),
        To:    common.HexToAddress("0xBBB"),
        Value: big.NewInt(1e18),
        Raw: types.Log{
            TxHash:      common.HexToHash("0x123"),
            BlockNumber: 100,
            Index:       0,
        },
    }

    err := handler.HandleTransfer(context.Background(), event)
    require.NoError(t, err)

    // Verify DB state
    var count int
    db.QueryRow("SELECT COUNT(*) FROM transfers").Scan(&count)
    assert.Equal(t, 1, count)
}
```

### Integration Test: Against anvil Fork

```go
func TestSyncEvents_Integration(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }

    // Requires anvil running: anvil --fork-url https://testnet.hsk.xyz
    client, err := ethclient.Dial("http://127.0.0.1:8545")
    require.NoError(t, err)

    syncer := NewEventSyncer(client, setupTestDB(t))
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    err = syncer.SyncFromBlock(ctx, 1000)
    require.NoError(t, err)
}
```

### API Handler Test

```go
func TestGetBalanceHandler(t *testing.T) {
    db := setupTestDB(t)
    seedTestData(db)

    router := setupRouter(db)
    req := httptest.NewRequest("GET", "/api/v1/balance/0xAAA", nil)
    rec := httptest.NewRecorder()

    router.ServeHTTP(rec, req)

    assert.Equal(t, http.StatusOK, rec.Code)
    var resp BalanceResponse
    json.Unmarshal(rec.Body.Bytes(), &resp)
    assert.Equal(t, "1000000000000000000", resp.Balance)
}
```

Rules:
- Use `testing.Short()` to skip slow integration tests in CI quick checks
- Use `testcontainers-go` for PostgreSQL in tests
- Mock ethclient for unit tests, use anvil for integration tests
- Test error paths: RPC timeout, invalid event data, DB connection loss

## E2E Testing

### Playwright + anvil

```typescript
// e2e/transfer.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Token Transfer', () => {
  test.beforeAll(async () => {
    // anvil should be running with contracts deployed
    // Use a setup script: anvil & forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545
  })

  test('user can transfer tokens', async ({ page }) => {
    await page.goto('http://localhost:3000')

    // Connect wallet (use a test wallet extension or mock)
    await page.click('[data-testid="connect-wallet"]')
    await page.click('[data-testid="mock-connector"]')

    // Navigate to transfer page
    await page.click('[data-testid="nav-transfer"]')

    // Fill transfer form
    await page.fill('[data-testid="recipient-input"]', '0xBBB...')
    await page.fill('[data-testid="amount-input"]', '100')
    await page.click('[data-testid="transfer-button"]')

    // Wait for transaction confirmation
    await expect(page.locator('[data-testid="tx-status"]')).toContainText('已确认', {
      timeout: 30000,
    })
  })
})
```

### E2E Test Infrastructure

```yaml
# docker-compose.test.yml
services:
  anvil:
    image: ghcr.io/foundry-rs/foundry:latest
    command: anvil --host 0.0.0.0 --chain-id 133
    ports: ["8545:8545"]

  deploy-contracts:
    build: ../contracts
    command: forge script script/Deploy.s.sol --rpc-url http://anvil:8545 --broadcast
    depends_on: [anvil]

  frontend:
    build: ../frontend
    environment:
      NEXT_PUBLIC_CHAIN_ID: "133"
      NEXT_PUBLIC_RPC_URL: "http://anvil:8545"
    ports: ["3000:3000"]
    depends_on: [deploy-contracts]

  backend:
    build: ../backend
    environment:
      RPC_URL: "http://anvil:8545"
      DB_URL: "postgres://test:test@db:5432/test"
    depends_on: [deploy-contracts, db]

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test
```

Run E2E:

```bash
docker compose -f docker-compose.test.yml up -d
npx playwright test
docker compose -f docker-compose.test.yml down
```

## GitHub Actions Integration

```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test              # vitest unit tests (no anvil needed)

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: anvil &
      - run: forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
      - run: npm ci
      - run: npm run test:integration  # tests that need anvil

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f docker-compose.test.yml up -d --wait
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - run: docker compose -f docker-compose.test.yml down
```

## Integration

**Related skills (auto-triggered by context):**
- `hsk-superpowers:onchain-testing` — Foundry four-layer contract tests (Unit/Fuzz/Fork/Invariant)
- `hsk-superpowers:test-driven-development` — TDD discipline (red-green-refactor cycle)
- `hsk-superpowers:dapp-frontend` — Frontend component patterns being tested
- `hsk-superpowers:go-backend` — Go backend patterns being tested
- `hsk-superpowers:verification-before-completion` — Run all test suites before claiming completion

## Checklist

- [ ] Frontend unit tests use `mock` connector (no anvil dependency)
- [ ] Frontend integration tests start anvil and deploy contracts first
- [ ] Go unit tests mock ethclient (no network dependency)
- [ ] Go integration tests use `testing.Short()` guard
- [ ] E2E tests use docker-compose with anvil + deployed contracts
- [ ] All test suites run in CI (GitHub Actions)
- [ ] Test data is isolated — no shared state between test cases
- [ ] anvil state reset between test suites
