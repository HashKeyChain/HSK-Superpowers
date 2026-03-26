---
name: incident-response
description: "Use when a deployed contract is under attack, behaving abnormally, or a security vulnerability is discovered - guides emergency response procedures for HashKey Chain L2"
---

# Incident Response

Guide emergency response for security incidents on HashKey Chain L2 deployed contracts.

**Announce at start:** "INCIDENT RESPONSE ACTIVATED. Following emergency procedures."

**Core principle:** Speed matters, but panic causes worse damage. Follow the process.

## When to Use

- Contract is under active attack
- Unusual transaction patterns detected
- Security vulnerability discovered in deployed code
- Funds at risk or already lost
- Compliance violation detected

## Response Flow

```
DISCOVER → ASSESS → CONTAIN → FIX → RECOVER → REVIEW
  (min)     (min)    (min)    (hrs)   (hrs)    (days)
```

## Phase 1: DISCOVER (Minutes)

**Who detected it?**
- Monitoring alert (events, balance changes)
- User report
- Security researcher
- Internal discovery
- Media/social media

**Immediately:**
1. Note the current time (UTC)
2. Note the transaction hash(es) involved
3. Note the contract address(es) affected
4. Alert the on-call team

## Phase 2: ASSESS (Minutes)

**Determine severity:**

| Severity | Description | Response Time |
|----------|-------------|---------------|
| P0 — Critical | Active exploit, funds draining | Immediate |
| P1 — High | Vulnerability found, exploitable | < 1 hour |
| P2 — Medium | Bug found, potential risk | < 4 hours |
| P3 — Low | Minor issue, no immediate risk | < 24 hours |

**For P0/P1:**
- Skip detailed analysis, go directly to CONTAIN
- Analyze in parallel with containment

**Analysis:**
```bash
# 查看可疑交易
cast tx <TX_HASH> --rpc-url https://mainnet.hsk.xyz

# 查看合约状态
cast call <CONTRACT> "balanceOf(address)" <ATTACKER> --rpc-url https://mainnet.hsk.xyz

# 查看最近交易
cast logs --address <CONTRACT> --from-block <BLOCK-100> --rpc-url https://mainnet.hsk.xyz
```

## Phase 3: CONTAIN (Minutes)

**Immediate containment actions (P0/P1):**

### Action 1: Pause Contracts
```bash
# 通过 Safe multi-sig 紧急暂停
# Guardian 角色可以单签暂停（如果配置了）
cast send <CONTRACT> "pause()" --private-key $GUARDIAN_KEY --rpc-url https://mainnet.hsk.xyz
```

### Action 2: Disable Frontend
- Take down the frontend/dApp UI
- Display maintenance notice
- Remove contract interaction buttons

### Action 3: Protect Remaining Funds
- If funds can be rescued, prepare rescue transaction
- If bridge is involved, contact OP Stack bridge operators
- Move funds to Safe multi-sig if possible

### Action 4: Block Attacker (if known)
```solidity
// 如果合约有黑名单功能
contract.freezeAddress(attackerAddress);
```

## Phase 4: FIX (Hours)

1. **Root cause analysis:**
   - Which function was exploited?
   - What was the attack vector?
   - Are other contracts affected?

2. **Prepare fix:**
   - Write fix on a branch
   - Write test reproducing the vulnerability
   - Verify fix passes the test
   - Run full test suite

3. **Emergency upgrade (if UUPS proxy):**
   ```bash
   # Test fix on fork
   forge test --fork-url https://mainnet.hsk.xyz -vvv
   
   # Deploy new implementation to testnet first
   forge script script/UpgradeFix.s.sol --rpc-url https://testnet.hsk.xyz --broadcast
   
   # Deploy to mainnet via Safe
   forge script script/UpgradeFix.s.sol --rpc-url https://mainnet.hsk.xyz
   # Submit to Safe multi-sig for execution
   ```

4. **If not upgradeable:**
   - Deploy new contract
   - Plan migration of state/funds
   - Longer recovery process

## Phase 5: RECOVER (Hours)

1. **Verify fix:**
   - Confirm vulnerability is patched
   - Run additional tests on fork
   - Independent review of fix

2. **Unpause gradually:**
   - Unpause on testnet first
   - Monitor for any issues
   - Unpause mainnet

3. **User communication:**
   - Notify affected users
   - Explain what happened (without revealing exploit details initially)
   - Provide timeline for full recovery

4. **Fund recovery (if applicable):**
   - Track stolen funds
   - Contact exchanges for freezing
   - Engage law enforcement if needed
   - Consider white-hat negotiation

## Phase 6: REVIEW (Days)

1. **Post-incident report:**
   ```markdown
   # Incident Report: [Title]
   
   **Date:** [UTC time of discovery]
   **Severity:** [P0-P3]
   **Duration:** [Discovery to resolution]
   **Impact:** [Funds lost, users affected]
   
   ## Timeline
   - [Time] Discovery
   - [Time] Assessment
   - [Time] Containment
   - [Time] Fix deployed
   - [Time] Recovery complete
   
   ## Root Cause
   [Technical explanation]
   
   ## Fix
   [What was changed]
   
   ## Lessons Learned
   [What to improve]
   
   ## Action Items
   - [ ] [Improvement 1]
   - [ ] [Improvement 2]
   ```

2. **Process improvements:**
   - Update monitoring to catch similar issues
   - Add test cases for the vulnerability class
   - Review all contracts for similar patterns
   - Update security checklist

3. **External audit:**
   - Request SlowMist re-audit for affected contracts
   - Share anonymized findings with community

## Communication Templates

**Internal escalation (Slack/WeChat):**
```
🚨 SECURITY INCIDENT — [P0/P1/P2/P3]
Contract: [ADDRESS]
Issue: [Brief description]
Status: [ASSESSING/CONTAINING/FIXING/RECOVERING]
Lead: [Person]
Action needed: [What team needs to do]
```

**User-facing announcement:**
```
We are aware of an issue affecting [SERVICE].
We have paused the affected contracts as a precaution.
User funds are [safe/being assessed].
We will provide updates as the situation develops.
```

## Emergency Contacts

Maintain an up-to-date emergency contact list:
- Internal security team lead
- SlowMist emergency contact
- HashKey Chain team contact
- Legal counsel
- PR/communications team

## Integration

**Required with:**
- **hsk-superpowers:smart-contract-security** — Prevention is better than cure
- **hsk-superpowers:contract-upgrade** — Emergency upgrade procedures

**Pairs with:**
- **hsk-superpowers:l2-deployment** — Rollback procedures
- **hsk-superpowers:compliance-check** — Compliance incident handling
- **hsk-superpowers:cross-chain** — Bridge incident procedures

## Red Flags

**Never:**
- Panic and make changes without a plan
- Deploy fixes without testing on fork first
- Communicate exploit details publicly before fix is deployed
- Blame team members during incident
- Skip the post-incident review
- Assume "it can't happen to us"
