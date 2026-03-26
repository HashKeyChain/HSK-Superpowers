---
name: cross-chain
description: "Use when building features involving L1<->L2 communication via OP Standard Bridge or cross-chain messaging on HashKey Chain L2"
---

# Cross-Chain

Guide cross-chain interactions between Ethereum L1 and HashKey Chain L2 via OP Standard Bridge.

**Announce at start:** "I'm using the cross-chain skill for L1<->L2 interaction patterns."

**Core principle:** Cross-chain messages are asynchronous. Design for eventual consistency and failure recovery.

## When to Use

- Bridging tokens between L1 and HashKey Chain L2
- Sending messages between L1 and L2 contracts
- Building features that depend on L1 state
- Implementing withdrawal flows (L2 -> L1)

## HashKey Chain Bridge Architecture

HashKey Chain uses the standard OP Stack bridge:

```
L1 (Ethereum)                    L2 (HashKey Chain)
├── L1StandardBridge             ├── L2StandardBridge
├── L1CrossDomainMessenger       ├── L2CrossDomainMessenger
├── OptimismPortal               └── L2ToL1MessagePasser
└── DisputeGameFactory
```

## L1 -> L2 (Deposits)

**Fast:** Messages from L1 to L2 are included in the next L2 block (~minutes).

```solidity
// L1 side: Send message to L2
IL1CrossDomainMessenger messenger = IL1CrossDomainMessenger(L1_MESSENGER);
messenger.sendMessage(
    l2TargetAddress,
    abi.encodeCall(IL2Target.receiveMessage, (data)),
    200000  // L2 gas limit
);
```

```solidity
// L2 side: Receive message from L1
function receiveMessage(bytes calldata data) external {
    require(
        msg.sender == address(L2_MESSENGER),
        "Only messenger"
    );
    require(
        IL2CrossDomainMessenger(L2_MESSENGER).xDomainMessageSender() == l1SourceAddress,
        "Invalid L1 sender"
    );
    // 处理消息
}
```

## L2 -> L1 (Withdrawals)

**Slow:** Withdrawals require a challenge period (~7 days on OP Stack).

```
1. Initiate withdrawal on L2
2. Wait for L2 output root to be posted on L1
3. Prove withdrawal on L1 (after output root)
4. Wait challenge period (~7 days)
5. Finalize withdrawal on L1
```

```solidity
// L2 side: Initiate withdrawal
IL2CrossDomainMessenger(L2_MESSENGER).sendMessage(
    l1TargetAddress,
    abi.encodeCall(IL1Target.receiveFromL2, (data)),
    0  // L1 gas (paid by finalizer)
);
```

## Token Bridging

```solidity
// Bridge ERC-20 from L1 to L2
IL1StandardBridge(L1_BRIDGE).depositERC20To(
    l1Token,
    l2Token,
    recipient,
    amount,
    200000, // L2 gas
    ""      // extra data
);

// WARNING: HSK is a custom gas token on HashKey Chain L2, NOT ETH.
// Standard OP Stack depositETHTo does NOT apply directly.
// HashKey Chain uses a custom gas token bridge — consult the official
// HashKey Chain bridge documentation for the correct contract address
// and function to bridge HSK between L1 and L2.
// Do NOT use depositETHTo for HSK bridging without verification.
```

## HSK Custom Gas Token — Bridge Details

HashKey Chain uses HSK as a **custom gas token** (not ETH). This changes how native token bridging works compared to standard OP Stack chains.

### Key Differences from Standard OP Stack

| Aspect | Standard OP Stack (e.g., Base) | HashKey Chain (HSK) |
|--------|-------------------------------|---------------------|
| L2 native token | ETH | HSK |
| ETH on L2 | Native | Wrapped ERC-20 |
| Bridge function for native token | `depositETHTo` | Custom gas token bridge (see docs) |
| L2 `msg.value` | ETH amount | HSK amount |
| Gas price oracle | ETH-denominated | HSK-denominated |

### Bridging HSK (L1 → L2)

HSK exists as an ERC-20 on Ethereum L1. To bridge HSK to L2 as native gas token:

1. **Approve** the HSK ERC-20 token to the L1 bridge contract
2. **Deposit** HSK through the custom gas token bridge
3. HSK appears as native token on L2 (used for gas)

```solidity
// Conceptual flow — verify exact contract addresses and interfaces
// with HashKey Chain official documentation before use
IERC20(hskTokenL1).approve(l1Bridge, amount);
IL1Bridge(l1Bridge).depositCustomGasToken(amount, l2Recipient, gasLimit, data);
```

### Bridging ETH (L1 → L2)

ETH is NOT the native token on HashKey Chain L2. When ETH is bridged, it becomes a wrapped ERC-20:

```solidity
// ETH bridged to HSK Chain becomes wrapped ETH (ERC-20)
// Use the standard bridge for ETH → WETH on L2
IL1StandardBridge(l1StandardBridge).depositETHTo{value: ethAmount}(
    l2Recipient, gasLimit, data
);
// On L2, ETH is accessible as an ERC-20, NOT as msg.value
```

### L2 → L1 Withdrawals

Standard OP Stack withdrawal flow applies, with the challenge period. Check HashKey Chain documentation for the exact challenge period duration (standard OP Stack uses 7 days).

```typescript
// Frontend: initiate L2 → L1 withdrawal using viem OP Stack actions
import { walletActionsL2 } from 'viem/op-stack'

const l2Client = createWalletClient({ chain: hashkeyMainnet }).extend(walletActionsL2())

const hash = await l2Client.initiateWithdrawal({
  request: { gas: 100_000n, to: l1RecipientAddress, value: withdrawAmount },
})
// After challenge period: prove → finalize on L1
```

### Important Notes

- **Always verify** bridge contract addresses from the official HashKey Chain documentation
- **Test on testnet (133)** before mainnet (177)
- **Monitor bridge events** using `hsk-superpowers:event-design` patterns
- The exact bridge contract interfaces may differ from generic OP Stack — always check

## Failure Handling

**L1 -> L2 message fails:**
- Message is included in L2 but execution reverts
- Message can be replayed on L2
- Design L2 receiver to be idempotent

**L2 -> L1 withdrawal fails:**
- Rare but possible if L1 execution reverts
- Withdrawal can be re-proven and re-finalized
- Funds are NOT lost (still in bridge contract)

```solidity
// 设计幂等接收器
mapping(bytes32 => bool) public processedMessages;

function receiveMessage(bytes32 messageId, bytes calldata data) external {
    require(!processedMessages[messageId], "Already processed");
    processedMessages[messageId] = true;
    // 处理消息...
}
```

## Security Considerations

- **NEVER trust `msg.sender` directly** for cross-chain messages — always verify through messenger
- Validate the cross-domain sender address
- Consider sequencer downtime when designing time-sensitive cross-chain operations
- Bridge contracts should have pause mechanisms
- Monitor bridge TVL and unusual withdrawal patterns

## Testing Cross-Chain

### Fork Test for Bridge Interactions

```solidity
function test_bridgeDeposit() public {
    // Fork L1 at a specific block
    vm.createSelectFork(L1_RPC_URL, 20000000);

    address user = makeAddr("user");
    uint256 amount = 100 ether;

    // Mint HSK tokens to user on L1
    deal(HSK_TOKEN_L1, user, amount);

    vm.startPrank(user);
    IERC20(HSK_TOKEN_L1).approve(L1_BRIDGE, amount);

    // Record balance before
    uint256 balanceBefore = IERC20(HSK_TOKEN_L1).balanceOf(user);

    // Bridge deposit (verify exact interface with HSK docs)
    IL1Bridge(L1_BRIDGE).deposit(amount, user, 200000, "");

    // Verify L1 side: tokens moved from user to bridge
    assertEq(IERC20(HSK_TOKEN_L1).balanceOf(user), balanceBefore - amount);
    vm.stopPrank();
}
```

### Mock Messenger for Local Testing

For testing cross-chain message handling without forking:

```solidity
contract MockCrossDomainMessenger {
    address public xDomainMessageSender;

    function setXDomainMessageSender(address sender) external {
        xDomainMessageSender = sender;
    }

    function sendMessage(address target, bytes calldata message, uint32) external {
        xDomainMessageSender = msg.sender;
        (bool success,) = target.call(message);
        require(success, "Message call failed");
    }
}

// In tests:
function test_receiveL1Message() public {
    MockCrossDomainMessenger mockMessenger = new MockCrossDomainMessenger();
    mockMessenger.setXDomainMessageSender(L1_CONTRACT_ADDRESS);

    // Test your L2 receiver with the mock
    MyL2Receiver receiver = new MyL2Receiver(address(mockMessenger));
    mockMessenger.sendMessage(address(receiver), abi.encodeCall(receiver.handleMessage, (data)), 0);

    // Assert expected state changes
}
```

## Integration

**Pairs with:**
- **hsk-superpowers:smart-contract-security** — Bridge security patterns
- **hsk-superpowers:onchain-testing** — Fork test cross-chain flows
- **hsk-superpowers:event-design** — Bridge events for monitoring
- **hsk-superpowers:incident-response** — Bridge incident procedures
