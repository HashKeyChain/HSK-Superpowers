---
name: onchain-testing
description: "Use when writing Foundry tests for Solidity smart contracts - extends TDD with blockchain-specific four-layer testing patterns for HashKey Chain L2"
---

# Onchain Testing

Comprehensive Foundry testing patterns for smart contracts on HashKey Chain L2.

**Announce at start:** "I'm using the onchain-testing skill for Foundry test patterns."

**Core principle:** Four layers of testing, each catching different classes of bugs.

**This skill extends hsk-superpowers:test-driven-development.** Use TDD for the cycle (red-green-refactor), this skill for blockchain-specific patterns.

## Four-Layer Testing Model

```
Layer 1: Unit Tests      — Every function, always
Layer 2: Fuzz Tests      — All math, MUST
Layer 3: Fork Tests      — External integrations, MUST  
Layer 4: Invariant Tests — Core financial logic, MUST
```

### Decision Tree: Which Layer?

- Does it involve arithmetic? → **Fuzz test** (Layer 2)
- Does it interact with external protocols (Uniswap/Aave/Chainlink)? → **Fork test** (Layer 3)
- Is it core financial logic (vault, lending, staking)? → **Invariant test** (Layer 4)
- Everything else → **Unit test** (Layer 1)
- Most functions need Layer 1 + at least one other layer

### Layer 1: Unit Tests

Standard function-level tests. Follow TDD cycle.

```solidity
function test_depositIncreasesBalance() public {
    uint256 balanceBefore = vault.balanceOf(user);
    
    vm.prank(user);
    vault.deposit(1000e18);
    
    assertEq(vault.balanceOf(user), balanceBefore + 1000e18);
}
```

### Layer 2: Fuzz Tests

**MUST for all math functions.** Foundry generates random inputs to find edge cases.

```solidity
function testFuzz_feeCalculation(uint256 amount, uint256 basisPoints) public {
    // Bound inputs to reasonable ranges
    amount = bound(amount, 1, type(uint128).max);
    basisPoints = bound(basisPoints, 0, 10000);
    
    uint256 fee = calculator.calculateFee(amount, basisPoints);
    
    // 手续费不应超过本金
    assertLe(fee, amount);
    // 手续费计算应与手动计算一致
    assertEq(fee, amount * basisPoints / 10000);
}

function testFuzz_tokenConversion(uint256 amount, uint8 fromDecimals, uint8 toDecimals) public {
    fromDecimals = uint8(bound(fromDecimals, 1, 18));
    toDecimals = uint8(bound(toDecimals, 1, 18));
    amount = bound(amount, 1, type(uint128).max);
    
    // 精度转换不应溢出
    uint256 converted = converter.convert(amount, fromDecimals, toDecimals);
    // 反向转换应接近原值
    uint256 roundTrip = converter.convert(converted, toDecimals, fromDecimals);
    assertApproxEqAbs(roundTrip, amount, 10 ** uint256(fromDecimals > toDecimals ? fromDecimals - toDecimals : 0));
}
```

**Configuration:**
```toml
# foundry.toml
[fuzz]
runs = 10000        # 默认256太少，推荐10000
max_test_rejects = 65536
```

### Layer 3: Fork Tests

**MUST for external protocol integrations.** Test against real protocol state.

```solidity
contract ForkTest is Test {
    function setUp() public {
        // Fork HashKey Chain testnet at specific block for reproducibility
        vm.createSelectFork("https://testnet.hsk.xyz", 12345678);
    }
    
    function test_swapOnDex() public {
        // Test against real DEX state
        // ...
    }
    
    function test_chainlinkPriceFeed() public {
        // Test against real Chainlink data
        (, int256 price,,,) = priceFeed.latestRoundData();
        assertGt(price, 0);
    }
}
```

**CRITICAL: Always pin to a specific block number.** Unpinned fork tests are non-reproducible.

**HashKey Chain RPC endpoints:**
- Testnet: `https://testnet.hsk.xyz` (Chain ID 133)
- Mainnet: `https://mainnet.hsk.xyz` (Chain ID 177)

### Layer 4: Invariant Tests

**MUST for core financial logic.** Thousands of random call sequences to find state violations.

```solidity
// Handler contract — defines possible actions
contract VaultHandler is Test {
    Vault public vault;
    uint256 public ghost_totalDeposited;
    uint256 public ghost_totalWithdrawn;
    
    function deposit(uint256 amount) public {
        amount = bound(amount, 1, 1000e18);
        deal(address(token), msg.sender, amount);
        vm.prank(msg.sender);
        vault.deposit(amount);
        ghost_totalDeposited += amount;
    }
    
    function withdraw(uint256 amount) public {
        amount = bound(amount, 0, vault.balanceOf(msg.sender));
        vm.prank(msg.sender);
        vault.withdraw(amount);
        ghost_totalWithdrawn += amount;
    }
}

// Invariant test
contract VaultInvariantTest is Test {
    function setUp() public {
        // Setup handler and target
        targetContract(address(handler));
    }
    
    // 金库总资产应等于总存入减去总提取
    function invariant_conservationOfAssets() public {
        assertEq(
            token.balanceOf(address(vault)),
            handler.ghost_totalDeposited() - handler.ghost_totalWithdrawn()
        );
    }
}
```

**Configuration:**
```toml
# foundry.toml
[invariant]
runs = 256
depth = 100
fail_on_revert = false
```

## Gas Snapshot Testing

```bash
# Create baseline
forge snapshot

# After changes, compare
forge snapshot --diff

# In CI (GitHub Actions)
forge snapshot --check
```

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Unpinned fork block | Always use specific block number |
| Insufficient fuzz runs | Set `runs = 10000` in foundry.toml |
| Testing with `deal()` | Use proper mint/transfer to catch hooks |
| Ignoring `vm.warp` | Always advance time for time-dependent logic |
| Missing `vm.roll` | Advance block number for block-dependent logic |
| HSK vs ETH assumption | Native token is HSK on HashKey Chain |
| No approve before transfer | Call `approve()` before `transferFrom()` |
| Testing only happy path | Test pause state, access denial, edge cases |
| L2 block time assumption | HSK L2 blocks ~2s, not 12s — adjust `vm.warp`/`vm.roll` ratios |

## Anvil and HSK Custom Gas Token

Anvil defaults to ETH as native token. For HashKey Chain testing:

**Strategy 1: Accept ETH in local tests (recommended for unit/fuzz tests)**

Most contract logic is gas-token-agnostic. Use standard anvil and note that `msg.value` represents HSK in production. Add comments to clarify:

```solidity
vault.deposit{value: 1 ether}(); // On HSK Chain this is 1 HSK, not 1 ETH
```

**Strategy 2: Fork HSK testnet (required for integration/fork tests)**

When testing gas estimation, native balance display, or bridge interactions:

```bash
# Fork HSK testnet for real gas token behavior
anvil --fork-url https://testnet.hsk.xyz --fork-block-number <BLOCK>
```

**What differs with custom gas token:**
- Gas price oracle returns HSK-denominated values
- `address(this).balance` returns HSK balance
- `msg.value` is HSK amount
- ETH on L2 is a wrapped ERC-20, not native

**What stays the same:**
- All Solidity logic, `vm.deal`, `vm.prank`, storage operations
- ERC-20 interactions (including wrapped ETH)
- Contract deployment and function calls

## What NOT to Test

- Getter functions with no logic
- OpenZeppelin internal implementations
- Standard ERC-20/721 mechanics (unless custom logic)
- Third-party library internals

## Integration

**Required with:**
- **hsk-superpowers:test-driven-development** — TDD cycle (this skill adds blockchain layers)

**Pairs with:**
- **hsk-superpowers:smart-contract-security** — Security patterns to test
- **hsk-superpowers:contract-upgrade** — Fork test upgrade patterns
- **hsk-superpowers:gas-optimization** — Gas snapshot testing
