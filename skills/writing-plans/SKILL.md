---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree. If one hasn't been created yet, use `hsk-superpowers:using-git-worktrees` to create one before writing the plan.

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

## Prerequisites

**REQUIRED:** If you are not already in a dedicated worktree, use `hsk-superpowers:using-git-worktrees` to create one NOW before writing the plan. Plans should be written and executed in isolation from the main branch.

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hsk-superpowers:subagent-driven-development (recommended) or hsk-superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies — for smart contracts default: Solidity (version per project), Foundry (forge/cast/anvil), OpenZeppelin Contracts (latest stable), Target: HashKey Chain L2 (OP Stack, HSK Gas Token, Chain ID 177/133)]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```

**For Solidity/Foundry projects, use this structure instead:**

### Task N: [Contract Name]

**Files:**
- Create: `src/ContractName.sol`
- Test: `test/ContractName.t.sol`
- Script: `script/DeployContractName.s.sol`

- [ ] **Step 1: Write the failing test**

```solidity
function test_specificBehavior() public {
    // arrange
    // act  
    // assert
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `forge test --match-test test_specificBehavior -vvv`
Expected: FAIL with "function not defined" or similar

- [ ] **Step 3: Write minimal implementation**

```solidity
// Implementation code
```

- [ ] **Step 4: Run test to verify it passes**

Run: `forge test --match-test test_specificBehavior -vvv`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ test/
git commit -m "feat: add specific feature"
```
````

## Remember
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills with @ syntax
- DRY, YAGNI, TDD, frequent commits

## Blockchain Plan Sections

When the plan involves smart contracts on HashKey Chain L2, include these additional sections:

**Contract Architecture (required for Solidity plans):**
- Number of contracts and their responsibilities (justify if >3)
- Proxy pattern: UUPS (default) or immutable with rationale
- Storage layout documentation plan
- Access control design (Ownable / AccessControl / AccessManager)
- Emergency mechanisms (Pausable / circuit breaker / Guardian)
- NatSpec documentation: STRICT mode — every external/public function MUST have @dev, @param, @return

**Deployment Strategy (required):**
- Step 1: Anvil local testing (`anvil` + `forge script --rpc-url http://localhost:8545`)
- Step 2: HashKey Chain Testnet (Chain ID 133, RPC: https://testnet.hsk.xyz)
- Step 3: HashKey Chain Mainnet (Chain ID 177, RPC: https://mainnet.hsk.xyz) via Safe multi-sig
- Each step: deploy, verify on block explorer, run smoke tests

**Security Tasks (required — every plan MUST include):**
- Static analysis task: Slither + Mythril + Aderyn
- Fuzz testing task: all math functions
- Fork testing task: all external protocol integrations
- Internal security review task
- SlowMist external audit task (for high-risk contracts)

**Compliance Tasks (if applicable):**
- KYC/AML integration verification
- ERC-3643 compliance module testing
- Sanctions screening logic verification

**Monitoring Setup (required):**
- Event design for The Graph subgraph / custom indexer
- Alert rules for critical operations (large transfers, role changes, pause/unpause)

## Full-Stack Plan Sections

When the plan involves frontend (Next.js) and/or Go backend alongside contracts, include these additional task groups:

**ABI Sync Tasks (required when frontend/backend consumes contracts):**
- Export ABI from contract build output
- Generate wagmi typed hooks (frontend): `npx wagmi generate`
- Generate abigen Go bindings (backend): `go generate ./internal/contracts/`
- Verify: TypeScript compilation passes, Go compilation passes
- See `hsk-superpowers:abi-sync` skill for the full pipeline

**Frontend Tasks (when building dApp frontend):**
- Chain configuration (HSK mainnet/testnet definition)
- Wallet connection component (wagmi connectors)
- Per-feature pages: each page is a task with its own test
- Transaction UX: approve → execute flow with loading states
- Error handling: contract custom errors → Chinese user-friendly messages
- i18n setup (next-intl, zh/en)
- Frontend test: vitest unit tests for components
- See `hsk-superpowers:dapp-frontend` skill for patterns

**Backend Tasks (when building Go service):**
- ethclient setup with reconnection logic
- Event listener: backfill + subscribe pattern
- Database schema and migrations
- API endpoints with tests
- Go test: unit tests (mocked ethclient) + integration tests (anvil)
- See `hsk-superpowers:go-backend` skill for patterns

**Indexing Tasks (when onchain data needs querying):**
- Subgraph schema.graphql + mapping handlers
- Deploy subgraph to team Graph node
- Or: custom indexer service in Go
- See `hsk-superpowers:data-indexing` skill for patterns

**Deployment Tasks (required for full-stack projects):**
- Dockerfile for frontend (Next.js standalone)
- Dockerfile for backend (Go static binary)
- K8s manifests (Deployment, Service, ConfigMap)
- GitHub Actions CI/CD pipeline
- Smoke test on testnet after deployment
- See `hsk-superpowers:fullstack-deploy` skill for templates

**Task Ordering for Full-Stack Plans:**

```
1. Contract development + tests (Foundry)
2. ABI export + sync
3. Backend: event indexer + API
4. Frontend: pages + wallet + transaction UX
5. Integration tests (`hsk-superpowers:fullstack-testing`)
6. Deployment (`hsk-superpowers:fullstack-deploy`)
7. Security review + verification
```

## Plan Review Loop

After writing the complete plan:

1. Dispatch a single plan-document-reviewer subagent (see plan-document-reviewer-prompt.md) with precisely crafted review context — never your session history. This keeps the reviewer focused on the plan, not your thought process.
   - Provide: path to the plan document, path to spec document
2. If ❌ Issues Found: fix the issues, re-dispatch reviewer for the whole plan
3. If ✅ Approved: proceed to execution handoff

**Review loop guidance:**
- Same agent that wrote the plan fixes it (preserves context)
- If loop exceeds 3 iterations, surface to human for guidance
- Reviewers are advisory — explain disagreements if you believe feedback is incorrect

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use hsk-superpowers:subagent-driven-development
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILL:** Use hsk-superpowers:executing-plans
- Batch execution with checkpoints for review
