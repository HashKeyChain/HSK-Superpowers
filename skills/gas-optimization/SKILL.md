---
name: gas-optimization
description: "Use when optimizing Solidity contract gas consumption - provides patterns for storage, calldata, and HSK Gas Token cost analysis on HashKey Chain L2"
---

# Gas Optimization

Guide gas optimization for smart contracts on HashKey Chain L2 (OP Stack, HSK Gas Token).

**Announce at start:** "I'm using the gas-optimization skill for gas analysis."

**Core principle:** Optimize for readability first, gas second. Never sacrifice security for gas savings.

## When to Use

- After implementation is correct and tested
- When `forge snapshot --diff` shows unexpected regression
- When gas costs affect user experience
- During code review for gas efficiency

**NOT during initial implementation.** Get it working first, then optimize.

## L2 Gas Model

HashKey Chain (OP Stack) has two gas components:

```
Total Cost = L2 Execution Fee + L1 Data Fee
             (local computation)   (calldata posted to L1)
```

- **L2 Execution:** Similar to L1, but much cheaper per unit
- **L1 Data Fee:** Proportional to calldata size posted to Ethereum L1
- **Gas Token:** HSK (not ETH)

**Implication:** On L2, reducing calldata size can save more than reducing computation.

## Storage Optimization

Storage operations (SSTORE/SLOAD) are the most expensive:

```solidity
// BAD: 3 storage slots (3 × SSTORE = ~60,000 gas)
uint256 public amount;    // slot 0
uint256 public timestamp; // slot 1
address public sender;    // slot 2

// GOOD: 2 storage slots with packing
uint128 public amount;    // slot 0 (left half)
uint128 public timestamp; // slot 0 (right half)
address public sender;    // slot 1
```

**Packing rules:**
- Variables < 32 bytes can share a slot if combined size <= 32 bytes
- Order variables by size to maximize packing
- `bool` = 1 byte, `address` = 20 bytes, `uint8-uint128` = sized accordingly

```solidity
// BAD: 4 slots (bool wastes a full slot)
uint256 public value;
bool public active;
address public owner;
uint256 public deadline;

// GOOD: 3 slots (bool packed with address)
uint256 public value;     // slot 0
uint256 public deadline;  // slot 1
address public owner;     // slot 2 (20 bytes)
bool public active;       // slot 2 (1 byte, packed with address)
```

## Calldata vs Memory

```solidity
// BAD: Copies to memory (expensive)
function process(string memory data) external { ... }

// GOOD: Reads directly from calldata (cheaper)
function process(string calldata data) external { ... }
```

Use `calldata` for external function parameters that aren't modified.

## Common Optimization Patterns

### Unchecked Math (when overflow is impossible)

```solidity
// 当已知不会溢出时使用 unchecked 节省 gas
for (uint256 i = 0; i < length;) {
    // ... loop body
    unchecked { ++i; } // 节省约 80 gas/iteration
}
```

### Custom Errors (vs require strings)

```solidity
// BAD: String stored in bytecode
require(amount > 0, "Amount must be positive");

// GOOD: Custom error, cheaper deployment + runtime
error InvalidAmount();
if (amount == 0) revert InvalidAmount();
```

### Immutable and Constant

```solidity
// BAD: Storage read every time
address public owner;

// GOOD: Set once, embedded in bytecode (no SLOAD)
address public immutable owner;
uint256 public constant MAX_FEE = 1000;
```

### Mapping vs Array for Lookups

```solidity
// BAD: O(n) search
address[] public whitelist;
function isWhitelisted(address user) public view returns (bool) {
    for (uint i = 0; i < whitelist.length; i++) {
        if (whitelist[i] == user) return true;
    }
    return false;
}

// GOOD: O(1) lookup
mapping(address => bool) public whitelist;
```

## Gas Measurement Tools

```bash
# Gas report for all tests
forge test --gas-report

# Gas snapshot (baseline)
forge snapshot

# Compare after changes
forge snapshot --diff

# Specific function gas
forge test --match-test test_specificFunction --gas-report
```

## Anti-Patterns: When NOT to Optimize

| Temptation | Reality |
|------------|---------|
| Remove ReentrancyGuard to save gas | Security > gas. NEVER. |
| Skip SafeERC20 to save gas | Token interaction bugs > gas savings |
| Pack address + bool unsafely | Correctness > optimization |
| Skip events to save gas | Observability is required, not optional |
| Remove NatSpec to reduce bytecode | Documentation is required, not optional |
| Use assembly for simple ops | Readability > marginal gas savings |

## Integration

**Pairs with:**
- **hsk-superpowers:smart-contract-security** — Security must not be sacrificed for gas
- **hsk-superpowers:onchain-testing** — Gas snapshot testing patterns
- **hsk-superpowers:verification-before-completion** — `forge snapshot --diff` verification

## Red Flags

**Never:**
- Optimize before the code is correct and tested
- Sacrifice security for gas savings
- Use assembly unless absolutely necessary and well-documented
- Remove events or NatSpec for gas
- Optimize without measuring (use `forge snapshot --diff`)
