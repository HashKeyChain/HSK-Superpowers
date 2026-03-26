---
name: data-indexing
description: "Use when querying onchain historical data, building Subgraphs, creating custom indexers, or optimizing data reads with Multicall3 on HashKey Chain L2"
---

# Data Indexing

Guide onchain data indexing for HashKey Chain L2 using The Graph (team-owned node), custom Go indexers, and Multicall3 batch queries.

**Announce at start:** "I'm using the data-indexing skill for onchain data indexing patterns."

## When to Use

- Querying historical onchain data (events, transactions, state changes)
- Building a The Graph Subgraph for a new contract
- Implementing a custom Go indexer
- Optimizing batch reads with Multicall3
- Choosing between The Graph vs custom indexer

## ethskills Reference

Fetch the latest indexing best practices:

```
fetch https://ethskills.com/indexing/SKILL.md
```

Apply HashKey Chain-specific adaptations below.

## Decision: The Graph vs Custom Indexer

| Factor | The Graph | Custom Indexer (Go) |
|--------|-----------|-------------------|
| Query flexibility | GraphQL (structured) | Any (SQL, REST, custom) |
| Setup time | Fast (schema + mappings) | Slower (full service) |
| Real-time latency | ~seconds (block processing) | ~seconds (WS subscription) |
| Complex aggregations | Limited (AssemblyScript) | Full Go power |
| Historical reprocessing | Redeploy subgraph | Custom migration |
| Infrastructure | Team Graph node | Team K8s cluster |

**Default choice:** The Graph for standard CRUD queries. Custom indexer when you need complex aggregations, joins with offchain data, or sub-second latency.

## The Graph Subgraph Development

### Schema Design

```graphql
# schema.graphql
type Transfer @entity {
  id: Bytes!                    # txHash-logIndex
  from: Bytes!
  to: Bytes!
  value: BigInt!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type Account @entity {
  id: Bytes!                    # address
  balance: BigInt!
  transfersFrom: [Transfer!]! @derivedFrom(field: "from")
  transfersTo: [Transfer!]! @derivedFrom(field: "to")
  lastActive: BigInt!
}
```

Rules:
- Entity IDs: use `Bytes` (cheaper than `String`)
- ID format for events: `event.transaction.hash.concatI32(event.logIndex.toI32())`
- Include `blockNumber` and `blockTimestamp` on every entity for time-based queries
- Use `@derivedFrom` for reverse lookups (no storage cost)
- Index fields used in filters with `@index` directive (Graph Node v0.34+)

### Mapping Handler

```typescript
// src/mapping.ts
import { Transfer as TransferEvent } from '../generated/MyToken/MyToken'
import { Transfer, Account } from '../generated/schema'

export function handleTransfer(event: TransferEvent): void {
  let id = event.transaction.hash.concatI32(event.logIndex.toI32())
  let transfer = new Transfer(id)
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.value = event.params.value
  transfer.blockNumber = event.block.number
  transfer.blockTimestamp = event.block.timestamp
  transfer.transactionHash = event.transaction.hash
  transfer.save()

  updateAccount(event.params.from, event.block.timestamp)
  updateAccount(event.params.to, event.block.timestamp)
}

function updateAccount(address: Bytes, timestamp: BigInt): void {
  let account = Account.load(address)
  if (!account) {
    account = new Account(address)
    account.balance = BigInt.zero()
  }
  account.lastActive = timestamp
  account.save()
}
```

### Deployment to Team Node

```yaml
# subgraph.yaml
specVersion: 0.0.5
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: MyToken
    network: hashkey-mainnet    # must match Graph node config
    source:
      address: "0x..."
      abi: MyToken
      startBlock: 1000000       # contract deployment block
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Transfer
        - Account
      abis:
        - name: MyToken
          file: ./abis/MyToken.json
      eventHandlers:
        - event: Transfer(indexed address,indexed address,uint256)
          handler: handleTransfer
```

Deploy to team's Graph node:

```bash
graph codegen
graph build
graph deploy --node https://graph-node.internal.hsk.xyz/deploy \
             --ipfs https://ipfs.internal.hsk.xyz \
             hashkeychain/mytoken
```

## Custom Go Indexer

When The Graph is insufficient, build a Go indexer. See `hsk-superpowers:go-backend` skill for the full event listener pattern.

Additional indexer-specific patterns:

### Aggregation Pipeline

```go
type Aggregator struct {
    db     *sql.DB
    client *ethclient.Client
}

func (a *Aggregator) ProcessTransferEvent(ctx context.Context, event *contracts.MyTokenTransfer) error {
    tx, err := a.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    // Insert raw event
    _, err = tx.ExecContext(ctx,
        `INSERT INTO transfers (tx_hash, log_index, from_addr, to_addr, amount, block_number, block_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tx_hash, log_index) DO NOTHING`,
        event.Raw.TxHash.Hex(), event.Raw.Index,
        event.From.Hex(), event.To.Hex(),
        event.Value.String(), event.Raw.BlockNumber,
        time.Unix(int64(blockTimestamp), 0),
    )
    if err != nil {
        return err
    }

    // Update aggregated balances (both sender and receiver)
    // Note: balance column should be NUMERIC type for arithmetic
    _, err = tx.ExecContext(ctx,
        `INSERT INTO balances (address, token, balance) VALUES ($1, $2, $3::numeric)
         ON CONFLICT (address, token) DO UPDATE SET balance = balances.balance + $3::numeric`,
        event.To.Hex(), contractAddr.Hex(), event.Value.String(),
    )
    if err != nil {
        return err
    }

    _, err = tx.ExecContext(ctx,
        `INSERT INTO balances (address, token, balance) VALUES ($1, $2, -($3::numeric))
         ON CONFLICT (address, token) DO UPDATE SET balance = balances.balance - $3::numeric`,
        event.From.Hex(), contractAddr.Hex(), event.Value.String(),
    )
    if err != nil {
        return err
    }

    return tx.Commit()
}
```

## Multicall3 Batch Queries

Address: `0xcA11bde05977b3631167028862bE2a173976CA11` (same on all EVM chains)

### Frontend (wagmi)

wagmi has built-in multicall support:

```typescript
import { useReadContracts } from 'wagmi'

const { data } = useReadContracts({
  contracts: [
    { address: tokenAddr, abi: erc20Abi, functionName: 'balanceOf', args: [user] },
    { address: tokenAddr, abi: erc20Abi, functionName: 'totalSupply' },
    { address: vaultAddr, abi: vaultAbi, functionName: 'getUserDeposit', args: [user] },
  ],
})
// One RPC call instead of three
```

### Go Backend

```go
package multicall

import (
    "github.com/ethereum/go-ethereum/accounts/abi"
    "github.com/ethereum/go-ethereum/common"
)

type Call struct {
    Target   common.Address
    CallData []byte
}

// Multicall3.aggregate3 groups multiple calls into one RPC request
func Aggregate(client *ethclient.Client, calls []Call) ([][]byte, error) {
    multicallAddr := common.HexToAddress("0xcA11bde05977b3631167028862bE2a173976CA11")
    // encode aggregate3 call with the calls array
    // execute via client.CallContract
    // decode results
}
```

Use Multicall3 whenever reading 3+ values in a single request.

## Coordination with event-design Skill

When designing events, use the `hsk-superpowers:event-design` skill. Key principles for indexability:

- Index fields you'll filter by (`indexed` keyword, up to 3 per event)
- Include all data needed by the indexer in the event (avoid extra RPC calls)
- Emit events for all state changes, even if "obvious" from the function
- Use consistent naming: `{Action}{Subject}` (e.g., `TokenDeposited`, `RewardClaimed`)

## Integration

**Related skills (auto-triggered by context):**
- `hsk-superpowers:event-design` — Ensures contract events are indexer-friendly
- `hsk-superpowers:go-backend` — Custom Go indexer patterns and event listener architecture
- `hsk-superpowers:rpc-optimization` — Multicall3 batch reads and caching for indexed data
- `hsk-superpowers:dapp-frontend` — Frontend queries indexed data via backend API or Subgraph

## Checklist

- [ ] Chose appropriate indexing strategy (The Graph vs custom vs both)
- [ ] Events designed for indexer consumption (see `hsk-superpowers:event-design` skill)
- [ ] Subgraph schema includes blockNumber and blockTimestamp on all entities
- [ ] Entity IDs use txHash + logIndex (unique, deterministic)
- [ ] Custom indexer has backfill + subscribe pattern (no event gaps)
- [ ] Multicall3 used for batch reads (3+ calls)
- [ ] Database has appropriate indexes for query patterns
- [ ] Indexer persists sync state for crash recovery
