---
title: Develop on devnet
description: How to build and test apps with Cloak on Solana devnet.
---

# Develop on devnet

Cloak runs on Solana devnet so you can develop and test your integration against a live shield pool without spending real funds. Devnet is intended for development only — token balances are not real and supported assets are limited.

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
| Mock USDC | `61ro7AExqfk4dZYoCyRzTahahCC2TdUUZ4M5epMPunJf` | 6 decimals, devnet-only test token. Ask the Cloak team in Discord to send some to your wallet. |

Real Circle USDC and USDT are not available on devnet.

## SDK

The mainnet `@cloak.dev/sdk` package is pinned to the mainnet program. For devnet, use the dedicated devnet SDK package, which is pre-configured to target the devnet program ID and mock token mint:

```bash
git clone https://github.com/cloak-ag/cloak-devnet
cd cloak-devnet/sdk-devnet
npm install
```

In your project's `package.json`:

```json
{
  "dependencies": {
    "@cloak.dev/sdk-devnet": "file:../cloak-devnet/sdk-devnet"
  }
}
```

The devnet SDK exports the same surface as mainnet — `transact`, `fullWithdraw`, `swapWithChange`, etc. The only differences are the pre-configured program ID and an extra `DEVNET_MOCK_USDC_MINT` constant.

## Quickstart

```ts
import {
  CLOAK_PROGRAM_ID,
  DEVNET_MOCK_USDC_MINT,
  transact,
  createUtxo,
  createZeroUtxo,
  generateUtxoKeypair,
  getNkFromUtxoPrivateKey,
  setCircuitsPath,
  NATIVE_SOL_MINT,
} from "@cloak.dev/sdk-devnet";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const RELAY_URL = "https://api.devnet.cloak.ag";

setCircuitsPath("https://cloak-circuits.s3.us-east-1.amazonaws.com/circuits/0.1.0");

const sender = Keypair.generate(); // airdrop devnet SOL to this wallet first
const senderUtxo = await generateUtxoKeypair();
const senderNk = getNkFromUtxoPrivateKey(senderUtxo.privateKey);

// Deposit 0.1 SOL into the shield pool
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
    relayUrl: RELAY_URL,
    depositorKeypair: sender,
    walletPublicKey: sender.publicKey,
    chainNoteViewingKeyNk: senderNk,
  },
);

console.log("Deposit landed:", result.signature);
```

The `transact`, `fullWithdraw`, and other SDK calls behave identically to mainnet. Switch your imports back to `@cloak.dev/sdk` and your code targets mainnet without any further changes.

## Getting devnet SOL

Use the official Solana devnet faucet:

```bash
solana airdrop 2 <YOUR_WALLET> --url https://api.devnet.solana.com
```

Or via the web faucet at `https://faucet.solana.com/`.

The faucet rate-limits at roughly 2 SOL per request. A typical dev session needs ~5 SOL.

## Getting mock USDC

The devnet mock USDC mint is controlled by the Cloak team. Ask in Discord for a transfer to your wallet. There is no public faucet — the mint exists for integration testing, not for arbitrary distribution.

## Swap behavior

The SDK's `swapWithChange` works the same way on devnet as on mainnet. Internally, mainnet swaps route through Jupiter; on devnet there is no Jupiter liquidity for the mock USDC mint, so swaps are settled at a Pyth-quoted spot price for the SOL→mock-USDC pair. Currently only SOL → mock-USDC is supported on devnet.

## Limitations

- Only SOL and mock USDC are supported. No real Circle USDC, no USDT, no other tokens.
- Devnet program state is not persistent — Solana devnet is reset periodically by Solana Foundation. Don't rely on long-lived UTXOs.
- Sanctions screening is disabled on devnet. All addresses pass automatically. On mainnet, deposits are screened against OFAC + Range risk lists.
- Swap is SOL → mock-USDC only.

## Switching to mainnet

When you're ready for production, change the import:

```diff
- import { transact, CLOAK_PROGRAM_ID } from "@cloak.dev/sdk-devnet";
+ import { transact, CLOAK_PROGRAM_ID } from "@cloak.dev/sdk";
```

Update the relay URL to `https://api.cloak.ag` and the RPC to a mainnet endpoint. Everything else in your code stays the same.

## Help

- GitHub examples: `https://github.com/cloak-ag/cloak-devnet/tree/main/soak`
- Discord: cloak.ag/discord
- Issues: `https://github.com/cloak-ag/cloak-devnet/issues`
