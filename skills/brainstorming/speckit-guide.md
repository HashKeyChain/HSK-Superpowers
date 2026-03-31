# Spec Kit Guided Mode

Stage-by-stage guide for transitioning a brainstorming-approved design into Spec Kit artifacts. The user executes all `/speckit.*` slash commands in their own IDE — you only output instructions and copyable prompts.

## Ground Rules

- **Do NOT** run `specify` CLI commands, write `.specify/**` files, or generate Spec Kit artifacts on disk.
- **Do NOT** output multiple stage prompts at once. One stage at a time; wait for the user to confirm completion, then verify artifacts with file tools, then proceed to the next stage.
- **Do NOT** output long paste-prompts for the Tasks stage — only a short instruction.
- **Do NOT** write business specs to `docs/superpowers/specs/*-design.md` (that path is reserved for plugin/meta work or when the user explicitly requests Superpowers-style files).
- The **sole source of truth** for the business spec is the Spec Kit artifacts in the target repository.

## Execution in a Separate Chat Window

`/speckit.*` slash commands conflict with the current brainstorming session — if the user types `/speckit.constitution` here, the skill system intercepts it as a message instead of executing the Spec Kit command.

**Before the first stage prompt, tell the user:**

> **Important:** `/speckit.*` commands need to be run in a **separate agent chat window** — not this one. Please open a new chat window in your IDE for executing Spec Kit commands. Keep **this** window open — after each step, come back here to confirm so I can verify and give you the next step.

Remind this once at the start of Stage 0 (or Stage 1 if Init was skipped). You do not need to repeat it for every stage, but every stage prompt should end with "come back here and let me know when done."

## User Feedback Loop

For every stage:

1. **Output** the stage instructions and copyable prompt
2. **Tell the user** to execute in the separate chat window, then come back here to confirm
3. **Wait** for the user to confirm in this window
4. **Verify** with your file tools (Glob, Read, ls) that the expected artifacts exist in `.specify/`
5. **If artifacts found** → announce verification passed, output the next stage
6. **If artifacts NOT found** → tell the user what's missing, ask them to retry or check for errors

Do NOT proceed to the next stage without both user confirmation AND artifact verification (except Implement — no verification needed).

---

## Stage 0: Init

**First action:** Use your file tools (Glob, Read, or ls) to check whether `.specify/` exists in the target repository. Do NOT skip this check. Do NOT assume it exists or doesn't exist — verify with tools.

**If `.specify/` does NOT exist**, say:

> Your repo doesn't have a `.specify/` directory yet — Spec Kit needs to be initialized.
>
> **Please open a separate agent chat window** for running Spec Kit commands (not this one — `/speckit.*` commands won't work here). Keep this window open; after each step, come back here to confirm.
>
> In your **terminal** (not a chat window), run:
>
> ```
> specify init .
> ```
>
> The CLI will prompt you to select your AI agent. Come back here and let me know once initialization is complete.

**Then wait** for the user to confirm. Once they confirm, **verify again** with file tools that `.specify/` now exists.
- If `.specify/` exists → announce success, proceed to Stage 1
- If `.specify/` still doesn't exist → tell the user init may have failed, ask them to check and retry

**If `.specify/` already exists** on the initial check, say:

> Your repo already has Spec Kit initialized (`.specify/` exists). Moving to the Constitution stage.
>
> **Please open a separate agent chat window** for running `/speckit.*` commands (not this one — they won't work here). Keep this window open; after each step, come back here to confirm.

Then proceed directly to Stage 1.

**Do NOT** run `specify init` yourself.

---

## Stage 1: Constitution

**First action:** Use your file tools to check whether a constitution file exists in `.specify/` (e.g. `.specify/constitution.md` or similar). Do NOT just ask the user — verify with tools first, then tell the user what you found.

### If constitution already exists — supplement only (default)

Output a copyable prompt that **adds organization/chain/stack-relevant paragraphs** without replacing the full document:

> Your repo already has a constitution at `[path you found]`. Next, run `/speckit.constitution` and paste the following as supplementary input:
>
> ```
> Please supplement the existing constitution with the following organization and tech stack paragraphs (do not replace existing content):
>
> ## Organization Context
> - Team: HashKey Chain L2 core development team
> - Target chain: HashKey Chain L2 (OP Stack), Chain ID 177 (mainnet) / 133 (testnet)
> - Gas Token: HSK (not ETH)
>
> ## Tech Stack Constraints
> - Contracts: Solidity + Foundry (forge/cast/anvil), OpenZeppelin latest stable, UUPS proxy pattern
> - Frontend: Next.js + React, wagmi + viem, Tailwind + shadcn/ui, next-intl (zh/en)
> - Backend: Go (go-ethereum, abigen), Docker + K8s
> - Security: NatSpec strict (@dev @param @return), SafeERC20, ReentrancyGuard/CEI
> - Compliance: KYC/AML + ERC-3643 (as needed), internal audit + SlowMist external audit
> - Deployment: Anvil -> Testnet(133) -> Mainnet(177), Safe multi-sig, Conventional Commits
> - Code comment language: Chinese
>
> ## Chain-Specific Principles
> - [Customize per project: L2 characteristics, cross-chain bridge, HSK gas economics, etc.]
> ```
>
> Let me know when you've finished this step.

### If no constitution exists — full prompt

> Your repo does not have a constitution yet. Run `/speckit.constitution` and paste the following as input:
>
> ```
> Create a constitution for this project with the following key constraints:
>
> ## Organization Context
> - Team: HashKey Chain L2 core development team
> - Target chain: HashKey Chain L2 (OP Stack), Chain ID 177 (mainnet) / 133 (testnet)
> - Gas Token: HSK (not ETH)
>
> ## Tech Stack
> - Contracts: Solidity + Foundry, OpenZeppelin, UUPS proxy
> - Frontend: Next.js + wagmi + viem + shadcn/ui, next-intl (zh/en)
> - Backend: Go + go-ethereum + abigen, Docker + K8s
> - Security: NatSpec strict, SafeERC20, ReentrancyGuard
> - Compliance: KYC/AML + ERC-3643 (as needed)
> - Deployment: Anvil -> Testnet -> Mainnet, Safe multi-sig
> - Commit convention: Conventional Commits, code comments in Chinese
>
> ## Quality Standards
> - TDD: write failing test first, then implement
> - Contract limit: MVP max 3 contracts, each additional must be justified
> - Security audit: Slither + Mythril + internal review + SlowMist external audit (high-risk)
> - Four-layer testing: Unit / Fuzz / Fork / Invariant
>
> ## [Other project-specific principles]
> ```
>
> Let me know when you've finished this step.

### Full replacement — only when user explicitly asks

If the user says they want to replace the existing constitution entirely, then output the full prompt above instead of the supplement. Do NOT default to full replacement.

### Verification after user confirms

Once the user says they've finished, use file tools to confirm the constitution file exists in `.specify/`. User confirmation + file exists = verification passed → proceed to Stage 2. If file not found → ask the user to check.

---

## Stage 2: Specify

**When:** Constitution is confirmed and verified.

Output a complete specify prompt that embeds the consensus reached during brainstorming:

> Run `/speckit.specify` and paste the following as input:
>
> ```
> ## Feature Description
> [Extract what from the brainstorming consensus — one or two paragraphs describing what to build]
>
> ## Why (Motivation and Value)
> [Extract why from the brainstorming consensus]
>
> ## Boundaries and Constraints
> [Extract agreed-upon boundary conditions and technical constraints from brainstorming]
>
> ## Non-Goals (Explicitly Excluded)
> [Content explicitly excluded during brainstorming]
>
> ## Risks and Open Questions
> [Risks and pending items identified during brainstorming]
>
> ## Design Consensus
> [Architecture/approach choices confirmed during brainstorming, with rationale]
> ```
>
> Let me know when you've finished this step.

**Important:** Fill in the template above with actual content from the brainstorming conversation — do not leave placeholders. The prompt should be a complete, self-contained specification input.

### Verification after user confirms

Once the user confirms, use file tools to check for new spec-related files in `.specify/` (e.g. Glob `.specify/**` and look for spec artifacts that weren't there before). If verified → proceed to Stage 3. If not found → ask the user to check.

---

## Stage 3: Plan

**When:** Specify artifacts are confirmed and verified.

Output a complete plan prompt with technology stack and layering consistent with the brainstorming consensus:

> Run `/speckit.plan` and paste the following as input:
>
> ```
> Based on the generated spec, create an implementation plan with the following tech stack and layering constraints:
>
> - Tech stack: [list from brainstorming consensus, e.g. Solidity + Foundry / Next.js + wagmi / Go backend]
> - Layering: [e.g. Contract layer -> ABI sync -> Backend -> Frontend -> Integration tests -> Deployment]
> - Testing strategy: TDD, Foundry four-layer testing (Unit/Fuzz/Fork/Invariant)
> - Deployment strategy: Anvil -> Testnet(133) -> Mainnet(177), Safe multi-sig
> - Security requirements: [per brainstorming security/compliance consensus]
>
> Each task should be small enough to complete one step in 2-5 minutes.
> ```
>
> Let me know when you've finished this step.

**Important:** Fill in with actual brainstorming consensus, not placeholders.

### Verification after user confirms

Once the user confirms, use file tools to check for new plan-related files in `.specify/`. If verified → proceed to Stage 4. If not found → ask the user to check.

---

## Stage 4: Tasks

**When:** Plan artifacts are confirmed and verified.

**Short guidance only — do NOT output a long prompt:**

> Run `/speckit.tasks` — it will automatically break down tasks based on the existing plan. Let me know when it's done.

### Verification after user confirms

Once the user confirms, use file tools to check for new task-related files in `.specify/`. If verified → proceed to Stage 5. If not found → ask the user to check.

---

## Stage 5: Implement

**When:** Tasks are confirmed and verified.

Remind the user about pacing — this is critical:

> Tasks are ready. Run `/speckit.implement` to start implementation. **Important reminders:**
>
> - **Only do 1-2 phases at a time** — do not run all phases at once
> - Which phases to run is your choice; start with the most foundational ones
> - After each batch, review the results and confirm before continuing with the next batch
>
> `/speckit.implement` writes code directly — this is the normal implementation flow.

**This is the end of the default Spec Kit flow.** No artifact verification needed for Implement — the user continues at their own pace.

---

## Alternative: User Wants AI Agent to Implement Instead

If the user has Spec Kit tasks but prefers the AI agent to write code (instead of `/speckit.implement`), they can provide the task list to:

- **hsk-superpowers:subagent-driven-development** (recommended when subagents are available) — paste Spec Kit task text into implementer subagent prompts
- **hsk-superpowers:executing-plans** — execute tasks inline in the current session

The input is the Spec Kit task list (user provides/pastes), treated the same as a `docs/superpowers/plans/*.md` plan file for execution purposes.

This is an opt-in alternative, not the default.
