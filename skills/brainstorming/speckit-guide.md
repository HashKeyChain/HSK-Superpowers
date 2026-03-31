# Spec Kit Guided Mode

Stage-by-stage guide for transitioning a brainstorming-approved design into Spec Kit artifacts. The user executes all `/speckit.*` slash commands in their own IDE — you only output instructions and copyable prompts.

## Ground Rules

- **Do NOT** run `specify` CLI commands, write `.specify/**` files, or generate Spec Kit artifacts on disk.
- **Do NOT** output multiple stage prompts at once. One stage at a time; wait for the user to execute the slash command, confirm the output, then proceed to the next stage.
- **Do NOT** output long paste-prompts for the Tasks stage — only a short instruction.
- **Do NOT** write business specs to `docs/superpowers/specs/*-design.md` (that path is reserved for plugin/meta work or when the user explicitly requests Superpowers-style files).
- The **sole source of truth** for the business spec is the Spec Kit artifacts in the target repository.

---

## Stage 0: Init (if needed)

**When:** The target repository has not been initialized with Spec Kit yet (no `.specify/` directory).

**What to say:**

> Check whether the target repo already has a `.specify/` directory. If not, please initialize first:
>
> ```
> specify init . --ai <your-agent>
> ```
>
> Let me know once initialization is complete and we'll move to the next step.

**Do NOT** run `specify init` yourself. Wait for the user to confirm before proceeding.

---

## Stage 1: Constitution

**When:** After Init is confirmed (or was already done).

**Check first:** Does the repository already have a constitution in `.specify/constitution.md` (or equivalent)? Ask the user or check if they mention it.

### If constitution already exists — supplement only (default)

Output a copyable prompt that **adds organization/chain/stack-relevant paragraphs** without replacing the full document. Frame it as:

> Your repo already has a constitution. Next, run `/speckit.constitution` and paste the following as supplementary input:
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
> Confirm the output once done, and we'll move to the Specify stage.

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
> Confirm the output once done, and we'll move to the Specify stage.

### Full replacement — only when user explicitly asks

If the user says they want to replace the existing constitution entirely, then output the full prompt above instead of the supplement. Do NOT default to full replacement.

---

## Stage 2: Specify

**When:** Constitution is confirmed.

Output a complete specify prompt that embeds the consensus reached during brainstorming. Structure:

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

**Important:** Fill in the template above with actual content from the brainstorming conversation — do not leave placeholders. The prompt should be a complete, self-contained specification input.

> Confirm the output once done, and we'll move to the Plan stage.

---

## Stage 3: Plan

**When:** Specify artifacts are confirmed.

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

**Important:** Fill in with actual brainstorming consensus, not placeholders.

> Confirm the output once done, and we'll move to the Tasks stage.

---

## Stage 4: Tasks

**When:** Plan artifacts are confirmed.

**Short guidance only — do NOT output a long prompt:**

> Run `/speckit.tasks` in the current context — it will automatically break down tasks based on the existing plan. Let me know the result when done.

---

## Stage 5: Implement

**When:** Tasks are confirmed.

Remind the user about pacing — this is critical:

> Tasks are ready. Run `/speckit.implement` to start implementation. **Important reminders:**
>
> - **Only do 1-2 phases at a time** — do not run all phases at once
> - Which phases to run is your choice; start with the most foundational ones
> - After each batch, review the results and confirm before continuing with the next batch
>
> `/speckit.implement` writes code directly — this is the normal implementation flow.

**This is the end of the default Spec Kit flow.** The user continues with `/speckit.implement` at their own pace.

---

## Alternative: User Wants AI Agent to Implement Instead

If the user has Spec Kit tasks but prefers the AI agent to write code (instead of `/speckit.implement`), they can provide the task list to:

- **hsk-superpowers:subagent-driven-development** (recommended when subagents are available) — paste Spec Kit task text into implementer subagent prompts
- **hsk-superpowers:executing-plans** — execute tasks inline in the current session

The input is the Spec Kit task list (user provides/pastes), treated the same as a `docs/superpowers/plans/*.md` plan file for execution purposes.

This is an opt-in alternative, not the default.
