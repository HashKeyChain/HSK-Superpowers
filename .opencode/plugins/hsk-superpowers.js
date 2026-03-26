/**
 * HSK-Superpowers plugin for OpenCode.ai
 *
 * Injects HSK-Superpowers bootstrap context via system prompt transform.
 * Auto-registers skills directory via config hook (no symlinks needed).
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const extractAndStripFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content };

  const frontmatterStr = match[1];
  const body = match[2];
  const frontmatter = {};

  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content: body };
};

const normalizePath = (p, homeDir) => {
  if (!p || typeof p !== 'string') return null;
  let normalized = p.trim();
  if (!normalized) return null;
  if (normalized.startsWith('~/')) {
    normalized = path.join(homeDir, normalized.slice(2));
  } else if (normalized === '~') {
    normalized = homeDir;
  }
  return path.resolve(normalized);
};

const HASHKEY_CONTEXT = `
## HashKey Chain L2 Development Context

This project targets HashKey Chain L2 (OP Stack).
- **Mainnet:** Chain ID 177, RPC: https://mainnet.hsk.xyz, WSS: wss://mainnet.hsk.xyz/ws
- **Testnet:** Chain ID 133, RPC: https://testnet.hsk.xyz, WSS: wss://testnet-ws.hsk.xyz
- **Gas Token:** HSK (not ETH)
- **Toolchain:** Foundry (forge/cast/anvil), OpenZeppelin latest stable
- **Frontend:** Next.js + React, wagmi + viem, Tailwind + shadcn/ui, TanStack Query
- **Backend:** Go (go-ethereum, abigen), Docker + K8s
- **i18n:** next-intl (zh/en)
- **Multi-sig:** Safe (Gnosis Safe), **Proxy:** UUPS
- **Audit:** Internal + SlowMist, **Compliance:** KYC/AML/ERC-3643
- **NatSpec:** Strict mode (@dev @param @return on all public/external)
- **Commits:** Conventional Commits (feat/fix/chore/docs)
- **Comments:** Chinese preferred for code comments
- **Indexing:** The Graph (team-owned node) + custom indexers
- **Repos:** Separate (contracts / frontend / backend)
- Say 'onchain' not 'on-chain' (Ethereum community convention)

**Blockchain skills (auto-triggered by context):**
- hsk-superpowers:smart-contract-security — Before writing any Solidity
- hsk-superpowers:onchain-testing — Foundry test patterns (Unit/Fuzz/Fork/Invariant)
- hsk-superpowers:l2-deployment — Anvil -> Testnet -> Mainnet deployment
- hsk-superpowers:contract-upgrade — UUPS proxy upgrades with Timelock
- hsk-superpowers:compliance-check — KYC/AML/ERC-3643 requirements
- hsk-superpowers:gas-optimization — Gas analysis and optimization
- hsk-superpowers:event-design — Indexer-friendly event design
- hsk-superpowers:cross-chain — OP Standard Bridge, L1<->L2 messaging
- hsk-superpowers:erc3643-security-token — Security Token implementation
- hsk-superpowers:incident-response — Emergency response procedures

**Fullstack skills (auto-triggered by context):**
- hsk-superpowers:dapp-frontend — dApp frontend (Next.js + wagmi + viem)
- hsk-superpowers:go-backend — Go backend blockchain service
- hsk-superpowers:abi-sync — ABI synchronization pipeline (contract -> frontend/backend)
- hsk-superpowers:data-indexing — The Graph, custom indexers, Multicall3
- hsk-superpowers:fullstack-testing — Frontend/Go/E2E testing
- hsk-superpowers:fullstack-deploy — Docker + K8s + GitHub Actions CI/CD
- hsk-superpowers:rpc-optimization — Multicall3, caching, WebSocket
- hsk-superpowers:project-scaffold — New project initialization
`;

export const HskSuperpowersPlugin = async ({ client, directory }) => {
  const homeDir = os.homedir();
  const hskSkillsDir = path.resolve(__dirname, '../../skills');
  const envConfigDir = normalizePath(process.env.OPENCODE_CONFIG_DIR, homeDir);
  const configDir = envConfigDir || path.join(homeDir, '.config/opencode');

  const getBootstrapContent = () => {
    const skillPath = path.join(hskSkillsDir, 'using-superpowers', 'SKILL.md');
    if (!fs.existsSync(skillPath)) return null;

    const fullContent = fs.readFileSync(skillPath, 'utf8');
    const { content } = extractAndStripFrontmatter(fullContent);

    const toolMapping = `**Tool Mapping for OpenCode:**
When skills reference tools you don't have, substitute OpenCode equivalents:
- \`TodoWrite\` → \`todowrite\`
- \`Task\` tool with subagents → Use OpenCode's subagent system (@mention)
- \`Skill\` tool → OpenCode's native \`skill\` tool
- \`Read\`, \`Write\`, \`Edit\`, \`Bash\` → Your native tools

**Skills location:**
HSK-Superpowers skills are in \`${configDir}/skills/hsk-superpowers/\`
Use OpenCode's native \`skill\` tool to list and load skills.`;

    return `<EXTREMELY_IMPORTANT>
You have superpowers.

**IMPORTANT: The using-superpowers skill content is included below. It is ALREADY LOADED - you are currently following it. Do NOT use the skill tool to load "using-superpowers" again - that would be redundant.**

${content}

${toolMapping}
${HASHKEY_CONTEXT}
</EXTREMELY_IMPORTANT>`;
  };

  return {
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(hskSkillsDir)) {
        config.skills.paths.push(hskSkillsDir);
      }
    },

    'experimental.chat.system.transform': async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (bootstrap) {
        (output.system ||= []).push(bootstrap);
      }
    }
  };
};
