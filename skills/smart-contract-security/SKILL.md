---
name: smart-contract-security
description: "Use when writing, reviewing, or auditing Solidity code - enforces security patterns across all 9 risk categories for HashKey Chain L2 development"
---

# Smart Contract Security

Enforce security patterns before, during, and after writing Solidity code on **HashKey Chain L2** (OP Stack rollup, **HSK** as native gas token). Treat this skill as the security bar for internal review and external audit readiness (e.g. SlowMist).

**Announce at start:** "I'm using the smart-contract-security skill to enforce security patterns."

**Core principle:** Every line of Solidity code is a potential attack vector. Assume it is vulnerable until proven safe through design, tests, and tooling.

## When to Use

**Always:**

- Writing new Solidity code
- Modifying existing smart contracts
- Reviewing pull requests with `.sol` files
- Preparing for audit (internal or SlowMist)

**Never skip because:**

- "It's a simple contract" — simple contracts still handle real value
- "OpenZeppelin handles it" — integration and composition bugs are a top source of incidents
- "We'll audit later" — prevention is orders of magnitude cheaper than post-deployment remediation

## The 9 Risk Categories

Every piece of Solidity code **MUST** be evaluated against **all 9** categories below. Skipping any category is unacceptable for production code.

### 1. Reentrancy

```
IRON RULE: ReentrancyGuard or CEI pattern on EVERY function with external calls
```

```solidity
// BAD: state updated after external call
function withdraw() external {
    uint256 amount = balances[msg.sender];
    (bool success,) = msg.sender.call{value: amount}("");
    require(success);
    balances[msg.sender] = 0; // attacker can reenter before this runs
}

// GOOD: Checks-Effects-Interactions + ReentrancyGuard
function withdraw() external nonReentrant {
    uint256 amount = balances[msg.sender];
    require(amount > 0, "No balance");
    balances[msg.sender] = 0; // effect BEFORE interaction
    (bool success,) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

**Also verify:**

- `call` / `delegatecall` / token hooks (`onERC721Received`, etc.) on the same trust boundary
- Cross-function reentrancy (state read in A while B is reentered)
- Read-only reentrancy where a view depends on mid-transaction inconsistent state

### 2. Access Control

- Use OpenZeppelin `AccessControl` for RBAC or `Ownable` only when a single owner is truly sufficient
- **NEVER** use `tx.origin` for authorization
- Separate roles where it matches ops: e.g. owner (governance), operator (daily ops), pauser (emergency)
- Production: contract admin should be a **Safe** (or equivalent multi-sig), not a single EOA
- Document who can call what; protect `initialize` / upgrade / mint / pause paths explicitly

### 3. Oracle Manipulation

```solidity
// BAD: DEX spot price (flash-loan manipulable)
(uint160 sqrtPriceX96,,,,,,) = uniswapPool.slot0();
uint256 price = sqrtPriceX96; // DO NOT use this as a price oracle

// GOOD: Chainlink (or approved feed) with staleness bounds
(, int256 price,, uint256 updatedAt,) = priceFeed.latestRoundData();
require(price > 0, "Invalid price");
require(block.timestamp - updatedAt < 3600, "Stale price"); // tune per asset / heartbeat
```

**Also verify:**

- L2 sequencer uptime / fallback behavior if oracles or messaging depend on timing
- TWAP vs spot tradeoffs; liquidity depth vs manipulation cost

### 4. Flash Loan Attack

- Any logic that reads pool or vault ratios and acts in the same transaction is high risk
- Prefer **time-weighted** or **manipulation-resistant** metrics over spot snapshots
- Consider per-block or per-transaction limits, delays, or caps where economics allow
- Document assumed attacker capital and liquidity for critical pricing paths

### 5. MEV / Sandwich Attack

- Swap paths **MUST** include slippage bounds (`amountOutMin` or equivalent)
- Time-sensitive user actions **MUST** include **deadline** (or expiring signatures)
- Sensitive ordering: consider commit–reveal, private mempools, or batching patterns where applicable
- Document frontrunning assumptions for auctions, liquidations, and public `swap`-like entrypoints

### 6. Token Precision

```
IRON RULE: NEVER hardcode token decimals. ALWAYS query decimals() (or a vetted registry).
```

```solidity
// BAD
uint256 amount = 1000 * 1e18; // USDC is 6 decimals!

// GOOD
uint256 amount = 1000 * (10 ** IERC20Metadata(token).decimals());
```

**Rules:**

- USDC = 6, WETH = 18, WBTC = 8 — **never** assume without reading metadata
- Use **SafeERC20** for all ERC-20 transfers/approvals (e.g. USDT non-standard return values)
- **HSK** (native gas token on HashKey Chain L2) uses **18** decimals — still do not hardcode user-supplied token paths the same way as a single known asset

### 7. Upgrade Safety (UUPS / Proxies)

- **Storage layout:** never reorder or delete existing storage variables; append-only for upgrades
- **Never** rename or change type width of existing layout slots in a way that corrupts storage
- Run `forge inspect <Contract> storage-layout` (or project equivalent) and compare across versions
- `_authorizeUpgrade` **MUST** be restricted to owner / timelock / governance as designed
- Initializers **MUST** use `initializer` / `reinitializer` correctly; no second init on implementation
- Test upgrades on **fork** (including state migration scripts) before mainnet-style deploys

### 8. Key Management

```
IRON RULE: ZERO tolerance for key exposure
```

- No private keys in source, `.env` committed to git, CI logs, or screenshots
- No long-lived production secrets in client-side or public config
- Deployer and admin addresses from deployment manifests / env injection — not pasted literals in Solidity except immutable **audited** constants with clear rationale
- Production ownership transfer targets verified (Safe address, correct chain id)
- Rotate and revoke any key that may have leaked; treat git history as public

### 9. Compliance

- **ERC-3643** (or similar) transfer restrictions **MUST** be enforced end-to-end if the asset requires it
- KYC / AML gates **MUST** match product and jurisdiction requirements before sensitive transfers
- Sanctions / denylist flows **MUST** be integrated where legally required
- **No PII** onchain; hashes or off-chain attestations only where appropriate
- Emit **compliance-relevant events** for audit trails (freeze, force transfer, allowance changes, etc.)

## Pre-Code Checklist

Before writing **any** Solidity code, verify:

- [ ] `SafeERC20` imported and used for all token interactions
- [ ] `ReentrancyGuard` (or equivalent) planned if any untrusted external call exists
- [ ] Access control model chosen (`Ownable` / `AccessControl` / `AccessManager` / custom with review)
- [ ] NatSpec planned (`@dev`, `@param`, `@return` for public / external surface)
- [ ] Events designed for security-relevant and user-relevant state changes
- [ ] Emergency path chosen (`Pausable`, circuit breaker, guardian role, etc.)
- [ ] Token decimals strategy defined (dynamic via metadata or trusted registry — not magic numbers)

## Post-Code Checklist

After completing **any** Solidity change set, verify:

- [ ] All **9** risk categories reviewed with notes or ticket links
- [ ] `forge build` succeeds; **zero** ignored compiler warnings for production paths
- [ ] `forge test` passes including fuzz / invariant / fork tests where applicable (`-vvv` for debugging failures)
- [ ] `forge snapshot` baseline updated if gas regressions matter for the change
- [ ] Static analysis: Slither, Mythril, Aderyn (or project-standard equivalents) run on touched contracts
- [ ] NatSpec complete on all public / external functions
- [ ] No unjustified hardcoded addresses or decimals
- [ ] No secrets or keys in repo history for this change
- [ ] State-changing paths emit events as designed
- [ ] Emergency flows tested (pause / unpause / guardian / upgrade abort paths)

## Static Analysis Tools

Run **all** tools available in your pipeline; do not ship based on a single tool.

```bash
# Slither — fast, good for known patterns
slither .

# Mythril — symbolic execution; deeper, slower
myth analyze src/Contract.sol

# Aderyn — Rust-based; additional detectors
aderyn .
```

**Gate:**

- **Zero** High-severity findings required before production deploy
- **Medium** findings **MUST** be triaged: fix, document accepted risk with signer approval, or defer with explicit timeline — never silently ignore

## Integration

**Required with:**

- **hsk-superpowers:test-driven-development** — TDD for security fixes and regressions
- **hsk-superpowers:onchain-testing** — fuzz, fork, and invariant patterns (if present in your skill set)
- **hsk-superpowers:verification-before-completion** — evidence before claiming "safe" or "done"

**Pairs with:**

- **hsk-superpowers:compliance-check** — KYC / AML / ERC-3643 alignment
- **hsk-superpowers:contract-upgrade** — UUPS and storage layout discipline
- **hsk-superpowers:gas-optimization** — balance gas with safety (no unsafe "optimizations")
- **hsk-superpowers:incident-response** — when issues are found post-deployment

## Red Flags — STOP

- Deploying without static analysis
- Skipping fuzz tests on non-trivial math and share accounting
- Using DEX spot price as a primary oracle
- Hardcoding token decimals for arbitrary tokens
- Missing reentrancy protection on paths with external calls
- Single EOA as sole owner in production for valuable contracts
- Private keys or seed phrases anywhere in git or shared channels
- "We'll fix it in the next version" for **security** defects

**All of these mean: STOP. Fix or formally mitigate before proceeding.**
