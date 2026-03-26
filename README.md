# HashKey Chain L2 — Superpowers 开发工作流

基于 [Superpowers](https://github.com/obra/superpowers) 定制的 HashKey Chain L2 全栈开发工作流。32 个自动触发的 AI Skills，覆盖合约安全、前后端开发、测试、部署的完整生命周期。

## 安装

**Cursor（推荐）：** 在 Agent 聊天中输入：

```text
/add-plugin https://github.com/HashKeyChain/HSK-Superpowers
```

**Claude Code：** 在终端执行：

```bash
claude plugin add https://github.com/HashKeyChain/HSK-Superpowers
```

安装后重启 IDE。插件名为 `hsk-superpowers`，与原版 `superpowers` 可共存。

**更新：** `/add-plugin` 安装的插件自动跟踪最新版本。手动更新：`cd ~/.cursor/plugins/local/hsk-superpowers && git pull`

**卸载：** Cursor: `rm -rf ~/.cursor/plugins/local/hsk-superpowers` / Claude Code: `claude plugin remove hsk-superpowers`

## 如何使用

安装后无需任何配置。32 个 Skills 会**根据你的请求自动触发**，以 Cursor 为例：

**开始新项目：** 输入 "帮我创建一个 HSK Chain 上的 Staking 合约项目"

```
brainstorming → 追问安全/合规/架构 → writing-plans → 生成计划
→ subagent-driven-dev → 逐任务实现+审查 → verification → 验证
→ finishing-branch → Security Gate + PR
```

**写合约：** 输入 "帮我写一个带权限控制的 ERC-20 Token"
- 自动追问安全/合规设计问题，使用 SafeERC20、NatSpec strict mode、`forge test` 四层测试

**写前端：** 输入 "帮我给 Staking 合约写前端"
- 自动使用 wagmi + viem、三按钮交易模式、HSK Gas 费显示、中文错误提示

**调试：** 输入 "withdraw 函数 revert 了，帮我排查"
- 自动用 `forge test -vvvv` 获取执行 trace，系统化定位根因

**你不需要手动调用任何 skill。** 看到 Agent 说 "I'm using the brainstorming skill..." 说明 Skills 在工作。

## 网络配置

```
Mainnet:  Chain ID 177  |  https://mainnet.hsk.xyz  |  wss://mainnet.hsk.xyz/ws
Testnet:  Chain ID 133  |  https://testnet.hsk.xyz   |  wss://testnet-ws.hsk.xyz
Gas Token: HSK（非 ETH）
```

## 开发流程

```
1. brainstorming          → 需求澄清、安全/合规/前后端架构设计
2. writing-plans          → 实现计划（合约+前端+后端+部署）
3. subagent-driven-dev    → 子代理逐任务实现 + 三/四阶段审查
4. test-driven-development → Foundry TDD（Unit/Fuzz/Fork/Invariant）
5. verification           → forge build + test + slither + snapshot
6. finishing-branch       → Security Gate + Audit Gate + PR/Merge
```

## 32 个 Skills

### 通用流程（14 个）

| Skill | 用途 |
|-------|------|
| `brainstorming` | 需求设计 + 区块链/前后端架构问题 |
| `writing-plans` | 全栈实现计划（含 Foundry 模板、部署策略） |
| `test-driven-development` | TDD 纪律 + Foundry 四层测试 |
| `subagent-driven-development` | 子代理开发 + 安全/合规审查阶段 |
| `executing-plans` | 批量执行计划 |
| `verification-before-completion` | 完成前验证（合约+前端+Go+Docker） |
| `finishing-a-development-branch` | Security Gate + Audit Gate + PR |
| `requesting-code-review` | 发起代码审查 |
| `receiving-code-review` | 接收审查反馈 |
| `using-git-worktrees` | 隔离工作区 |
| `dispatching-parallel-agents` | 并行任务分发 |
| `systematic-debugging` | 系统化调试 + 智能合约专项 |
| `using-superpowers` | Skills 入门引导 |
| `writing-skills` | 编写新 Skill |

### 区块链专属（10 个）

| Skill | 用途 |
|-------|------|
| `smart-contract-security` | 9 类安全风险检查 |
| `onchain-testing` | Foundry 四层测试（Unit/Fuzz/Fork/Invariant） |
| `l2-deployment` | Anvil → 测试网 → 主网三步部署 |
| `contract-upgrade` | UUPS 存储布局验证 + Timelock |
| `compliance-check` | KYC/AML + 制裁筛查 + ERC-3643 |
| `erc3643-security-token` | Security Token 实现 |
| `gas-optimization` | Gas 分析 + L2 费用模型 |
| `event-design` | 索引器友好的事件设计 |
| `cross-chain` | OP Standard Bridge + L1↔L2 消息 |
| `incident-response` | 紧急响应流程（6 阶段） |

### 全栈开发（8 个）

| Skill | 用途 |
|-------|------|
| `dapp-frontend` | Next.js + wagmi + viem + shadcn/ui |
| `go-backend` | Go + go-ethereum + abigen |
| `abi-sync` | 合约 ABI → 前端 typed hooks → Go 绑定 |
| `data-indexing` | The Graph + 自建索引器 + Multicall3 |
| `fullstack-testing` | 前端 vitest + Go 测试 + Playwright E2E |
| `fullstack-deploy` | Docker + K8s + GitHub Actions CI/CD |
| `rpc-optimization` | Multicall3 + 缓存 + WebSocket |
| `project-scaffold` | Foundry + Next.js + Go 项目模板 |

## 团队部署

把安装命令发给团队成员即可。每位开发者安装后，在项目中创建 `.env`（**不要提交到 Git**）：

```bash
PRIVATE_KEY=<测试网部署密钥>
EXPLORER_API_KEY=<区块浏览器 API Key>
HASHKEY_TESTNET_RPC=https://testnet.hsk.xyz
HASHKEY_MAINNET_RPC=https://mainnet.hsk.xyz
```

## 团队规范

| 规范 | 要求 |
|------|------|
| **代理模式** | UUPS（默认） |
| **权限控制** | Ownable / AccessControl / AccessManager |
| **NatSpec** | 严格模式：`@dev @param @return` |
| **提交格式** | Conventional Commits |
| **代码注释** | 中文 |
| **多签** | Safe，生产环境禁止单 EOA 部署 |
| **部署** | Anvil → 测试网(133) → 主网(177) |
| **Gas Token** | HSK（非 ETH） |

## 致谢

基于 [Superpowers](https://github.com/obra/superpowers)（by [Jesse Vincent](https://blog.fsck.com)）定制，融合 [ethskills.com](https://ethskills.com/SKILL.md) 最佳实践。

## License

MIT — see LICENSE file
