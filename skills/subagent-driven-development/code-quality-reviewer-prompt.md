# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable)

**Only dispatch after spec compliance review passes.**

```
Task tool (general-purpose):
  Use template at requesting-code-review/code-reviewer.md

  WHAT_WAS_IMPLEMENTED: [from implementer's report]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]
  DESCRIPTION: [task summary]
```

**In addition to standard code quality concerns, the reviewer should check:**
- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?
- Did this implementation create new files that are already large, or significantly grow existing files? (Don't flag pre-existing file sizes — focus on what this change contributed.)

**Smart Contract Quality (for Solidity tasks):**
- Gas efficiency: storage operations minimized, calldata preferred over memory where possible
- NatSpec documentation: @dev, @param, @return on all external/public functions (STRICT requirement)
- Event design: indexed parameters chosen wisely (max 3, high-cardinality fields)
- SafeERC20 usage for all token interactions
- No hardcoded addresses or token decimals
- Conventional Commits format used

**Code reviewer returns:** Strengths, Issues (Critical/Important/Minor), Assessment
