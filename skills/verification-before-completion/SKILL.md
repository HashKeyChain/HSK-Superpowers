---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |
| Contracts compile | `forge build` exit 0 | "Code looks right", "Should compile" |
| All tests pass (incl. fuzz) | `forge test -vvv` output: 0 failures | Unit tests only, skipped fuzz/fork |
| Static analysis clean | Slither output: 0 High severity | "Looks safe", "No obvious issues" |
| Gas regression OK | `forge snapshot --diff` no regression | Previous snapshot, "Gas should be fine" |
| Contract source verified | Block explorer shows verified source | "Will verify later" |
| NatSpec complete | All public/external have @dev @param @return | "Documentation is there" |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion ≠ excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**
```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**Agent delegation:**
```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust agent report
```

## Smart Contract Verification

For Solidity projects on HashKey Chain L2, the verification bar is higher due to irreversibility of deployed code.

**Before claiming any smart contract work is complete:**

```
1. forge build              → exit 0, no warnings
2. forge test -vvv          → ALL pass (unit + fuzz + fork + invariant)
3. forge snapshot --diff    → no unexpected gas regression
4. slither .                → 0 High, review all Medium (if slither available)
5. NatSpec check            → all public/external functions documented
6. No secrets in git        → git log search for private keys/mnemonics
```

**All 6 checks MUST pass before ANY completion claim.**

Skipping any check because "it's just a small change" = violation. Small changes cause the biggest production incidents in smart contracts.

## Frontend Verification

For Next.js dApp frontend projects:

```
1. npm run build           → exit 0 (Next.js production build)
2. npx tsc --noEmit        → exit 0 (TypeScript type check)
3. npm run lint             → exit 0 (ESLint clean)
4. npm test                 → ALL pass (vitest unit tests)
5. npx wagmi generate       → exit 0 (ABI types up to date)
```

All 5 checks MUST pass. "TypeScript passes" does NOT mean "build passes" — Next.js build catches additional issues.

## Go Backend Verification

For Go blockchain service projects:

```
1. go build ./...           → exit 0 (compilation)
2. go test -short ./...     → ALL pass (unit tests)
3. go vet ./...             → exit 0 (static analysis)
4. golangci-lint run        → exit 0 (if available)
5. go generate ./...        → exit 0 (abigen bindings up to date)
```

All checks MUST pass. "Tests pass" does NOT mean "build passes" — go vet catches issues tests miss.

## Docker Verification

When the project uses Docker deployment:

```
1. docker build -t test .   → exit 0 (image builds successfully)
```

A Dockerfile that doesn't build is NOT "ready for deployment."

## Why This Matters

From 24 failure memories:
- your human partner said "I don't believe you" - trust broken
- Undefined functions shipped - would crash
- Missing requirements shipped - incomplete features
- Time wasted on false completion → redirect → rework
- Violates: "Honesty is a core value. If you lie, you'll be replaced."

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.
