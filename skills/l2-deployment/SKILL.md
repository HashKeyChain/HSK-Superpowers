---
name: l2-deployment
description: "Use when deploying smart contracts to HashKey Chain L2 - guides the full Anvil-to-testnet-to-mainnet deployment workflow with Safe multi-sig"
---

# L2 Deployment

Guide the complete deployment lifecycle for smart contracts on HashKey Chain L2 (OP Stack).

**Announce at start:** "I'm using the l2-deployment skill for deployment workflow."

**Core principle:** Deploy incrementally. Verify at every step. Never rush to mainnet.

## HashKey Chain Network Configuration

```
# Mainnet
Chain ID:    177
RPC:         https://mainnet.hsk.xyz
WSS:         wss://mainnet.hsk.xyz/ws
Gas Token:   HSK (not ETH)

# Testnet
Chain ID:    133
RPC:         https://testnet.hsk.xyz
WSS:         wss://testnet-ws.hsk.xyz
Gas Token:   HSK (testnet)
```

**foundry.toml configuration:**
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"  # Adjust per project

[rpc_endpoints]
hashkey_mainnet = "https://mainnet.hsk.xyz"
hashkey_testnet = "https://testnet.hsk.xyz"
localhost = "http://localhost:8545"

[etherscan]
hashkey_mainnet = { key = "${EXPLORER_API_KEY}", url = "https://explorer.hsk.xyz/api" }
hashkey_testnet = { key = "${EXPLORER_API_KEY}", url = "https://testnet-explorer.hsk.xyz/api" }
```

## Three-Step Deployment Flow

### Step 1: Anvil Local Testing

```bash
# Start local Anvil instance
anvil

# Deploy locally
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Run full test suite against local deployment
forge test -vvv
```

**Gate:** ALL tests pass locally before proceeding.

### Step 2: HashKey Chain Testnet (Chain ID 133)

```bash
# Deploy to testnet
forge script script/Deploy.s.sol \
  --rpc-url https://testnet.hsk.xyz \
  --broadcast \
  --verify

# Verify contract source
forge verify-contract <ADDRESS> src/Contract.sol:Contract \
  --chain-id 133 \
  --etherscan-api-key $EXPLORER_API_KEY
```

**Gate:** 
- Deployment successful
- Contract verified on block explorer
- Smoke tests pass on testnet
- Internal security review completed

### Step 3: HashKey Chain Mainnet (Chain ID 177) via Safe Multi-sig

```bash
# Generate deployment transaction (DO NOT broadcast directly)
forge script script/Deploy.s.sol \
  --rpc-url https://mainnet.hsk.xyz \
  --slow

# Submit to Safe multi-sig for execution
# NEVER deploy to mainnet with a single EOA key
```

**Gate:**
- SlowMist audit completed (for new contracts / high-risk changes)
- Safe multi-sig transaction proposed
- Required signatures collected
- Contract verified on mainnet block explorer
- Monitoring alerts configured

## Deployment Script Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy contracts
        // ...
        
        vm.stopBroadcast();
        
        // Log deployed addresses
        // ...
    }
}
```

**CRITICAL:** The `PRIVATE_KEY` environment variable MUST be:
- A dedicated deployer key (not personal wallet)
- For testnet: can be a single key
- For mainnet: MUST go through Safe multi-sig (the script generates the tx, Safe executes it)

## Safe Multi-sig Deployment

Production deployments MUST use Safe (Gnosis Safe):

1. **Propose transaction** via Safe Transaction Service or Safe UI
2. **Collect signatures** from required signers (minimum 2-of-3 or 3-of-5)
3. **Execute** the multi-sig transaction
4. **Verify** the deployed contract on block explorer

**Owner transfer after deployment:**
```solidity
// Transfer ownership to Safe multi-sig immediately after deployment
contract.transferOwnership(SAFE_ADDRESS);
```

## Pre-Deployment Checklist

Before ANY deployment (testnet or mainnet):

- [ ] `forge build` — compiles clean
- [ ] `forge test -vvv` — ALL pass (unit + fuzz + fork + invariant)
- [ ] `forge snapshot` — gas baseline established
- [ ] Static analysis — Slither + Mythril + Aderyn, 0 High
- [ ] NatSpec — all public/external functions documented
- [ ] Storage layout — compatible with previous version (if upgrade)
- [ ] No secrets in git history
- [ ] Deployment script tested on Anvil

**Additional for mainnet:**

- [ ] Internal security review completed
- [ ] SlowMist external audit completed (for new contracts)
- [ ] Safe multi-sig configured with correct signers
- [ ] Monitoring and alerting configured
- [ ] Rollback plan documented (pause mechanism, proxy downgrade)
- [ ] Emergency contacts and escalation path defined

## Monitoring Setup

Design monitoring for your deployed contracts:

**Event-based alerts (The Graph subgraph + custom indexer):**
- Large transfers (> threshold)
- Role changes (OwnershipTransferred, RoleGranted, RoleRevoked)
- Pause/Unpause events
- Contract upgrades (Upgraded event)
- Unusual activity patterns

**Infrastructure monitoring:**
- RPC endpoint health
- Block production monitoring
- Gas price spikes (HSK)

## Post-Deployment Verification

After EVERY deployment:

```bash
# Verify contract is deployed
cast code <ADDRESS> --rpc-url https://mainnet.hsk.xyz

# Verify key functions work
cast call <ADDRESS> "owner()" --rpc-url https://mainnet.hsk.xyz

# Verify contract is verified on explorer
# Check https://explorer.hsk.xyz/address/<ADDRESS>
```

## Rollback Plan

Every mainnet deployment MUST have a documented rollback plan:

1. **Pausable contracts:** Trigger pause via Safe multi-sig
2. **UUPS proxy:** Deploy previous implementation, upgrade via Safe
3. **Parameter changes:** Revert parameters via Safe multi-sig
4. **New contracts:** Pause + migrate users to previous version

## Integration

**Required with:**
- **hsk-superpowers:smart-contract-security** — Pre-deployment security checks
- **hsk-superpowers:verification-before-completion** — Evidence before claims

**Pairs with:**
- **hsk-superpowers:contract-upgrade** — For UUPS proxy upgrades
- **hsk-superpowers:incident-response** — When deployment goes wrong
- **hsk-superpowers:event-design** — Events for monitoring setup
- **hsk-superpowers:finishing-a-development-branch** — Deployment as final step

## Red Flags

**Never:**
- Deploy to mainnet without testnet verification
- Use a single EOA key for mainnet deployment
- Skip static analysis before deployment
- Deploy without a rollback plan
- Store deployment keys in git or config files
- Deploy without monitoring configured
- Rush deployment because of deadline pressure
