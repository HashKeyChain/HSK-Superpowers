---
name: contract-upgrade
description: "Use when upgrading UUPS proxy contracts - guides storage layout verification, Timelock integration, upgrade scripting, and rollback planning"
---

# Contract Upgrade

Guide safe upgrades of UUPS proxy contracts on HashKey Chain L2.

**Announce at start:** "I'm using the contract-upgrade skill for proxy upgrade workflow."

**Core principle:** An upgrade is a deployment with extra risk. Storage corruption is irrecoverable.

## When to Use

- Upgrading a UUPS proxy contract to a new implementation
- Planning a contract migration
- Adding Timelock governance to existing contracts
- Emergency upgrade (vulnerability discovered)

## Pre-Upgrade Checklist

- [ ] Storage layout comparison (`forge inspect`)
- [ ] New implementation compiles and all tests pass
- [ ] Fork test of the upgrade on testnet fork
- [ ] Upgrade script tested on Anvil
- [ ] Rollback plan documented
- [ ] Timelock proposal prepared (if using Timelock)

## Storage Layout Verification

**This is the most critical step. Storage corruption = permanent data loss.**

```bash
# Export current implementation storage layout
forge inspect src/ContractV1.sol:ContractV1 storage-layout > layout-v1.json

# Export new implementation storage layout
forge inspect src/ContractV2.sol:ContractV2 storage-layout > layout-v2.json

# Compare manually or with tooling
diff layout-v1.json layout-v2.json
```

**Rules:**
- NEVER change the order of existing storage variables
- NEVER delete existing storage variables
- NEVER change the type of existing storage variables
- New variables MUST be added at the END
- Use storage gaps (`uint256[50] private __gap`) for future-proofing

```solidity
// BAD: Changed order
contract V2 {
    uint256 public newVar;  // 插入到了前面!
    uint256 public totalSupply;
    mapping(address => uint256) public balances;
}

// GOOD: Appended at end
contract V2 {
    uint256 public totalSupply;
    mapping(address => uint256) public balances;
    uint256 public newVar;  // 新变量在最后
}
```

## Upgrade Script Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract Upgrade is Script {
    function run() external {
        address proxy = vm.envAddress("PROXY_ADDRESS");
        
        vm.startBroadcast();
        
        // 1. Deploy new implementation
        ContractV2 newImpl = new ContractV2();
        
        // 2. Upgrade proxy to new implementation
        UUPSUpgradeable(proxy).upgradeToAndCall(
            address(newImpl),
            "" // 或者 abi.encodeCall(ContractV2.initializeV2, (...))
        );
        
        vm.stopBroadcast();
        
        // 3. Verify upgrade (read implementation from EIP-1967 storage slot)
        bytes32 implSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        address currentImpl = address(uint160(uint256(vm.load(proxy, implSlot))));
        assert(currentImpl == address(newImpl));
    }
}
```

## Fork Test Upgrade

**MUST test every upgrade on a fork before deploying:**

```solidity
function test_upgradePreservesState() public {
    // Fork testnet at a specific block (CRITICAL: always pin block number)
    vm.createSelectFork("https://testnet.hsk.xyz", 1000000);
    
    // Record state before upgrade
    uint256 totalSupplyBefore = token.totalSupply();
    uint256 userBalanceBefore = token.balanceOf(user);
    
    // Perform upgrade
    vm.prank(owner);
    UUPSUpgradeable(proxy).upgradeToAndCall(address(newImpl), "");
    
    // Verify state preserved
    assertEq(token.totalSupply(), totalSupplyBefore);
    assertEq(token.balanceOf(user), userBalanceBefore);
    
    // Verify new functionality works
    // ...
}
```

## Timelock Integration

The team plans to introduce Timelock governance. Pattern:

```
1. Propose upgrade via Timelock
2. Wait for delay period (e.g., 48 hours)
3. Execute upgrade after delay
4. Guardian can cancel during delay if issues found
```

```solidity
// TimelockController as upgrade authority
constructor() {
    // Timelock is the only address that can upgrade
    _transferOwnership(address(timelockController));
}

function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
    // onlyOwner = only Timelock can call this
}
```

**Safe + Timelock combination:**
- Safe multi-sig proposes to Timelock
- Timelock enforces delay
- Guardian (separate Safe) can cancel
- After delay, anyone can execute

## Emergency Upgrade

When a vulnerability is discovered in production:

1. **Immediately:** Pause the contract via Guardian
2. **Prepare:** Write fix, test on fork
3. **Deploy:** New implementation to testnet, verify
4. **Execute:** Emergency upgrade via Safe multi-sig (may bypass Timelock if Guardian role allows)
5. **Verify:** State integrity check
6. **Unpause:** After verification

## Rollback Plan

Every upgrade MUST have a rollback plan:

1. **Revert upgrade:** Deploy previous implementation, upgrade proxy back
2. **State check:** Verify no state corruption after rollback
3. **Pause if needed:** If state is corrupted, pause and plan migration

## Integration

**Required with:**
- **hsk-superpowers:smart-contract-security** — Security review of new implementation
- **hsk-superpowers:l2-deployment** — Deployment workflow for upgrade
- **hsk-superpowers:verification-before-completion** — Verify state after upgrade

**Pairs with:**
- **hsk-superpowers:incident-response** — Emergency upgrade procedures
- **hsk-superpowers:onchain-testing** — Fork test patterns for upgrades

## Red Flags

**Never:**
- Upgrade without storage layout verification
- Skip fork testing
- Upgrade mainnet without testnet verification
- Use EOA for upgrade execution in production
- Upgrade without a rollback plan
- Change storage variable order
- Delete existing storage variables
