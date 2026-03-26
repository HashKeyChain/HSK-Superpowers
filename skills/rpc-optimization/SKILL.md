---
name: rpc-optimization
description: "Use when facing RPC performance issues — covers Multicall3 batch reads, caching strategies, WebSocket subscriptions, and provider fallback for HashKey Chain L2"
---

# RPC Performance Optimization

Guide RPC optimization for HashKey Chain L2 across frontend (wagmi) and Go backend layers.

**Announce at start:** "I'm using the rpc-optimization skill for RPC performance optimization."

## ethskills Reference

Fetch the latest EVM tooling and cost data:

```
fetch https://ethskills.com/tools/SKILL.md
fetch https://ethskills.com/gas/SKILL.md
```

## When to Use

- Frontend makes too many individual RPC calls (slow page loads)
- Backend indexer or API is rate-limited by RPC provider
- Need real-time data but WebSocket connections are unstable
- Choosing between polling and subscriptions
- Designing a caching layer for onchain data

## HashKey Chain RPC Endpoints

```
HTTP:  https://mainnet.hsk.xyz     (queries)
WSS:   wss://mainnet.hsk.xyz/ws   (subscriptions)
HTTP:  https://testnet.hsk.xyz     (queries)
WSS:   wss://testnet-ws.hsk.xyz   (subscriptions)
```

## Strategy 1: Multicall3 Batch Reads

**The single most impactful optimization.** Instead of N RPC calls, make 1.

Address: `0xcA11bde05977b3631167028862bE2a173976CA11` (deployed on all EVM chains)

### Frontend (wagmi)

wagmi batches `useReadContracts` into a single Multicall3 call:

```typescript
import { useReadContracts } from 'wagmi'

const { data } = useReadContracts({
  contracts: [
    { address: tokenA, abi: erc20Abi, functionName: 'balanceOf', args: [user] },
    { address: tokenB, abi: erc20Abi, functionName: 'balanceOf', args: [user] },
    { address: tokenA, abi: erc20Abi, functionName: 'totalSupply' },
    { address: vault, abi: vaultAbi, functionName: 'getUserDeposit', args: [user] },
    { address: vault, abi: vaultAbi, functionName: 'totalAssets' },
  ],
})
// 5 reads → 1 RPC call
```

Also configure wagmi to auto-batch individual `useReadContract` hooks:

```typescript
import { createConfig, http } from 'wagmi'

export const config = createConfig({
  chains: [hashkeyMainnet],
  transports: {
    [hashkeyMainnet.id]: http(undefined, {
      batch: {
        multicall: {
          batchSize: 1024,   // max calls per batch
          wait: 50,          // ms to wait for more calls before sending
        },
      },
    }),
  },
})
```

### Go Backend

```go
package multicall

import (
    "context"
    "math/big"

    "github.com/ethereum/go-ethereum"
    "github.com/ethereum/go-ethereum/accounts/abi"
    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/ethclient"
)

var Multicall3Address = common.HexToAddress("0xcA11bde05977b3631167028862bE2a173976CA11")

type Call3 struct {
    Target       common.Address
    AllowFailure bool
    CallData     []byte
}

type Result struct {
    Success    bool
    ReturnData []byte
}

func Aggregate3(ctx context.Context, client *ethclient.Client, calls []Call3) ([]Result, error) {
    mc3ABI, _ := abi.JSON(strings.NewReader(multicall3ABI))
    input, err := mc3ABI.Pack("aggregate3", calls)
    if err != nil {
        return nil, err
    }
    output, err := client.CallContract(ctx, ethereum.CallMsg{
        To:   &Multicall3Address,
        Data: input,
    }, nil)
    if err != nil {
        return nil, err
    }
    var results []Result
    mc3ABI.UnpackIntoInterface(&results, "aggregate3", output)
    return results, nil
}
```

**Rule: Use Multicall3 whenever you need 3+ reads from the same block.**

## Strategy 2: Caching Layer

### Architecture

```
Frontend ←→ Backend API ←→ Redis Cache ←→ RPC Node
                                ↑
                          Block-based invalidation
```

### Block-Number-Based Cache

```go
type CacheEntry struct {
    Value       interface{} `json:"value"`
    BlockNumber uint64      `json:"block"`
    CachedAt    time.Time   `json:"cached_at"`
}

func (c *Cache) GetOrFetch(ctx context.Context, key string, blockNum uint64, fetch func() (interface{}, error)) (interface{}, error) {
    cached, err := c.redis.Get(ctx, key).Result()
    if err == nil {
        var entry CacheEntry
        json.Unmarshal([]byte(cached), &entry)
        if entry.BlockNumber >= blockNum {
            return entry.Value, nil
        }
    }

    value, err := fetch()
    if err != nil {
        return nil, err
    }

    entry := CacheEntry{Value: value, BlockNumber: blockNum, CachedAt: time.Now()}
    data, _ := json.Marshal(entry)
    c.redis.Set(ctx, key, data, 5*time.Minute)
    return value, nil
}
```

### Cache Strategy by Data Type

| Data | Cache TTL | Invalidation |
|------|-----------|-------------|
| Token metadata (name, symbol, decimals) | 24h | Rarely changes |
| Token totalSupply | 1 block | Changes every mint/burn |
| User balance | 1 block | Changes on transfer |
| Contract state | 1 block | Changes on write |
| Historical events | Forever | Immutable once confirmed |
| Gas price | 15s | Changes frequently |
| Block number | No cache | Always fresh |

## Strategy 3: WebSocket vs Polling

### Decision Matrix

| Need | Use WebSocket | Use Polling |
|------|---------------|-------------|
| New block notifications | Yes | - |
| Specific contract events | Yes | - |
| Pending transactions | Yes | - |
| One-time data read | - | Yes (HTTP) |
| Dashboard refresh (>5s) | - | Yes |
| High-reliability (no drops OK) | - | Yes + compare |

### WebSocket Management (Go)

```go
type WSManager struct {
    url        string
    conn       *ethclient.Client
    mu         sync.RWMutex
    reconnects int
}

func (m *WSManager) ensureConnected(ctx context.Context) (*ethclient.Client, error) {
    m.mu.RLock()
    if m.conn != nil {
        m.mu.RUnlock()
        return m.conn, nil
    }
    m.mu.RUnlock()

    m.mu.Lock()
    defer m.mu.Unlock()

    conn, err := ethclient.DialContext(ctx, m.url)
    if err != nil {
        return nil, err
    }
    m.conn = conn
    m.reconnects++
    return conn, nil
}
```

### Frontend Polling with wagmi

```typescript
const { data: balance } = useBalance({
  address: userAddress,
  query: {
    refetchInterval: 4_000, // ~2s block time on HSK L2, poll every 2 blocks
  },
})

// For time-sensitive data (e.g., swap quotes)
const { data: quote } = useReadContract({
  ...swapContract,
  functionName: 'getAmountOut',
  args: [amountIn, tokenIn, tokenOut],
  query: {
    refetchInterval: 3_000, // 3s for fresh quotes
  },
})
```

## Strategy 4: Provider Fallback

```typescript
import { createConfig, http, fallback } from 'wagmi'

export const config = createConfig({
  chains: [hashkeyMainnet],
  transports: {
    [hashkeyMainnet.id]: fallback([
      http('https://mainnet.hsk.xyz'),
      http('https://mainnet-backup.hsk.xyz'),  // backup RPC
    ]),
  },
})
```

Go backend equivalent:

```go
type FallbackClient struct {
    clients []*ethclient.Client
    current int
    mu      sync.Mutex
}

func (f *FallbackClient) CallContract(ctx context.Context, msg ethereum.CallMsg, block *big.Int) ([]byte, error) {
    for i := 0; i < len(f.clients); i++ {
        idx := (f.current + i) % len(f.clients)
        result, err := f.clients[idx].CallContract(ctx, msg, block)
        if err == nil {
            f.current = idx
            return result, nil
        }
    }
    return nil, fmt.Errorf("all RPC providers failed")
}
```

## Integration

**Related skills (auto-triggered by context):**
- `hsk-superpowers:dapp-frontend` — Frontend wagmi multicall and transport configuration
- `hsk-superpowers:go-backend` — Go backend Multicall3 helper and ethclient management
- `hsk-superpowers:data-indexing` — Batch reads for indexed data queries
- `hsk-superpowers:gas-optimization` — Gas cost awareness for onchain operations

## Optimization Checklist

- [ ] Multicall3 used for 3+ simultaneous reads
- [ ] wagmi transport configured with `batch.multicall`
- [ ] Immutable data cached long-term (token metadata, historical events)
- [ ] Mutable data cached with block-number-based invalidation
- [ ] WebSocket used for real-time events, HTTP for queries
- [ ] WebSocket has reconnection logic
- [ ] Fallback provider configured for high availability
- [ ] No individual RPC calls in loops — batch or Multicall3
- [ ] Frontend polling intervals match data freshness needs
