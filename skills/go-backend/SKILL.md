---
name: go-backend
description: "Use when developing Go backend services that interact with HashKey Chain L2 — event listening, API design, chain data processing, abigen bindings"
---

# Go Backend Blockchain Service

Guide Go backend development for HashKey Chain L2 services using go-ethereum, abigen, and standard Go patterns.

**Announce at start:** "I'm using the go-backend skill for Go blockchain service patterns."

## When to Use

- Building Go services that interact with HashKey Chain
- Implementing event listeners / indexers in Go
- Designing APIs that aggregate onchain + offchain data
- Setting up abigen contract bindings
- Managing RPC connections and error handling

## HashKey Chain RPC Configuration

```go
const (
    MainnetRPC = "https://mainnet.hsk.xyz"
    MainnetWSS = "wss://mainnet.hsk.xyz/ws"
    TestnetRPC = "https://testnet.hsk.xyz"
    TestnetWSS = "wss://testnet-ws.hsk.xyz"

    MainnetChainID = 177
    TestnetChainID = 133
)
```

Gas token is HSK (not ETH). All fee calculations and balance displays use HSK.

## go-ethereum Client Management

```go
package ethutil

import (
    "fmt"
    "sync"

    "github.com/ethereum/go-ethereum/ethclient"
)

type Client struct {
    RPC    *ethclient.Client
    WS     *ethclient.Client
    mu     sync.RWMutex
    rpcURL string
    wsURL  string
}

func NewClient(rpcURL, wsURL string) (*Client, error) {
    rpc, err := ethclient.Dial(rpcURL)
    if err != nil {
        return nil, fmt.Errorf("dial RPC %s: %w", rpcURL, err)
    }
    ws, err := ethclient.Dial(wsURL)
    if err != nil {
        rpc.Close()
        return nil, fmt.Errorf("dial WS %s: %w", wsURL, err)
    }
    return &Client{RPC: rpc, WS: ws, rpcURL: rpcURL, wsURL: wsURL}, nil
}
```

Rules:
- Separate HTTP client (queries) and WebSocket client (subscriptions)
- Implement reconnection logic for WebSocket drops
- Use context with timeout for all RPC calls
- Health-check the connection periodically

## abigen Workflow

Generate type-safe Go bindings from contract ABI:

```bash
# From contract repo's build output
abigen --abi out/MyContract.sol/MyContract.abi.json \
       --pkg contracts \
       --type MyContract \
       --out internal/contracts/mycontract.go

# Or from combined JSON (ABI + bytecode)
abigen --combined-json out/combined.json \
       --pkg contracts \
       --out internal/contracts/bindings.go
```

Project structure for bindings:

```
internal/
  contracts/
    generate.go       // //go:generate abigen commands
    mycontract.go     // generated binding
    token.go          // generated binding
```

Use `//go:generate` for reproducible builds:

```go
//go:generate abigen --abi ../../abi/MyContract.abi.json --pkg contracts --type MyContract --out mycontract.go
package contracts
```

## Event Listener Pattern

Standard pattern for listening to contract events with reconnection:

```go
func (s *Service) ListenEvents(ctx context.Context, contractAddr common.Address) error {
    query := ethereum.FilterQuery{
        Addresses: []common.Address{contractAddr},
    }

    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
        }

        logs := make(chan types.Log)
        sub, err := s.client.WS.SubscribeFilterLogs(ctx, query, logs)
        if err != nil {
            log.Error("subscribe failed, retrying", "err", err)
            time.Sleep(5 * time.Second)
            continue
        }

        if err := s.processLogs(ctx, sub, logs); err != nil {
            log.Warn("log processing interrupted, reconnecting", "err", err)
            sub.Unsubscribe()
            time.Sleep(2 * time.Second)
        }
    }
}

func (s *Service) processLogs(ctx context.Context, sub ethereum.Subscription, logs chan types.Log) error {
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case err := <-sub.Err():
            return fmt.Errorf("subscription error: %w", err)
        case vLog := <-logs:
            if err := s.handleLog(ctx, vLog); err != nil {
                log.Error("handle log failed", "tx", vLog.TxHash, "err", err)
            }
        }
    }
}
```

Rules:
- Always handle subscription errors and reconnect
- Process historical events (FilterLogs) before starting real-time subscription to avoid gaps
- Wait for N block confirmations before considering an event final (N=1 for HSK L2 is usually sufficient)
- Store the last processed block number for crash recovery
- Use separate goroutines for each contract/event type

## Backfill + Subscribe Pattern

For reliable event processing without gaps:

```go
func (s *Service) SyncEvents(ctx context.Context, fromBlock uint64) error {
    currentBlock, err := s.client.RPC.BlockNumber(ctx)
    if err != nil {
        return err
    }

    // Phase 1: backfill historical events
    for start := fromBlock; start <= currentBlock; start += 2000 {
        end := start + 1999
        if end > currentBlock {
            end = currentBlock
        }
        logs, err := s.client.RPC.FilterLogs(ctx, ethereum.FilterQuery{
            FromBlock: new(big.Int).SetUint64(start),
            ToBlock:   new(big.Int).SetUint64(end),
            Addresses: s.contractAddresses,
        })
        if err != nil {
            return fmt.Errorf("filter logs %d-%d: %w", start, end, err)
        }
        for _, l := range logs {
            s.handleLog(ctx, l)
        }
    }

    // Phase 2: subscribe to new events (overlapping by a few blocks for safety)
    return s.ListenEvents(ctx, s.contractAddresses[0])
}
```

## API Design

For services exposing onchain data via API:

```
GET /api/v1/tokens/{address}/balance?account={account}
GET /api/v1/events?contract={addr}&event={name}&from={block}&limit=100
GET /api/v1/transactions?account={addr}&page=1&pageSize=20
POST /api/v1/transactions/decode   // decode raw tx data
```

Rules:
- Cursor-based pagination for event/transaction lists (block number + log index)
- Include block timestamp in all responses (not just block number)
- Return amounts as strings to avoid precision loss
- Provide both raw (wei) and formatted values
- Cache frequently accessed data (balances, token metadata) with block-number-based invalidation
- API responses in JSON, error codes follow standard HTTP semantics

## Database Schema Pattern

Standard tables for indexed onchain data (PostgreSQL):

```sql
CREATE TABLE sync_state (
    contract_address TEXT PRIMARY KEY,
    last_block       BIGINT NOT NULL,
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events (
    id               BIGSERIAL PRIMARY KEY,
    block_number     BIGINT NOT NULL,
    tx_hash          TEXT NOT NULL,
    log_index        INT NOT NULL,
    contract_address TEXT NOT NULL,
    event_name       TEXT NOT NULL,
    args             JSONB NOT NULL,
    block_timestamp  TIMESTAMPTZ NOT NULL,
    UNIQUE(tx_hash, log_index)
);

CREATE INDEX idx_events_contract ON events(contract_address, event_name, block_number);
```

## Error Handling

Classify RPC errors and apply appropriate retry strategies:

```go
func isRetryableError(err error) bool {
    if err == nil {
        return false
    }
    msg := err.Error()
    return strings.Contains(msg, "429") ||          // rate limited
           strings.Contains(msg, "timeout") ||
           strings.Contains(msg, "connection reset") ||
           strings.Contains(msg, "EOF")
}

func withRetry(ctx context.Context, maxAttempts int, fn func() error) error {
    for attempt := 0; attempt < maxAttempts; attempt++ {
        err := fn()
        if err == nil {
            return nil
        }
        if !isRetryableError(err) {
            return err
        }
        backoff := time.Duration(1<<uint(attempt)) * time.Second
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(backoff):
        }
    }
    return fmt.Errorf("max retries exceeded")
}
```

## Concurrency Pattern

For services monitoring multiple contracts:

```go
func (s *Service) Run(ctx context.Context) error {
    g, ctx := errgroup.WithContext(ctx)

    for _, contract := range s.contracts {
        contract := contract
        g.Go(func() error {
            return s.SyncEvents(ctx, contract.Address, contract.LastBlock)
        })
    }

    g.Go(func() error {
        return s.RunAPIServer(ctx)
    })

    return g.Wait()
}
```

## Project Structure

```
cmd/
  server/
    main.go               // Entry point
internal/
  config/
    config.go             // Chain RPC, DB, API port
  contracts/
    generate.go           // //go:generate abigen
    mycontract.go         // Generated bindings
  handler/
    events.go             // Event processing logic
    api.go                // HTTP handlers
  repository/
    events.go             // DB operations
  service/
    sync.go               // Event sync service
    indexer.go             // Indexer orchestration
pkg/
  ethutil/
    client.go             // Wrapped ethclient with reconnect
    multicall.go           // Multicall3 helper
Dockerfile
```

## Integration

**Related skills (auto-triggered by context):**
- `hsk-superpowers:abi-sync` — When contract ABI changes need syncing to abigen Go bindings
- `hsk-superpowers:data-indexing` — When building event indexers or Subgraph integrations
- `hsk-superpowers:rpc-optimization` — When optimizing RPC calls (Multicall3, caching, WebSocket)
- `hsk-superpowers:event-design` — When designing contract events consumed by Go listeners
- `hsk-superpowers:fullstack-testing` — When writing Go unit or integration tests
- `hsk-superpowers:verification-before-completion` — Before claiming backend work is complete
- `hsk-superpowers:project-scaffold` — When initializing a new Go backend repo

## Checklist

Before submitting Go backend code:

- [ ] RPC client has reconnection logic for WebSocket drops
- [ ] Event listener handles historical backfill + real-time subscription
- [ ] Block confirmation count respected before processing events
- [ ] Last processed block persisted for crash recovery
- [ ] API returns amounts as strings (no float64 for token values)
- [ ] Retryable RPC errors handled with exponential backoff
- [ ] Context propagation — all RPC calls accept context
- [ ] `go build ./...` succeeds
- [ ] `go test ./...` passes
- [ ] `go vet ./...` clean
