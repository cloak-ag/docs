# Cloak Mixer Recover: RootNotFound Report

## Executive Summary

The `cloak-mixer recover` command fails because the relay rejects withdrawal proofs with **RootNotFound (stale Merkle root)**. The proof's root is not in the on-chain root history. The SDK flow (swap, fast-send) works because it uses **current** tree state; recover attempts to withdraw **old** deposits whose roots may have aged out or whose chain-derived tree disagrees with on-chain state.

---

## Problem Flow

1. **Initial cache fails**: Chain commitment fetch times out (~53s) → `chain_commitments == None`
2. **Per-deposit**: Relay proof (224 leaves) path doesn't match → fallback to chain fetch
3. **Chain proof**: Build proof from chain commitments (1188 leaves) → root `119e2a0ef33e6def...`
4. **Relay submit**: Relay checks proof root against **on-chain root history** (100-slot ring buffer)
5. **Rejection**: Proof root `119e2a0e...` not found; current on-chain root is `0c51182ff9351f79...`

---

## Terminal Logs

### Cloak-mixer recover (Terminal 35)

```
~/Development/solana/cloak/cloak-bots $ cargo run --release -p cloak-mixer recover
...
2026-02-22T21:53:02.813401Z  INFO cloak_mixer: Recovering 31 indexed deposit(s), 4.472667 SOL total
2026-02-22T21:53:55.712152Z  WARN cloak_mixer: Chain commitment fetch failed: Failed to get merkle tree signatures (timeout or RPC limits; try archive RPC). Will try relay/chain per deposit.
2026-02-22T21:53:55.712576Z  INFO cloak_mixer: Recovering deposit id=76 leaf_index=100 amount=0.010350 SOL -> W1
2026-02-22T21:53:55.722776Z  INFO cloak_mixer::merkle: Built full Merkle tree from relay: 224 leaves, root=0x15c823c5558d07e6a2bc7e850d4e4b58fb5f11a3a6860d177051c98a9f62fe72
2026-02-22T21:53:55.722792Z  INFO cloak_mixer: Got Merkle proof from relay tree: root=0x15c823c5558d07e6a2bc7e850d4e4b58fb5f11a3a6860d177051c98a9f62fe72, leaf_index=100
2026-02-22T21:53:55.723604Z  INFO cloak_mixer::merkle: Chain fallback: fetching signatures for merkle tree PDA GQuRgbCdWVcKHb4cSGKAvcQCJ3aCDhFDeiXhqw7Bybyr (timeout 120s)
2026-02-22T21:54:28.244654Z  INFO cloak_mixer::merkle: Chain fallback: fetching 595 transactions from RPC (this may take 30-60s)...
...
2026-02-22T21:54:28.309483Z  INFO cloak_mixer::merkle: Chain fallback: built tree with 1188 commitments
2026-02-22T21:54:28.309562Z  INFO cloak_mixer: Deposit id=76: commitment at leaf_index=100 but path from relay didn't match; using chain proof
2026-02-22T21:54:29.980565Z  WARN cloak_mixer: Deposit id=76: relay submit failed: Relay returned error 400 Bad Request: {"current_root":"0c51182ff9351f794540b4a71aa63dfa6ce8358cf0360c686a9def7482f5949d","error":true,"message":"RootNotFound (stale Merkle root): proof root 119e2a0ef33e6def not in root history (current root 0c51182ff9351f79)"}
2026-02-22T21:54:29.981030Z  INFO cloak_mixer: Recovering deposit id=6 leaf_index=102 amount=0.087313 SOL -> W2
...
```

### Relay server (Terminal 5)

```
2026-02-22T21:54:29.979298Z  INFO relay::api::transact: Received transact request
2026-02-22T21:54:29.979325Z  INFO relay::api::transact: Processing transact request request_id=e0556000-0718-4200-9371-debb72447702 is_withdrawal=true is_deposit=false external_amount=10349695
2026-02-22T21:54:29.979332Z  INFO relay::solana: Submitting UTXO transact transaction
2026-02-22T21:54:29.979682Z  INFO relay::solana: Transact PDAs - pool: 3LXJBnZqS85UumKKw98SjKZFhtBhExiBXkdEDL1doWWA, tree: GQuRgbCdWVcKHb4cSGKAvcQCJ3aCDhFDeiXhqw7Bybyr, nullifier0: CSivRtEDc3dVPPHP45nA4Wer6z2rGJ7gjYkQRz1JV8yN, nullifier1: 8wvFBBs66HYSAA6cDYd5YanHmQdbSWr4hDfytoPbcJWN
2026-02-22T21:54:29.980185Z  INFO relay::solana: Merkle tree next_index before tx: 1188
2026-02-22T21:54:29.980400Z  WARN relay::solana: Proof root (119e2a0ef33e6def) not found in root history (current root 0c51182ff9351f79)
2026-02-22T21:54:29.980408Z ERROR relay::api::transact: Transact failed request_id=e0556000-0718-4200-9371-debb72447702 error=Root not found (stale Merkle root): proof root 119e2a0ef33e6def not in root history (current root 0c51182ff9351f79)
2026-02-22T21:54:29.980414Z  WARN relay::error: ❌ Root not found (stale Merkle root): proof root 119e2a0ef33e6def not in root history (current root 0c51182ff9351f79)
2026-02-22T21:54:29.980429Z  WARN relay: request method=POST path=/transact status=400 Bad Request elapsed_ms=1
```

### SDK swap example (Terminal 34) — works

```
2026-02-22T21:58:11.759000Z INFO  example::swap: Starting Swap Example (UTXO Model)
2026-02-22T21:58:14.404000Z INFO  example::swap: Fetching Merkle proofs...
2026-02-22T21:58:14.404000Z INFO  example::swap: Building Merkle tree from relay...
2026-02-22T21:58:14.603000Z INFO  example::swap: Relay tree is 974 leaves behind (too stale), falling back to on-chain...
2026-02-22T21:58:14.749000Z INFO  example::swap: [Attempt 1/16] Root: 087e253c4a99bd93..., nextIndex: 1198
2026-02-22T21:58:14.749000Z INFO  example::swap: Generating ZK proof...
2026-02-22T21:58:15.953000Z INFO  example::swap: Converting proof to bytes...
2026-02-22T21:58:15.953000Z INFO  example::swap: Submitting to relay (transact_swap)...
2026-02-22T21:58:16.130000Z INFO  example::swap: TransactSwap submitted: 2Cf5FtFbLmq9tSk3mhfXz4wFvPzQeHSYfUk99Zqd2ed2T34a1qYJjzjy2AaGnTHjFPuFSbMeFDxt8ro1Mc2aTUbG, swap_state: 5qYBeuhfpdAVVNmKy6YMqWHGKXxE5ghXKBqXX8HnJ3wF
...
2026-02-22T21:58:24.147000Z INFO  example::swap: Swap completed: BrKhF5PwwtwptLNBvQrkE4KUVLJBCru1KPX5aD3WbzwxVABdPjTPgfLpwhMGQKEAh5nQkyKftBEfqqTc5qzA4vV
2026-02-22T21:58:24.148000Z INFO  example::swap: Example completed successfully!
```

### SDK fast-send example (Terminal 34) — works

```
2026-02-22T21:58:30.279000Z INFO  example::fast_send: Fast Send Example - One-Shot Private Payment
2026-02-22T21:58:30.639000Z INFO  example::fast_send: Funding done signature=5cXAB6j3zzKsU3s6zxVFLp91hUpYTmTwqFVwZ8AWzdW1gN8LsJgFNz5Vkm6Xuh6iATvGzYxMAGJd7t2rcSy5zTx9
2026-02-22T21:58:32.678000Z INFO  example::fast_send: Deposit done signature=4AZYPfrnRNrxE1KgADWQi4HC16wEWhtLmoq8JoXVGPJ2S9oGc6aMM2S6kZzRYy7TzeouGX28gCv8ftL4EV73DLPg utxo_index=1200 is_odd_index=false has_left_sibling=false
2026-02-22T21:58:34.968000Z INFO  example::fast_send: Fast send complete! signature=2mLATCPobjRSYQMmjAN23PQ6DqpL2kjScezg1sZBfEV1L1FF4Eqq5FaTSXYtrEZnXYQkhhYQkhhYHqqMboUWdmPkmEtHF total_time_ms=4689
2026-02-22T21:58:36.969000Z INFO  example::fast_send: Summary sent_sol=1.000000000 received_sol=0.992000000 total_time_seconds=4.7
```

### Relay during SDK flows (Terminal 5)

```
2026-02-22T21:58:14.407673Z  INFO relay: request method=GET path=/commitments status=200 OK elapsed_ms=2
2026-02-22T21:58:15.954986Z  INFO relay::api::transact_swap: Received transact_swap request
2026-02-22T21:58:15.955663Z  INFO relay::solana: Merkle tree next_index before tx: 1198
2026-02-22T21:58:16.123031Z  INFO relay::solana: TransactSwap confirmed: 2Cf5FtFbLmq9tSk3mhfXz4wFvPzQeHSYfUk99Zqd2ed2T34a1qYJjzjy2AaGnTHjFPuFSbMeFDxt8ro1Mc2aTUbG (attempt 1)
...
2026-02-22T21:58:34.282805Z  INFO relay::api::transact: Received transact request
2026-02-22T21:58:34.283366Z  INFO relay::solana: Merkle tree next_index before tx: 1202
2026-02-22T21:58:34.967471Z  INFO relay::solana: Transact confirmed: 2mLATCPobjRSYQMmjAN23PQ6DqpL2kjScezg1sZBfEV1L1FF4Eqq5FaTSXYtrEZnXYQkhhYHqqMboUWdmPkmEtHF (attempt 1)
2026-02-22T21:58:34.967523Z  INFO relay: request method=POST path=/transact status=200 OK elapsed_ms=684
```

---

## Root Causes

### 1. Root history window (protocol constraint)

The shield-pool program stores a **100-slot root history ring buffer**. Each tree insert adds a new root. When recovering deposit at `leaf_index=100`, the proof uses the root valid when leaf 100 was inserted—~1100+ inserts ago. That root has **rotated out** of the history window and can no longer be validated on-chain.

**Implication**: Deposits older than ~100 tree inserts **cannot be withdrawn** via the standard flow; their roots are no longer valid. This is a protocol limitation.

### 2. Chain vs relay tree mismatch

- **Relay tree**: 224 leaves (incomplete sync), root `0x15c82...`
- **Chain tree** (RPC-derived): 1188 leaves, root `0x119e2a0e...`
- **On-chain current**: next_index 1188→1202, current root `0x0c51182f...`

The chain fallback builds a tree from RPC transaction history. Commitment ordering or parsing may differ from the on-chain Merkle tree. Even if the root were still in history, a wrong tree structure yields a wrong root that would fail validation.

### 3. Initial chain cache timeout

The initial `fetch_commitments_from_chain` times out (~53s), so `chain_commitments` stays `None`. Recover falls back to per-deposit chain fetches, which are slower and repeat work (e.g. 595 txs per deposit).

### 4. SDK vs recover behavior

| Aspect | SDK (swap / fast-send) | cloak-mixer recover |
|--------|------------------------|---------------------|
| Tree state | **Current** (relay or chain) | **Historical** (leaf 100, 102, …) |
| Root | Recent root in root history | Old root likely evicted |
| Relay tree | Falls back to chain when stale | Relay 224 leaves vs chain 1188 |
| Retries | RootNotFound retry with fresh proof | No retry |

The SDK succeeds because it:

- Uses **current** tree state (nextIndex 1198, 1202)
- Builds proofs whose roots are still in the on-chain root history
- Has retry logic for RootNotFound

---

## Architecture Notes

### Relay validation

The relay reads the on-chain MerkleTree PDA and checks whether the proof root is in the root history before submitting. Code reference:

```rust
// services/relay/src/solana/mod.rs
// Validate root is still in the on-chain root history (ring buffer).
let (is_root_valid, current_root) = self
    .is_root_in_history(&merkle_tree_pda, &proof_root)
    .await?;
if !is_root_valid {
    return Err(Error::RootNotFound { ... });
}
```

### On-chain root history

- **Size**: 100 roots
- **Mechanism**: Ring buffer, each insert adds a new root
- **Effect**: Proofs older than ~100 inserts become invalid once their root is evicted

---

## Why Not "Just Use What the Relay Gave"?

The relay only has **224 commitments** (out of 1204 on-chain). Building a tree from those 224 gives root `0x15c82...`, which was evicted from the 100-slot root history ~980 inserts ago. The relay’s tree is **incomplete** because `commitment_sync` keeps failing (RPC unreachable or limits).

Even if we used the relay’s data, the proof root `0x15c82...` is not in on-chain root history, so the program would reject it.

**SDK fast-send works** because it never needs old commitments: it deposits at index 1204, then immediately withdraws using the **UTXO sibling info returned by the relay** at deposit time. It does not reconstruct the full tree. The mixer, in contrast, must reconstruct proofs for **old** deposits whose sibling info was never stored.

---

## Mitigations Implemented

### 1. Relay: `COMMITMENT_SYNC_RPC_URL`

The relay can use a different RPC for commitment sync when the main RPC fails or is unsuitable:

```bash
# When SOLANA_RPC_URL is Surfpool/local and sync fails, use archive RPC for sync:
export COMMITMENT_SYNC_RPC_URL="https://your-archive-rpc.helius.xyz/"
```

This keeps the relay’s `/commitments` endpoint in sync even when the main RPC is limited.

### 2. Mixer: `--chain-rpc`

On Surfpool, transaction history may not match mirrored account state. Use a mainnet archive RPC for chain scanning:

```bash
cargo run --release -p cloak-mixer recover -- --chain-rpc "https://mainnet.helius-rpc.com/?api-key=..."
```

### 3. Going Forward: Store Merkle Proof at Deposit Time

The mixer could store the Merkle proof when indexing (once `leaf_index` is known), while the root is still in history. That would avoid reconstruction for future recoveries. This would require a schema change and proof capture at index time.

---

## Recommendations

1. **Root history aging**: For very old deposits (e.g. leaf_index 100), the root is almost certainly out of history. These cannot be recovered via the relay without protocol changes (e.g. larger history, recovery mechanism).

2. **Chain tree ordering**: Align commitment order from RPC with the on-chain tree. Compare how the relay syncs from chain vs how the mixer parses RPC transactions.

3. **Initial cache reliability**: Improve the chain fetch (e.g. higher timeout, archive RPC) so the cache populates and per-deposit fetches can be avoided.

4. **Direct on-chain submit**: Bypass the relay and submit withdrawals directly. The program will still reject proofs whose root is not in history, so this does not fix root aging.

5. **Protocol change**: Consider increasing the root history size or adding a recovery path for old roots if recovering older deposits is a requirement.

---

## References

- `programs/shield-pool/src/state/merkle_tree.rs` — Root history ring buffer
- `services/relay/src/solana/mod.rs` — `is_root_in_history` validation
- `sdk/src/core/transact.ts` — RootNotFound retry logic
- `cloak-bots/cloak-mixer/src/main.rs` — Recover flow
