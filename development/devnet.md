---
title: Devnet
description: Build and test your Cloak integration on Solana devnet.
---

# Devnet

Cloak runs on Solana devnet so you can develop and test your integration against a live shield pool without spending real funds. Devnet is intended for development only — token balances are not real and supported assets are limited.

This page is for **app developers** who want to integrate the Cloak SDK against a non-production environment.

## Endpoints

```
Relay     https://api.devnet.cloak.ag
Solana    https://api.devnet.solana.com   (or your own devnet RPC)
Program   Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h
```

## Supported assets

| Token | Mint | Notes |
|---|---|---|
| SOL | `So11111111111111111111111111111111111111112` (native) | Faucet via `https://faucet.solana.com/` |
| Mock USDC | `61ro7AExqfk4dZYoCyRzTahahCC2TdUUZ4M5epMPunJf` | 6 decimals, devnet-only test token. Mint to any wallet via the public faucet at [devnet.cloak.ag/privacy/faucet](https://devnet.cloak.ag/privacy/faucet). |

Real Circle USDC and USDT are not available on devnet.

## SDK install

The published `@cloak.dev/sdk` targets mainnet. For devnet, install the dedicated devnet SDK package — it pre-configures the program ID, the relay URL, and exports a `DEVNET_MOCK_USDC_MINT` constant. The surface is otherwise identical to the mainnet SDK.

<CodeGroup>
```bash @solana/web3.js
npm install @cloak.dev/sdk-devnet @solana/web3.js @solana/spl-token
```

```bash @solana/kit
npm install @cloak.dev/sdk-devnet @solana/web3.js @solana/spl-token @solana/kit
```
</CodeGroup>

## Quickstart: deposit SOL

<CodeGroup>
```typescript @solana/web3.js
import {
  CLOAK_PROGRAM_ID,
  transact,
  createUtxo,
  createZeroUtxo,
  generateUtxoKeypair,
  getNkFromUtxoPrivateKey,
  NATIVE_SOL_MINT,
} from "@cloak.dev/sdk-devnet";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const sender = Keypair.generate(); // airdrop devnet SOL to this wallet first
const senderUtxo = await generateUtxoKeypair();
const senderNk = getNkFromUtxoPrivateKey(senderUtxo.privateKey);

const depositOutput = await createUtxo(
  BigInt(0.1 * LAMPORTS_PER_SOL),
  senderUtxo,
  NATIVE_SOL_MINT,
);

const result = await transact(
  {
    inputUtxos: [await createZeroUtxo()],
    outputUtxos: [depositOutput],
    externalAmount: BigInt(0.1 * LAMPORTS_PER_SOL),
    depositor: sender.publicKey,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
  },
);

console.log("Deposit landed:", result.signature);
```

```typescript @solana/kit
import {
  CLOAK_PROGRAM_ID,
  transact,
  createUtxo,
  createZeroUtxo,
  generateUtxoKeypair,
  getNkFromUtxoPrivateKey,
  NATIVE_SOL_MINT,
} from "@cloak.dev/sdk-devnet";
import { address, createSolanaRpc } from "@solana/kit";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

const rpcUrl = "https://api.devnet.solana.com";

// Kit for reads.
const kitRpc = createSolanaRpc(rpcUrl);

// web3.js bridge for Cloak SDK transaction submission.
const connection = new Connection(rpcUrl, "confirmed");
const sender = Keypair.generate();

const { value: balanceLamports } = await kitRpc
  .getBalance(address(sender.publicKey.toBase58()))
  .send();
console.log("Sender balance:", Number(balanceLamports) / LAMPORTS_PER_SOL, "SOL");

const senderUtxo = await generateUtxoKeypair();
const senderNk = getNkFromUtxoPrivateKey(senderUtxo.privateKey);

const depositOutput = await createUtxo(
  BigInt(0.1 * LAMPORTS_PER_SOL),
  senderUtxo,
  NATIVE_SOL_MINT,
);

const result = await transact(
  {
    inputUtxos: [await createZeroUtxo()],
    outputUtxos: [depositOutput],
    externalAmount: BigInt(0.1 * LAMPORTS_PER_SOL),
    depositor: sender.publicKey,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
  },
);

console.log("Deposit landed:", result.signature);
```
</CodeGroup>

## Example: SOL shielded transfer

A shielded-to-shielded SOL transfer: sender deposits SOL into the pool, then transfers part of it to a recipient UTXO and keeps a change UTXO.

<CodeGroup>
```typescript @solana/web3.js
import {
  CLOAK_PROGRAM_ID,
  transact,
  createUtxo,
  createZeroUtxo,
  generateUtxoKeypair,
  getNkFromUtxoPrivateKey,
  NATIVE_SOL_MINT,
} from "@cloak.dev/sdk-devnet";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const DEPOSIT_AMOUNT = BigInt(0.12 * LAMPORTS_PER_SOL);
const TRANSFER_AMOUNT = BigInt(0.05 * LAMPORTS_PER_SOL);

const sender = Keypair.generate();
const senderUtxo = await generateUtxoKeypair();
const recipientUtxo = await generateUtxoKeypair();
const senderNk = getNkFromUtxoPrivateKey(senderUtxo.privateKey);

// 1. Deposit SOL into the shield pool.
const depositOutput = await createUtxo(DEPOSIT_AMOUNT, senderUtxo, NATIVE_SOL_MINT);
const deposit = await transact(
  {
    inputUtxos: [await createZeroUtxo()],
    outputUtxos: [depositOutput],
    externalAmount: DEPOSIT_AMOUNT,
    depositor: sender.publicKey,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
  },
);
const shielded = deposit.outputUtxos[0];

// Wait for the deposit's commitment to settle on chain.
await new Promise((r) => setTimeout(r, 20_000));

// 2. Shield-to-shield transfer: split the deposited UTXO into a recipient
//    output and a change output. externalAmount=0 keeps everything inside
//    the pool. The transfer is routed through the relay (`/transact`).
const recipientOut = await createUtxo(TRANSFER_AMOUNT, recipientUtxo, NATIVE_SOL_MINT);
const changeOut = await createUtxo(
  DEPOSIT_AMOUNT - TRANSFER_AMOUNT,
  senderUtxo,
  NATIVE_SOL_MINT,
);

const transfer = await transact(
  {
    inputUtxos: [shielded],
    outputUtxos: [recipientOut, changeOut],
    externalAmount: 0n,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
    cachedMerkleTree: deposit.merkleTree,
    useUniqueNullifiers: true,
  },
);

console.log("Transfer landed:", transfer.signature);
console.log("Recipient amount (lamports):", transfer.outputUtxos[0].amount);
console.log("Change amount    (lamports):", transfer.outputUtxos[1].amount);
```

```typescript @solana/kit
import {
  CLOAK_PROGRAM_ID,
  transact,
  createUtxo,
  createZeroUtxo,
  generateUtxoKeypair,
  getNkFromUtxoPrivateKey,
  NATIVE_SOL_MINT,
} from "@cloak.dev/sdk-devnet";
import { address, createSolanaRpc } from "@solana/kit";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

const rpcUrl = "https://api.devnet.solana.com";
const kitRpc = createSolanaRpc(rpcUrl);
const connection = new Connection(rpcUrl, "confirmed");

const DEPOSIT_AMOUNT = BigInt(0.12 * LAMPORTS_PER_SOL);
const TRANSFER_AMOUNT = BigInt(0.05 * LAMPORTS_PER_SOL);

const sender = Keypair.generate();
const senderUtxo = await generateUtxoKeypair();
const recipientUtxo = await generateUtxoKeypair();
const senderNk = getNkFromUtxoPrivateKey(senderUtxo.privateKey);

// Read sender SOL balance via kit before depositing.
const { value: balanceBefore } = await kitRpc
  .getBalance(address(sender.publicKey.toBase58()))
  .send();
console.log("Pre-deposit SOL:", Number(balanceBefore) / LAMPORTS_PER_SOL);

// 1. Deposit (write path goes through web3.js Connection).
const depositOutput = await createUtxo(DEPOSIT_AMOUNT, senderUtxo, NATIVE_SOL_MINT);
const deposit = await transact(
  {
    inputUtxos: [await createZeroUtxo()],
    outputUtxos: [depositOutput],
    externalAmount: DEPOSIT_AMOUNT,
    depositor: sender.publicKey,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
  },
);
const shielded = deposit.outputUtxos[0];

await new Promise((r) => setTimeout(r, 20_000));

// 2. Shield-to-shield transfer.
const recipientOut = await createUtxo(TRANSFER_AMOUNT, recipientUtxo, NATIVE_SOL_MINT);
const changeOut = await createUtxo(
  DEPOSIT_AMOUNT - TRANSFER_AMOUNT,
  senderUtxo,
  NATIVE_SOL_MINT,
);

const transfer = await transact(
  {
    inputUtxos: [shielded],
    outputUtxos: [recipientOut, changeOut],
    externalAmount: 0n,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
    cachedMerkleTree: deposit.merkleTree,
    useUniqueNullifiers: true,
  },
);

console.log("Transfer landed:", transfer.signature);
```
</CodeGroup>

## Example: mock-USDC shielded transfer

Same pattern as SOL, but using the devnet mock-USDC mint. The sender's mock-USDC ATA must already hold the deposit amount — mint via the [faucet](#getting-mock-usdc) (UI or HTTP), or wire your own funding flow.

<CodeGroup>
```typescript @solana/web3.js
import {
  CLOAK_PROGRAM_ID,
  DEVNET_MOCK_USDC_MINT,
  transact,
  createUtxo,
  createZeroUtxo,
  generateUtxoKeypair,
  getNkFromUtxoPrivateKey,
} from "@cloak.dev/sdk-devnet";
import { Connection, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// Amounts in 6-decimal mock-USDC base units. 5_000_000 = 5 mock USDC.
const DEPOSIT_AMOUNT = 5_000_000n;
const TRANSFER_AMOUNT = 2_000_000n;

const sender = Keypair.generate(); // pre-fund with mock USDC + a little SOL for fees
const senderUtxo = await generateUtxoKeypair();
const recipientUtxo = await generateUtxoKeypair();
const senderNk = getNkFromUtxoPrivateKey(senderUtxo.privateKey);

// (Optional) verify ATA balance before depositing.
const senderAta = await getAssociatedTokenAddress(DEVNET_MOCK_USDC_MINT, sender.publicKey);
const ataBefore = await getAccount(connection, senderAta);
console.log("Sender mock-USDC ATA:", ataBefore.amount);

// 1. Deposit mock USDC into the shield pool. createZeroUtxo(MINT) — circuit
//    requires the padding zero UTXO to match the output mint.
const depositOutput = await createUtxo(DEPOSIT_AMOUNT, senderUtxo, DEVNET_MOCK_USDC_MINT);
const deposit = await transact(
  {
    inputUtxos: [await createZeroUtxo(DEVNET_MOCK_USDC_MINT)],
    outputUtxos: [depositOutput],
    externalAmount: DEPOSIT_AMOUNT,
    depositor: sender.publicKey,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
  },
);
const shielded = deposit.outputUtxos[0];

await new Promise((r) => setTimeout(r, 20_000));

// 2. Transfer 2 mock USDC to the recipient UTXO, keep 3 as change.
const recipientOut = await createUtxo(TRANSFER_AMOUNT, recipientUtxo, DEVNET_MOCK_USDC_MINT);
const changeOut = await createUtxo(
  DEPOSIT_AMOUNT - TRANSFER_AMOUNT,
  senderUtxo,
  DEVNET_MOCK_USDC_MINT,
);

const transfer = await transact(
  {
    inputUtxos: [shielded],
    outputUtxos: [recipientOut, changeOut],
    externalAmount: 0n,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
    cachedMerkleTree: deposit.merkleTree,
    useUniqueNullifiers: true,
  },
);

console.log("USDC transfer landed:", transfer.signature);
console.log("Recipient amount:", transfer.outputUtxos[0].amount); // 2_000_000
console.log("Change amount:   ", transfer.outputUtxos[1].amount); // 3_000_000
```

```typescript @solana/kit
import {
  CLOAK_PROGRAM_ID,
  DEVNET_MOCK_USDC_MINT,
  transact,
  createUtxo,
  createZeroUtxo,
  generateUtxoKeypair,
  getNkFromUtxoPrivateKey,
} from "@cloak.dev/sdk-devnet";
import { address, createSolanaRpc } from "@solana/kit";
import { Connection, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const rpcUrl = "https://api.devnet.solana.com";
const kitRpc = createSolanaRpc(rpcUrl);
const connection = new Connection(rpcUrl, "confirmed");

const DEPOSIT_AMOUNT = 5_000_000n;
const TRANSFER_AMOUNT = 2_000_000n;

const sender = Keypair.generate();
const senderUtxo = await generateUtxoKeypair();
const recipientUtxo = await generateUtxoKeypair();
const senderNk = getNkFromUtxoPrivateKey(senderUtxo.privateKey);

// Read mock-USDC ATA balance via kit (parses SPL token account data).
const senderAtaW3 = await getAssociatedTokenAddress(DEVNET_MOCK_USDC_MINT, sender.publicKey);
const accountInfo = await kitRpc
  .getTokenAccountBalance(address(senderAtaW3.toBase58()))
  .send();
console.log("Sender mock-USDC ATA:", accountInfo.value.amount);

// 1. Deposit (write path goes through Connection).
const depositOutput = await createUtxo(DEPOSIT_AMOUNT, senderUtxo, DEVNET_MOCK_USDC_MINT);
const deposit = await transact(
  {
    inputUtxos: [await createZeroUtxo(DEVNET_MOCK_USDC_MINT)],
    outputUtxos: [depositOutput],
    externalAmount: DEPOSIT_AMOUNT,
    depositor: sender.publicKey,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
  },
);
const shielded = deposit.outputUtxos[0];

await new Promise((r) => setTimeout(r, 20_000));

// 2. Transfer.
const recipientOut = await createUtxo(TRANSFER_AMOUNT, recipientUtxo, DEVNET_MOCK_USDC_MINT);
const changeOut = await createUtxo(
  DEPOSIT_AMOUNT - TRANSFER_AMOUNT,
  senderUtxo,
  DEVNET_MOCK_USDC_MINT,
);

const transfer = await transact(
  {
    inputUtxos: [shielded],
    outputUtxos: [recipientOut, changeOut],
    externalAmount: 0n,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
    cachedMerkleTree: deposit.merkleTree,
    useUniqueNullifiers: true,
  },
);

console.log("USDC transfer landed:", transfer.signature);
```
</CodeGroup>

## Example: swap SOL → mock-USDC

Devnet swaps from shielded SOL to mock-USDC settle at a Pyth-quoted spot price. The SDK call shape is identical to a mainnet `swapWithChange` — only the output mint differs.

<CodeGroup>
```typescript @solana/web3.js
import {
  CLOAK_PROGRAM_ID,
  DEVNET_MOCK_USDC_MINT,
  transact,
  swapWithChange,
  createUtxo,
  createZeroUtxo,
  generateUtxoKeypair,
  getNkFromUtxoPrivateKey,
  NATIVE_SOL_MINT,
} from "@cloak.dev/sdk-devnet";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const SOL_TO_SHIELD = BigInt(0.2 * LAMPORTS_PER_SOL);
const SOL_TO_SWAP = BigInt(0.1 * LAMPORTS_PER_SOL);

const sender = Keypair.generate();
const senderUtxo = await generateUtxoKeypair();
const senderNk = getNkFromUtxoPrivateKey(senderUtxo.privateKey);

// 1. Fetch SOL/USD spot price from Pyth Hermes (network-agnostic feed ID).
const PYTH_SOL_USD_FEED =
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const pythResp = await fetch(
  `https://hermes.pyth.network/api/latest_price_feeds?ids[]=${PYTH_SOL_USD_FEED}`,
);
const feeds: Array<{ price: { price: string; expo: number } }> = await pythResp.json();
const solUsd = Number(feeds[0].price.price) * Math.pow(10, feeds[0].price.expo);

// SOL has 9 decimals, mock-USDC has 6: out = lamports * price * 10^(6-9) = lamports * price / 1000.
const minOut = BigInt(Math.floor((Number(SOL_TO_SWAP) * solUsd) / 1000));

// 2. Deposit SOL into the shield pool.
const depositOutput = await createUtxo(SOL_TO_SHIELD, senderUtxo, NATIVE_SOL_MINT);
const deposit = await transact(
  {
    inputUtxos: [await createZeroUtxo()],
    outputUtxos: [depositOutput],
    externalAmount: SOL_TO_SHIELD,
    depositor: sender.publicKey,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
  },
);
const shielded = deposit.outputUtxos[0];

await new Promise((r) => setTimeout(r, 20_000));

// 3. Swap 0.1 shielded SOL → mock USDC delivered to sender's USDC ATA.
const senderUsdcAta = await getAssociatedTokenAddress(
  DEVNET_MOCK_USDC_MINT,
  sender.publicKey,
);

const swap = await swapWithChange(
  [shielded],
  SOL_TO_SWAP,
  DEVNET_MOCK_USDC_MINT,
  senderUsdcAta,
  minOut,
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
    cachedMerkleTree: deposit.merkleTree,
    useUniqueNullifiers: true,
  },
  sender.publicKey,
);

console.log("Swap initiated:", swap.signature);
console.log("Expected mock USDC out (base units):", minOut);
```

```typescript @solana/kit
import {
  CLOAK_PROGRAM_ID,
  DEVNET_MOCK_USDC_MINT,
  transact,
  swapWithChange,
  createUtxo,
  createZeroUtxo,
  generateUtxoKeypair,
  getNkFromUtxoPrivateKey,
  NATIVE_SOL_MINT,
} from "@cloak.dev/sdk-devnet";
import { address, createSolanaRpc } from "@solana/kit";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const rpcUrl = "https://api.devnet.solana.com";
const kitRpc = createSolanaRpc(rpcUrl);
const connection = new Connection(rpcUrl, "confirmed");

const SOL_TO_SHIELD = BigInt(0.2 * LAMPORTS_PER_SOL);
const SOL_TO_SWAP = BigInt(0.1 * LAMPORTS_PER_SOL);

const sender = Keypair.generate();
const senderUtxo = await generateUtxoKeypair();
const senderNk = getNkFromUtxoPrivateKey(senderUtxo.privateKey);

// 1. Pyth SOL/USD spot price.
const PYTH_SOL_USD_FEED =
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const pythResp = await fetch(
  `https://hermes.pyth.network/api/latest_price_feeds?ids[]=${PYTH_SOL_USD_FEED}`,
);
const feeds: Array<{ price: { price: string; expo: number } }> = await pythResp.json();
const solUsd = Number(feeds[0].price.price) * Math.pow(10, feeds[0].price.expo);
const minOut = BigInt(Math.floor((Number(SOL_TO_SWAP) * solUsd) / 1000));

// Read sender SOL balance via kit before depositing.
const { value: solBefore } = await kitRpc
  .getBalance(address(sender.publicKey.toBase58()))
  .send();
console.log("Pre-deposit SOL:", Number(solBefore) / LAMPORTS_PER_SOL);

// 2. Deposit SOL.
const depositOutput = await createUtxo(SOL_TO_SHIELD, senderUtxo, NATIVE_SOL_MINT);
const deposit = await transact(
  {
    inputUtxos: [await createZeroUtxo()],
    outputUtxos: [depositOutput],
    externalAmount: SOL_TO_SHIELD,
    depositor: sender.publicKey,
  },
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
  },
);
const shielded = deposit.outputUtxos[0];

await new Promise((r) => setTimeout(r, 20_000));

// 3. Swap.
const senderUsdcAta = await getAssociatedTokenAddress(
  DEVNET_MOCK_USDC_MINT,
  sender.publicKey,
);

const swap = await swapWithChange(
  [shielded],
  SOL_TO_SWAP,
  DEVNET_MOCK_USDC_MINT,
  senderUsdcAta,
  minOut,
  {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
    cachedMerkleTree: deposit.merkleTree,
    useUniqueNullifiers: true,
  },
  sender.publicKey,
);

console.log("Swap initiated:", swap.signature);

// Poll the swap output ATA via kit.
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const bal = await kitRpc
    .getTokenAccountBalance(address(senderUsdcAta.toBase58()))
    .send()
    .catch(() => null);
  if (bal && BigInt(bal.value.amount) >= minOut) {
    console.log("Mock USDC received:", bal.value.amount);
    break;
  }
}
```
</CodeGroup>

## Getting devnet SOL

Use the official Solana devnet faucet:

```bash
solana airdrop 2 <YOUR_WALLET> --url https://api.devnet.solana.com
```

Or via the web faucet at `https://faucet.solana.com/`. Faucets rate-limit at roughly 2 SOL per request.

## Getting mock USDC

Cloak runs a public faucet that mints mock USDC straight to any devnet wallet's associated token account. Two ways to use it:

### Web UI

Visit [devnet.cloak.ag/privacy/faucet](https://devnet.cloak.ag/privacy/faucet), paste a recipient address (or connect a wallet), pick an amount, click send. The faucet creates the recipient's mock-USDC ATA on demand if it doesn't exist yet.

### HTTP API

For scripted or automated flows (CI, integration tests, soak runs), POST directly to `/api/faucet`:

```bash
curl -X POST https://devnet.cloak.ag/api/faucet \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "<RECIPIENT_BASE58_PUBKEY>",
    "amount": 100000000
  }'
```

`amount` is in 6-decimal mock-USDC base units (`100_000_000` = 100 mock USDC). If omitted, the default is 100 mock USDC.

Successful response:

```json
{
  "signature": "5KX...",
  "mintedAmount": 100000000,
  "recipientAta": "Hxy...",
  "explorer": "https://solscan.io/tx/5KX...?cluster=devnet"
}
```

### Rate limits

| Limit | Value |
|---|---|
| Per request | 1,000 mock USDC (`1_000_000_000` base units) |
| Per wallet, rolling 24h | 5,000 mock USDC |
| Cooldown between requests for the same wallet | 30 seconds |

Limits are enforced server-side in-memory per Vercel instance — they reset when the warm container is evicted, so don't treat them as a hard ceiling. If you need significantly more than the per-day cap for a load test, ask in Discord.

### Notes

- Rate limits are scoped to the **recipient** wallet, not the caller. Spamming from multiple machines doesn't bypass them.
- Mock USDC only. SOL comes from `https://faucet.solana.com/`.
- Devnet only — there is no equivalent endpoint on mainnet (mainnet uses real Circle USDC, sourced normally).

## Switching to mainnet

When you ship to production, change one line:

```diff
- import { transact, CLOAK_PROGRAM_ID } from "@cloak.dev/sdk-devnet";
+ import { transact, CLOAK_PROGRAM_ID } from "@cloak.dev/sdk";
```

The mainnet SDK has the production relay, program ID, and circuits paths baked in as defaults — your code is otherwise unchanged. Just swap `DEVNET_MOCK_USDC_MINT` for Circle USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) and use a mainnet RPC for your `Connection`. Cloak's mainnet `swapWithChange` routes through Jupiter (real liquidity); devnet routes through the Pyth-priced mock path.

## Limitations

- Only SOL and mock USDC are supported. No real Circle USDC, no USDT, no other tokens.
- Devnet is reset by Solana Foundation on a periodic basis. Don't rely on long-lived UTXOs.
- Sanctions screening is disabled on devnet — all addresses pass automatically. On mainnet, deposits are screened against OFAC + Range risk lists.
- Swap is SOL → mock-USDC only. The reverse direction is not yet supported on devnet.

## Help

- Discord: cloak.ag/discord
- Issues: open against the Cloak team's GitHub
