---
name: dapp-frontend
description: "Use when developing dApp frontend — wallet connection, transaction UX, component patterns, state management with Next.js + wagmi + viem on HashKey Chain L2"
---

# dApp Frontend Development

Guide frontend development for HashKey Chain L2 dApps using Next.js + React, wagmi + viem, Tailwind + shadcn/ui.

**Announce at start:** "I'm using the dapp-frontend skill for HashKey Chain dApp frontend patterns."

## When to Use

- Building dApp frontend pages or components
- Implementing wallet connection flow
- Designing transaction UX (approve, execute, status tracking)
- Integrating with smart contracts from the frontend
- Setting up chain configuration (HSK mainnet/testnet)
- Handling contract errors in the UI

## ethskills Reference

Before implementation, fetch the latest EVM frontend best practices:

```
fetch https://ethskills.com/frontend-ux/SKILL.md
fetch https://ethskills.com/frontend-playbook/SKILL.md
```

Apply HashKey Chain-specific adaptations described below on top of ethskills guidance.

## HashKey Chain Configuration

```typescript
import { defineChain } from 'viem'

export const hashkeyMainnet = defineChain({
  id: 177,
  name: 'HashKey Chain',
  nativeCurrency: { name: 'HSK', symbol: 'HSK', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.hsk.xyz'], webSocket: ['wss://mainnet.hsk.xyz/ws'] },
  },
  blockExplorers: {
    default: { name: 'HSK Explorer', url: 'https://explorer.hsk.xyz' },
  },
})

export const hashkeyTestnet = defineChain({
  id: 133,
  name: 'HashKey Chain Testnet',
  nativeCurrency: { name: 'HSK', symbol: 'HSK', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet.hsk.xyz'], webSocket: ['wss://testnet-ws.hsk.xyz'] },
  },
  blockExplorers: {
    default: { name: 'HSK Testnet Explorer', url: 'https://testnet-explorer.hsk.xyz' },
  },
  testnet: true,
})
```

**Gas Token is HSK, not ETH.** All gas displays, balance checks, and fee estimations must use HSK.

## Wallet Connection Pattern

Use wagmi + viem as the wallet layer. Standard connection flow:

```typescript
// wagmi config
import { createConfig, http } from 'wagmi'
import { hashkeyMainnet, hashkeyTestnet } from './chains'
import { injected, walletConnect } from 'wagmi/connectors'

export const config = createConfig({
  chains: [hashkeyMainnet, hashkeyTestnet],
  connectors: [
    injected(),                          // MetaMask, OKX, etc. (EIP-6963)
    walletConnect({ projectId: '...' }), // WalletConnect v2
  ],
  transports: {
    [hashkeyMainnet.id]: http(),
    [hashkeyTestnet.id]: http(),
  },
})
```

Rules:
- Support EIP-6963 multi-wallet discovery (wagmi v2 handles this automatically)
- Always show the connected chain name and warn if on wrong network
- Provide a "Switch Network" button when chain mismatch is detected
- Display HSK balance, not ETH balance

### Add HSK Network to MetaMask

When users don't have HSK Chain configured, wagmi's `useSwitchChain` handles `wallet_addEthereumChain` automatically. For manual fallback:

```typescript
async function addHSKNetwork() {
  try {
    await window.ethereum?.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xB1' }], // 177 in hex
    })
  } catch (error: any) {
    if (error.code === 4902) {
      await window.ethereum?.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xB1',
          chainName: 'HashKey Chain',
          nativeCurrency: { name: 'HSK', symbol: 'HSK', decimals: 18 },
          rpcUrls: ['https://mainnet.hsk.xyz'],
          blockExplorerUrls: ['https://explorer.hsk.xyz'],
        }],
      })
    }
  }
}
```

In most cases, wagmi's `useSwitchChain` + the chain definitions in your config handle this automatically. Only use the manual approach as a fallback for non-wagmi contexts.

## Transaction UX — Three-Button Flow

Every onchain interaction follows this pattern. Each button has its own independent loading and disabled state:

```
[Switch Network] → [Approve] → [Execute]
```

1. **Switch Network** — Shown only when user is on wrong chain. Uses `useSwitchChain`.
2. **Approve** — Shown for ERC-20 token spend. Uses `useWriteContract` with `approve()`. Hidden if allowance is sufficient.
3. **Execute** — The actual transaction. Uses `useWriteContract` or `useSimulateContract` + `useWriteContract`.

Rules:
- NEVER share a single `isLoading` across multiple buttons
- NEVER combine approve + execute into one click without user consent
- Show transaction hash link to block explorer immediately after submission
- Show confirmation count (wait for 1+ confirmations before marking "success")
- Show clear error messages in Chinese for common failures

## State Management

**Recommended: TanStack Query (React Query) + wagmi hooks**

wagmi v2 is built on TanStack Query. Do NOT add Redux or Zustand for onchain state.

```typescript
// wagmi hooks already use TanStack Query under the hood
const { data: balance } = useBalance({ address })
const { data: tokenBalance } = useReadContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [userAddress],
})
```

Use TanStack Query directly for offchain API calls (backend data):

```typescript
const { data: portfolio } = useQuery({
  queryKey: ['portfolio', address],
  queryFn: () => fetchPortfolio(address),
})
```

State split:
- **Onchain state** → wagmi hooks (auto-refetch, cache, dedup)
- **Server state** → TanStack Query
- **Client-only UI state** → React useState / useReducer
- **Cross-component UI state** → Zustand (only if truly needed)

## Contract Error Handling

Use custom errors in Solidity + typed decoding in frontend:

```solidity
// Solidity
error InsufficientBalance(uint256 available, uint256 required);
error Unauthorized(address caller);
error SlippageExceeded(uint256 expected, uint256 actual);
```

```typescript
// Frontend: decode and display user-friendly message
import { decodeErrorResult } from 'viem'
import { contractAbi } from './generated'

const errorMessages: Record<string, (args: any) => string> = {
  InsufficientBalance: (args) => `余额不足：当前 ${args.available}，需要 ${args.required}`,
  Unauthorized: () => '权限不足，请确认使用正确的钱包地址',
  SlippageExceeded: () => '滑点超限，请调整滑点设置后重试',
}

function getErrorMessage(error: unknown): string {
  try {
    const data = (error as { data?: `0x${string}` })?.data
    if (!data) return '交易失败，请稍后重试'
    const decoded = decodeErrorResult({ abi: contractAbi, data })
    const formatter = errorMessages[decoded.errorName]
    return formatter ? formatter(decoded.args) : `合约错误：${decoded.errorName}`
  } catch {
    return '交易失败，请稍后重试'
  }
}
```

Rules:
- NEVER show raw hex error data to users
- ALWAYS provide Chinese error messages for known error types
- Include a "retry" button for transient failures
- Log full error details to console for debugging

## Gas Fee Display

Always show gas fees in HSK, not ETH:

```typescript
import { useEstimateGas, useGasPrice } from 'wagmi'
import { formatEther } from 'viem'

function GasEstimate({ request }: { request: Parameters<typeof useEstimateGas>[0] }) {
  const { data: gasEstimate } = useEstimateGas(request)
  const { data: gasPrice } = useGasPrice()

  if (!gasEstimate || !gasPrice) return <span>估算中...</span>

  const totalCostWei = gasEstimate * gasPrice
  return <span>≈ {formatEther(totalCostWei)} HSK</span>
}
```

Rules:
- NEVER label gas fees as "ETH" — always "HSK"
- Show gas estimate before user confirms transaction
- Update estimate on each block (~2s on HSK L2)
- For token operations, show both gas cost (HSK) and token amount separately

## Component Patterns

### Address Display

```typescript
// Always use a reusable Address component
<Address address={addr} />        // Truncated: 0x1234...abcd
<Address address={addr} full />   // Full address with copy button
```

- Truncate to `0x{first4}...{last4}` by default
- Copy-to-clipboard on click
- Link to block explorer

### Token Amount Display

```typescript
<TokenAmount value={amount} decimals={18} symbol="HSK" showUsd />
// Renders: 1,234.56 HSK (≈ $1,234.56 USD)
```

- ALWAYS use `formatUnits` from viem — never manual division
- NEVER hardcode decimals (USDC is 6, not 18)
- Show USD equivalent when available
- Use locale-aware number formatting

### Transaction Status

```typescript
<TxStatus hash={txHash} />
// States: Pending → Confirming (1/1) → Confirmed ✓ → Failed ✗
```

## i18n — next-intl

Setup for Chinese + English:

```
src/
  messages/
    zh.json
    en.json
  i18n.ts
  middleware.ts    // locale detection
```

Rules:
- Default locale: `zh`
- All user-facing strings go through `useTranslations()`
- Error messages, button labels, status text — all translated
- Contract-generated values (addresses, amounts) are NOT translated

## Project Structure

```
src/
  app/                    # Next.js App Router
    [locale]/             # i18n locale prefix
      layout.tsx
      page.tsx
      (dapp)/             # dApp pages group
        swap/
        pool/
        stake/
  components/
    ui/                   # shadcn/ui components
    web3/                 # Wallet, Address, TokenAmount, TxStatus
    layout/               # Header, Footer, Sidebar
  hooks/
    useContract.ts        # Project-specific contract hooks
  lib/
    chains.ts             # HSK chain definitions
    wagmi.ts              # wagmi config
    contracts/            # Generated ABIs and typed hooks (wagmi CLI output)
  messages/               # i18n translation files
```

## Integration

**Related skills (auto-triggered by context):**
- `hsk-superpowers:abi-sync` — When contract ABI changes need syncing to wagmi typed hooks
- `hsk-superpowers:rpc-optimization` — When frontend RPC calls need batching (Multicall3) or caching
- `hsk-superpowers:fullstack-testing` — When writing frontend component or integration tests
- `hsk-superpowers:verification-before-completion` — Before claiming frontend work is complete
- `hsk-superpowers:project-scaffold` — When initializing a new Next.js frontend repo
- `hsk-superpowers:data-indexing` — When frontend needs to query indexed onchain data

## Checklist

Before submitting frontend code:

- [ ] Wallet connection works on HSK mainnet (177) and testnet (133)
- [ ] Gas displays show HSK, not ETH
- [ ] Each transaction button has independent loading state
- [ ] Contract errors decoded to Chinese user-friendly messages
- [ ] Token amounts use `formatUnits` with correct decimals
- [ ] Address displays are truncated with copy and explorer link
- [ ] All user-facing strings use i18n (`useTranslations`)
- [ ] TypeScript strict mode — no `any` types in contract interactions
- [ ] ABI types generated via wagmi CLI (not manual)
- [ ] `npm run build` succeeds with zero errors
