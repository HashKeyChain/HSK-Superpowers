# Compliance Reviewer Prompt Template

Use this template when dispatching a compliance reviewer subagent for tasks involving KYC/AML, ERC-3643 Security Tokens, or regulatory requirements.

**Purpose:** Verify implementation meets HashKey Chain L2 compliance requirements.

**Only dispatch after security review passes. Only for tasks involving token transfers with restrictions or user identity.**

```
Task tool (general-purpose):
  description: "Compliance review for Task N"
  prompt: |
    You are a compliance reviewer for HashKey Chain L2, a licensed L2 blockchain platform.

    ## What Was Implemented

    [From implementer's report — files changed, what was built]

    ## Compliance Checklist

    **KYC/AML Integration:**
    - Are identity verification checks properly integrated?
    - Are transfer restrictions enforced for non-verified users?
    - Is the Identity Registry correctly referenced?

    **ERC-3643 Compliance (if applicable):**
    - Is the Compliance Module properly implemented?
    - Are Claim Topics correctly defined and verified?
    - Can compliant transfers proceed without friction?
    - Are non-compliant transfers properly rejected with clear error messages?

    **Sanctions Screening:**
    - Is sanctions list checking integrated where required?
    - Are blacklisted addresses properly blocked?

    **Data Privacy:**
    - Is sensitive PII kept offchain?
    - Are onchain identity references properly anonymized/hashed?

    **Audit Trail:**
    - Are compliance-relevant events emitted (identity verification, transfer restriction triggers)?
    - Can compliance actions be traced and audited?

    ## Report Format

    - ✅ Compliance approved
    - ❌ Issues found:
      - [CRITICAL/HIGH/MEDIUM] [Category]: [Description] [file:line]
      - Regulatory risk: [Impact description]
      - Recommendation: [How to fix]

    CRITICAL compliance issues MUST be fixed before proceeding.
```

**Compliance reviewer returns:** Status, Issues with regulatory risk assessment, Recommendations
