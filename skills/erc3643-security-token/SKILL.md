---
name: erc3643-security-token
description: "Use when implementing or integrating ERC-3643 (T-REX) Security Token standard for compliant token issuance on HashKey Chain L2"
---

# ERC-3643 Security Token

Guide implementation of ERC-3643 (T-REX) Security Token standard on HashKey Chain L2.

**Announce at start:** "I'm using the erc3643-security-token skill for Security Token implementation."

**Core principle:** Security Tokens are regulated financial instruments. Every transfer MUST be compliant.

## When to Use

- Implementing a new ERC-3643 compliant token
- Integrating with existing T-REX framework
- Building compliance modules for token transfers
- Setting up Identity Registry for token holders
- Planning token issuance on HashKey Chain (licensed platform)

## ERC-3643 Architecture Overview

```
ERC-3643 (T-REX) Stack:
├── Token Contract (ERC-20 + transfer restrictions)
│   └── Compliance check on every transfer
├── Identity Registry
│   ├── Maps addresses to onchain identities
│   └── Stores identity verification status
├── Identity Registry Storage
│   └── Persistent identity data
├── Compliance Module
│   ├── Transfer rules engine
│   ├── Country restrictions
│   ├── Holding limits
│   └── Time-based restrictions
├── Trusted Issuers Registry
│   └── Authorized claim issuers
└── Claim Topics Registry
    └── Required claim types (KYC, accreditation, etc.)
```

## Token Contract

```solidity
// ERC-3643 token inherits from ERC-20 with compliance hooks
interface IERC3643 {
    // 转账前检查合规性
    function canTransfer(address to, uint256 amount) external view returns (bool);
    
    // 带合规检查的转账
    function transfer(address to, uint256 amount) external returns (bool);
    
    // 身份注册表
    function identityRegistry() external view returns (IIdentityRegistry);
    
    // 合规模块
    function compliance() external view returns (ICompliance);
    
    // 暂停和恢复
    function pause() external;
    function unpause() external;
    
    // 强制转账（合规执法用途）
    function forcedTransfer(address from, address to, uint256 amount) external;
    
    // 冻结/解冻地址
    function freezeAddress(address user) external;
    function unfreezeAddress(address user) external;
}
```

## Identity Registry

```solidity
interface IIdentityRegistry {
    // 注册身份
    function registerIdentity(
        address user,
        IIdentity identity,
        uint16 country
    ) external;
    
    // 检查身份是否已验证
    function isVerified(address user) external view returns (bool);
    
    // 获取用户所在国家
    function investorCountry(address user) external view returns (uint16);
    
    // 身份验证事件
    event IdentityRegistered(address indexed user, IIdentity indexed identity);
    event IdentityRemoved(address indexed user, IIdentity indexed identity);
    event CountryUpdated(address indexed user, uint16 indexed country);
}
```

## Compliance Module

```solidity
interface ICompliance {
    // 检查转账是否合规
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);
    
    // 转账后更新合规状态
    function transferred(address from, address to, uint256 amount) external;
    
    // 添加/移除合规规则
    function addComplianceRule(address rule) external;
    function removeComplianceRule(address rule) external;
}
```

**Common compliance rules:**
- **Country restriction:** Block transfers to/from specific countries
- **Holding limit:** Maximum tokens per investor
- **Transfer limit:** Maximum transfer amount per period
- **Investor count limit:** Maximum number of token holders
- **Lock-up period:** Tokens locked until a specific date

## Deployment Order

```
1. Deploy Identity Registry Storage
2. Deploy Trusted Issuers Registry
3. Deploy Claim Topics Registry
4. Deploy Identity Registry (references 2, 3, storage)
5. Deploy Compliance Module (with rules)
6. Deploy Token Contract (references 4, 5)
7. Configure roles and permissions
8. Register initial identities
```

## Testing Patterns

```solidity
// 测试合规转账
function test_compliantTransfer() public {
    // 注册双方身份
    identityRegistry.registerIdentity(alice, aliceIdentity, 840); // US
    identityRegistry.registerIdentity(bob, bobIdentity, 840);     // US
    
    // 添加必要的 claims
    // addClaim(topic, scheme, issuer, signature, data, uri)
    aliceIdentity.addClaim(KYC_TOPIC, 1, issuer, signature, data, uri);
    bobIdentity.addClaim(KYC_TOPIC, 1, issuer, signature, data, uri);
    
    // 转账应成功
    vm.prank(alice);
    token.transfer(bob, 1000e18);
    assertEq(token.balanceOf(bob), 1000e18);
}

// 测试非合规转账被拒绝
function test_revertNonCompliantTransfer() public {
    // Bob 未注册身份
    vm.prank(alice);
    vm.expectRevert("Identity not verified");
    token.transfer(bob, 1000e18);
}

// 测试国家限制
function test_revertRestrictedCountry() public {
    identityRegistry.registerIdentity(charlie, charlieId, 408); // 受限国家
    complianceModule.addCountryRestriction(408);
    
    vm.prank(alice);
    vm.expectRevert("Country restricted");
    token.transfer(charlie, 1000e18);
}
```

## HashKey Chain Specifics

- HashKey is a **licensed platform** — compliance is not optional
- Token issuance may require regulatory approval
- Identity Registry should integrate with HashKey's KYC infrastructure
- Compliance modules should be upgradeable (regulations change)
- All compliance actions MUST emit events for audit trail
- SlowMist audit MUST cover compliance logic specifically

## Checklist

- [ ] Token contract implements ERC-3643 interface
- [ ] Identity Registry deployed and configured
- [ ] Compliance Module deployed with required rules
- [ ] Trusted Issuers Registry configured
- [ ] Claim Topics Registry configured
- [ ] Forced transfer function restricted to compliance officer role
- [ ] Freeze/unfreeze functions restricted to compliance officer role
- [ ] All compliance events emitted
- [ ] Transfer restriction tests cover all rules
- [ ] Negative tests for non-compliant transfers
- [ ] SlowMist audit includes compliance logic
- [ ] Regulatory approval obtained (if required)

## Integration

**Required with:**
- **hsk-superpowers:compliance-check** — Compliance framework
- **hsk-superpowers:smart-contract-security** — Security review

**Pairs with:**
- **hsk-superpowers:event-design** — Compliance events
- **hsk-superpowers:contract-upgrade** — Upgradeable compliance modules
- **hsk-superpowers:l2-deployment** — Deployment order matters
