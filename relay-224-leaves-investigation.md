# Why Relay Stays at 224 Leaves

## Summary

The relay consistently returning **224 commitments** (~112 transactions × 2 commitments/tx) is likely due to **RPC history limits** on the commitment sync, not a bug. This is expected for local validators and many devnet RPCs. Recovery correctly falls back to chain when the relay is incomplete.

## Flow

### Relay commitment sync (`services/relay/src/commitment_sync.rs`)

1. **Incremental sync**: Loads existing commitments from DB, fetches only *new* signatures since last cursor via `get_signatures_for_address(until=last_sig)`.
2. **No limits in code**: Uses `limit: 1000` per batch and paginates until empty.
3. **Data source**: Serves `/commitments` from DB only; never blocks on RPC at request time.

### Why 224?

- **224 = 112 Transact/TransactSwap transactions** (each adds 2 commitments).
- Typical causes:
  1. **RPC history window**: Local validator (`solana-test-validator`) and many devnet RPCs only keep a limited history (often ~100–200 txs per address). The first sync indexes what the RPC returns; afterwards, “new since cursor” often returns nothing if the RPC has pruned or rotated data.
  2. **Relay RPC vs mixer RPC**: Relay may use `COMMITMENT_SYNC_RPC_URL` (or default `SOLANA_RPC_URL`). If it points to a different, more limited RPC than the mixer, it will see fewer transactions.
  3. **Initial sync snapshot**: After bootstrap, the relay may sit at a plateau if the RPC’s incremental “new” responses are empty or limited.

### Why SDK still works

1. **Relay usage**: SDK uses relay when it’s within ~50 leaves of chain and the root is valid.
2. **Chain fallback**: When relay is too stale or missing indices, SDK uses `buildMerkleTreeFromChain()` and indexes from RPC directly.
3. **Recent deposits**: For fresh deposits (e.g. swap, fast-send), proofs often rely on frontier/on-chain state rather than a full relay tree.
4. **Root history**: Relay root at 224 leaves can still be in the 100-slot root history; the relay tree is valid for indices 0..223.

### Why recovery sees “Relay tree incomplete”

- For recovery, we need proofs for **older** deposits (e.g. leaf 268).
- Relay only has 0..223, so leaf 268 is out of range.
- The message `Leaf index 268 not in relay tree (tree has 224 leaves)` is expected.
- Recovery correctly falls back to chain; the separate issue is whether the chain-built proof root is in root history.

## Is it a bug?

No. The relay is serving what it has from its incremental sync. 224 is the current plateau given the RPC’s history. The design is:

- **SDK**: Use relay when usable; otherwise fall back to chain.
- **Recover**: Use relay when usable; otherwise fall back to chain.

The chain fallback path is functioning as intended.

## Possible improvements

1. **Use archive RPC for commitment sync**: Set `COMMITMENT_SYNC_RPC_URL` to an archive RPC to index more history.
2. **Periodic full resync option**: Add a mode that periodically does a full chain scan instead of incremental, to “catch up” when RPC history is limited.
3. **Health check**: Log when relay stays N sync cycles without growing while chain `next_index` increases, to make the plateau explicit in logs.
