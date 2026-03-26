---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting structured options for merge, PR, or cleanup
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests → Present options → Execute choice → Clean up.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**If tests fail:**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 1.5.

### Step 1.5: Smart Contract Security Gate

**If the project has no `.sol` files:** Skip to Step 2.

**If project contains `.sol` files, perform these additional checks before presenting options:**

```bash
# 1. Compile clean
forge build

# 2. Full test suite including fuzz/fork/invariant
forge test -vvv

# 3. Gas regression check
forge snapshot --diff

# 4. Static analysis (if available)
slither . 2>&1 | grep -E "High|Medium"

# 5. No secrets in git history
git log --all -p | grep -iE "(private.?key|mnemonic|secret)" | head -5

# 6. NatSpec completeness (manual review of public functions)
```

**If any gate fails:**

```
Security gate failed:
- [List specific failures]

Must fix before completing. Cannot proceed to merge/PR.
```

Stop. Don't proceed to Step 2.

**If all gates pass:** Continue to Step 2.

### Step 1.6: Audit Gate (for high-risk contract changes)

For changes touching core financial logic, token contracts, or access control:

```
Has this change been reviewed by:
1. Internal security review? [Required]
2. SlowMist external audit? [Required for mainnet deployment of new contracts]
3. Compliance review? [Required if KYC/AML/ERC-3643 involved]

If any required review is pending, recommend Option 3 (Keep as-is) until reviews complete.
```

### Step 2: Determine Base Branch

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main - is that correct?"

### Step 3: Present Options

Present exactly these 4 options:

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Don't add explanation** - keep options concise.

### Step 4: Execute Choice

#### Option 1: Merge Locally

```bash
# Switch to base branch
git checkout <base-branch>

# Pull latest
git pull

# Merge feature branch
git merge <feature-branch>

# Verify tests on merged result
<test command>

# If tests pass
git branch -d <feature-branch>
```

Then: Cleanup worktree (Step 5)

#### Option 2: Push and Create PR

```bash
# Push branch
git push -u origin <feature-branch>

# Create PR
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>

## Security (for Solidity changes)
- [ ] `forge build` compiles clean
- [ ] `forge test -vvv` all pass (unit + fuzz + fork + invariant)
- [ ] `forge snapshot --diff` no unexpected regression
- [ ] Slither: 0 High severity findings
- [ ] NatSpec complete on all public/external functions
- [ ] No secrets in commits
- [ ] Internal security review completed

## Compliance (if applicable)
- [ ] KYC/AML integration verified
- [ ] ERC-3643 transfer restrictions tested
- [ ] Sanctions screening logic verified
EOF
)"
```

Then: Cleanup worktree (Step 5)

#### Option 3: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

**Don't cleanup worktree.**

#### Option 4: Discard

**Confirm first:**
```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact confirmation.

If confirmed:
```bash
git checkout <base-branch>
git branch -D <feature-branch>
```

Then: Cleanup worktree (Step 5)

### Step 5: Cleanup Worktree

**For Options 1 and 4:**

Check if in worktree:
```bash
git worktree list | grep $(git branch --show-current)
```

If yes:
```bash
git worktree remove <worktree-path>
```

**For Option 3:** Keep worktree.

## Quick Reference

| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | ✓ | - | - | ✓ |
| 2. Create PR | - | ✓ | ✓ | - |
| 3. Keep as-is | - | - | ✓ | - |
| 4. Discard | - | - | - | ✓ (force) |

## Common Mistakes

**Skipping test verification**
- **Problem:** Merge broken code, create failing PR
- **Fix:** Always verify tests before offering options

**Open-ended questions**
- **Problem:** "What should I do next?" → ambiguous
- **Fix:** Present exactly 4 structured options

**Automatic worktree cleanup**
- **Problem:** Remove worktree when might need it (Option 2, 3)
- **Fix:** Only cleanup for Options 1 and 4

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require typed "discard" confirmation

## Red Flags

**Never:**
- Proceed with failing tests
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request

**Always:**
- Verify tests before offering options
- Present exactly 4 options
- Get typed confirmation for Option 4
- Clean up worktree for Options 1 & 4 only

## Integration

**Called by:**
- `hsk-superpowers:subagent-driven-development` — After all tasks complete
- `hsk-superpowers:executing-plans` — After all batches complete

**Pairs with:**
- `hsk-superpowers:using-git-worktrees` — Cleans up worktree created by that skill
- `hsk-superpowers:fullstack-deploy` — Deployment follows after branch completion
- `hsk-superpowers:verification-before-completion` — Must verify before finishing
