---
name: event-design
description: "Use when designing smart contract events - ensures events are indexer-friendly for The Graph subgraphs and custom indexers on HashKey Chain L2"
---

# Event Design

Guide event design for smart contracts on HashKey Chain L2, optimized for The Graph subgraphs and custom indexers.

**Announce at start:** "I'm using the event-design skill for indexer-friendly event design."

**Core principle:** Events are the primary interface between onchain and offchain. Design them as carefully as you design your API.

## When to Use

- Designing new smart contract events
- Integrating with The Graph (team has own Graph node)
- Building custom indexer integration
- Setting up monitoring and alerting
- Reviewing event coverage in existing contracts

## HashKey Chain Indexing Setup

The team operates their own The Graph node. Subgraph code deploys directly to it.
Custom indexers also consume events via WSS endpoints:

```
Testnet WSS: wss://testnet-ws.hsk.xyz
Mainnet WSS: wss://mainnet.hsk.xyz/ws
```

## Event Design Rules

### Rule 1: Every State Change Gets an Event

```solidity
// BAD: State changes silently
function transfer(address to, uint256 amount) external {
    balances[msg.sender] -= amount;
    balances[to] += amount;
    // 没有事件! 索引器无法追踪
}

// GOOD: State change + event
function transfer(address to, uint256 amount) external {
    balances[msg.sender] -= amount;
    balances[to] += amount;
    emit Transfer(msg.sender, to, amount);
}
```

### Rule 2: Index High-Cardinality Fields

Maximum 3 `indexed` parameters per event. Choose wisely:

```solidity
// GOOD: 用户地址高基数，适合索引
event Transfer(
    address indexed from,    // 按发送方查询
    address indexed to,      // 按接收方查询
    uint256 amount           // 不索引，通过日志数据读取
);

// BAD: 索引低基数字段
event StatusChanged(
    bool indexed active,     // 只有true/false两个值，索引无意义
    address user
);
```

**Index these:** addresses, token IDs, proposal IDs
**Don't index these:** booleans, small enums, amounts, timestamps

### Rule 3: Use Past Tense Naming for Custom Events

For **custom events** (not defined by standards), use past tense to describe completed actions:

```solidity
// GOOD: 过去式，描述已发生的事实
event Deposited(address indexed user, uint256 amount);
event Withdrawn(address indexed user, uint256 amount);
event RoleGranted(bytes32 indexed role, address indexed account);
event Paused(address indexed account);
event Upgraded(address indexed implementation);

// BAD: 命令式
event DoWithdraw(address user, uint256 amount);
```

**Exception:** Standard interface events (ERC-20 `Transfer`/`Approval`, ERC-721 `Transfer`/`Approval`/`ApprovalForAll`, etc.) MUST use the exact names defined in the standard, regardless of tense. Do not rename `Transfer` to `Transferred`.

### Rule 4: Include Enough Context

```solidity
// BAD: 缺少上下文
event Swap(uint256 amountIn, uint256 amountOut);

// GOOD: 包含完整上下文
event Swapped(
    address indexed user,
    address indexed tokenIn,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    uint256 fee
);
```

### Rule 5: Compliance Events

```solidity
// 合规事件必须提供完整审计轨迹
event IdentityVerified(address indexed user, uint8 level, uint256 timestamp);
event IdentityRevoked(address indexed user, string reason, uint256 timestamp);
event TransferRestricted(
    address indexed from,
    address indexed to,
    uint256 amount,
    string reason
);
event ComplianceModuleUpdated(
    address indexed oldModule,
    address indexed newModule
);
```

### Rule 6: Monitoring Events

Design specific events for alerting:

```solidity
// 大额转账告警
event LargeTransfer(
    address indexed from,
    address indexed to,
    uint256 amount,
    uint256 threshold
);

// 权限变更告警
event CriticalRoleChanged(
    bytes32 indexed role,
    address indexed previousHolder,
    address indexed newHolder
);

// 紧急操作告警
event EmergencyAction(
    string action,
    address indexed triggeredBy,
    uint256 timestamp
);
```

## The Graph Subgraph Patterns

**Event → Entity mapping:**

```graphql
# subgraph schema
type Transfer @entity {
  id: ID!
  from: Bytes!
  to: Bytes!
  amount: BigInt!
  timestamp: BigInt!
  blockNumber: BigInt!
}
```

```typescript
// mapping handler
export function handleTransfer(event: TransferEvent): void {
  let transfer = new Transfer(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.amount = event.params.amount
  transfer.timestamp = event.block.timestamp
  transfer.blockNumber = event.block.number
  transfer.save()
}
```

## Multicall3 for Batch Reads

For offchain data reading, use Multicall3:

```
Multicall3 Address: 0xcA11bde05977b3631167028862bE2a173976CA11
(Deployed on virtually all EVM chains including HashKey Chain)
```

## Event Design Checklist

- [ ] Every state change has a corresponding event
- [ ] Indexed parameters are high-cardinality fields (addresses, IDs)
- [ ] Maximum 3 indexed parameters per event
- [ ] Event names use past tense
- [ ] Events include enough context for offchain reconstruction
- [ ] Compliance events provide audit trail
- [ ] Monitoring events designed for alerting
- [ ] Events compatible with The Graph entity mapping

## Integration

**Pairs with:**
- **hsk-superpowers:compliance-check** — Compliance event requirements
- **hsk-superpowers:l2-deployment** — Monitoring setup
- **hsk-superpowers:smart-contract-security** — Security-relevant events
