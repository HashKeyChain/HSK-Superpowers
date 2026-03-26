---
name: compliance-check
description: "Use when building features that involve user identity, token transfers with restrictions, or regulatory requirements on HashKey Chain L2"
---

# Compliance Check

Guide compliance implementation for HashKey Chain L2, a licensed blockchain platform with KYC/AML, ERC-3643 Security Token, and sanctions screening requirements.

**Announce at start:** "I'm using the compliance-check skill for regulatory compliance."

**Core principle:** HashKey Chain is a licensed L2. Non-compliance is not a bug — it's a legal risk.

## When to Use

- Implementing features involving user identity or KYC
- Building token contracts with transfer restrictions
- Integrating ERC-3643 Security Token standard
- Implementing sanctions screening
- Handling user data that may be subject to privacy regulations
- Any feature that touches regulated financial activities

## Compliance Framework Overview

```
HashKey Chain Compliance Stack:
├── KYC/AML Layer
│   ├── Identity verification (offchain)
│   ├── Onchain identity attestation
│   └── Ongoing monitoring
├── Transfer Restriction Layer
│   ├── Whitelist/blacklist
│   ├── Geographic restrictions
│   ├── Holding limits
│   └── ERC-3643 compliance modules
├── Sanctions Screening
│   ├── OFAC/EU sanctions lists
│   ├── Blacklisted address registry
│   └── Real-time screening
└── Data Privacy
    ├── No PII onchain
    ├── Hashed identity references
    └── Right to erasure considerations
```

## KYC/AML Integration Patterns

**Pattern 1: Offchain verification + Onchain attestation**
```solidity
// 推荐模式：链下验证，链上存储验证状态
interface IIdentityRegistry {
    function isVerified(address user) external view returns (bool);
    function getVerificationLevel(address user) external view returns (uint8);
}

// 在转账前检查
modifier onlyVerified(address user) {
    require(identityRegistry.isVerified(user), "Identity not verified");
    _;
}
```

**Pattern 2: Claim-based identity (ERC-3643)**
```solidity
// 使用 Claim Topics 验证身份属性
function isCompliant(address user) public view returns (bool) {
    // Check KYC claim
    if (!identityRegistry.hasValidClaim(user, KYC_CLAIM_TOPIC)) return false;
    // Check not sanctioned
    if (sanctionsOracle.isSanctioned(user)) return false;
    return true;
}
```

## Transfer Restriction Patterns

```solidity
// ERC-3643 style transfer restriction
// NOTE: OpenZeppelin v5 uses _update() instead of _beforeTokenTransfer().
// Use _update(from, to, value) for OZ v5; _beforeTokenTransfer for OZ v4.
function _update(address from, address to, uint256 amount) internal virtual override {
    // Skip for minting/burning
    if (from == address(0) || to == address(0)) {
        super._update(from, to, amount);
        return;
    }
    
    // 1. Both parties must be verified
    require(identityRegistry.isVerified(from), "Sender not verified");
    require(identityRegistry.isVerified(to), "Receiver not verified");
    
    // 2. Check sanctions
    require(!sanctionsOracle.isSanctioned(from), "Sender sanctioned");
    require(!sanctionsOracle.isSanctioned(to), "Receiver sanctioned");
    
    // 3. Check compliance module rules
    require(complianceModule.canTransfer(from, to, amount), "Transfer not compliant");
}
```

## Sanctions Screening

```solidity
interface ISanctionsOracle {
    function isSanctioned(address addr) external view returns (bool);
}

// 在关键操作中检查
function deposit() external {
    require(!sanctionsOracle.isSanctioned(msg.sender), "Address sanctioned");
    // ...
}
```

## Data Privacy Rules

**MUST NOT store onchain:**
- Full names, addresses, phone numbers
- Government ID numbers
- Date of birth
- Any personally identifiable information (PII)

**CAN store onchain:**
- Hashed identity references (keccak256 of offchain ID)
- Verification status (bool/uint8)
- Claim attestations (topic + issuer + signature)

## Compliance Event Design

```solidity
// 合规相关事件必须完整发出，用于审计追踪
event IdentityVerified(address indexed user, uint8 level, uint256 timestamp);
event IdentityRevoked(address indexed user, string reason, uint256 timestamp);
event TransferRestricted(address indexed from, address indexed to, uint256 amount, string reason);
event SanctionsCheckFailed(address indexed user, uint256 timestamp);
event ComplianceModuleUpdated(address indexed oldModule, address indexed newModule);
```

## Compliance Checklist

- [ ] Identity verification integration points identified
- [ ] Transfer restrictions properly enforced
- [ ] Sanctions screening integrated where required
- [ ] No PII stored onchain
- [ ] Compliance events emitted for audit trail
- [ ] Compliance module upgradeable (if using ERC-3643)
- [ ] Error messages are clear but don't leak sensitive info
- [ ] Admin functions for compliance updates restricted to authorized roles
- [ ] Compliance test cases cover both positive and negative scenarios
- [ ] SlowMist audit scope includes compliance logic

## Integration

**Required with:**
- **hsk-superpowers:smart-contract-security** — Security review includes compliance checks
- **hsk-superpowers:erc3643-security-token** — For Security Token implementation

**Pairs with:**
- **hsk-superpowers:brainstorming** — Compliance questions during design
- **hsk-superpowers:event-design** — Compliance events for audit trail
- **hsk-superpowers:incident-response** — Compliance incident handling

## Red Flags

**Never:**
- Store PII onchain
- Skip sanctions screening for "internal" transfers
- Implement transfer restrictions that can be bypassed
- Deploy compliance contracts without audit
- Hardcode compliance rules (use upgradeable modules)
- Emit events that leak sensitive user data
