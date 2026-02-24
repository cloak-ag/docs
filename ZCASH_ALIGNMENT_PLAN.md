# Zcash Alignment Implementation Plan

This plan implements Points 1 and 2 from the Cloak vs Zcash comparison discussion.

---

## Phase 1: Master Seed Path Clarity

**Goal:** Make the two mutually exclusive master seed sources explicit.

| Source | When | Result |
|--------|------|--------|
| `wallet` | Web with connected wallet + signMessage | `BLAKE3(domain \|\| walletSignature)` |
| `random` | Scripts, standalone, or no wallet | `crypto.getRandomValues(32 bytes)` |

**Changes:**
- Add `getMasterSeed(options)` in `web/lib/keys.ts` and `sdk/src/core/keys.ts` (if SDK has key derivation)
- Options: `{ source: 'wallet'; walletSignature: Uint8Array }` | `{ source: 'random' }`
- Update `getOrCreateWalletKeysAsync` to call it explicitly with clear branching
- Document: "One or the other — never both. Wallet context uses wallet; otherwise random."

**Files:** `web/lib/keys.ts`, `web/lib/note-manager.ts`, `sdk/` (if applicable)

---

## Phase 2a: Spend Key Expansion (ask, nsk, ovk)

**Goal:** Align with Zcash's expanded spending key structure.

| Component | Zcash role | Cloak derivation |
|-----------|------------|------------------|
| **ask** | Spend authorization (signing) | `BLAKE3(sk_spend \|\| "cloak_ask_v1")` |
| **nsk** | Nullifier derivation (nk from this) | `BLAKE3(sk_spend \|\| "cloak_nsk_v1")` |
| **ovk** | Outgoing viewing (encrypt outgoing notes) | `BLAKE3(sk_spend \|\| "cloak_ovk_v1")` |

**Note:** Cloak's circuit uses per-UTXO keys for nullifiers; nsk/nk here are for the *wallet-level* viewing key derivation (chain notes). No circuit change in Phase 2.

**Changes:**
- Add `ExpandedSpendKey` interface: `{ ask, nsk, ovk }` (each 32 bytes)
- Add `expandSpendKey(sk_spend: Uint8Array): ExpandedSpendKey`
- Export from keys module

**Files:** `web/lib/keys.ts`, `sdk/src/core/compliance-keys.ts`

---

## Phase 2b: Chain Note Viewing Key from nk (IVK-Style)

**Goal:** Derive chain note viewing key from nk (Zcash's incoming viewing key component), not directly from sk_spend.

| Before | After |
|--------|-------|
| `deriveViewingKeyFromSpendKey(sk_spend)` | `deriveViewingKeyFromNk(nsk)` where nk = nsk or nk = KDF(nsk) |

In Zcash, the Incoming Viewing Key (IVK) is derived from (ak, nk). For Cloak we use nk as the base for the chain-note decryption key (X25519).

**Derivation:**
```
nk = BLAKE3(sk_spend || "cloak_nsk_v1")  // nsk in expanded key
chain_note_vk = BLAKE3("cloak_chain_note_vk_v1" || nk) → clamp → X25519 keypair
```

**Changes:**
- `deriveViewingKeyFromSpendKey(sk_spend)` becomes:
  1. `expanded = expandSpendKey(sk_spend)`
  2. `deriveViewingKeyFromNk(expanded.nsk)`  // we use nsk as "nk" for simplicity
- Add `deriveViewingKeyFromNk(nk: Uint8Array): ViewingKeyPair`
- Internal: same BLAKE3 + clamp + X25519; input is nk instead of sk_spend
- Backward compat: same master seed → same spend → same nk → same chain note key. Deterministic.
- **Breaking:** Existing keys that used direct sk_spend will produce different chain note keys. Users who registered with the old key would need to re-register. Document as breaking change.

**Files:** `sdk/src/core/compliance-keys.ts`, `web/lib/metadata-history.ts`, `web/hooks/use-cloak-sdk.ts`

---

## Phase 3: Diversified Chain Note Encryption (Per-Output Keys)

**Goal:** Each output gets a unique encryption key (diversifier), like Zcash's diversified addresses.

**Current:** One chain note per tx, encrypted to single viewing key public.

**Target:** Per-output chain notes, each encrypted to `pk_enc(d)` where d = diversifier.

**Diversifier:** 11 bytes, e.g. `hash(commitment, output_index)[0:11]` or random + stored in envelope.

**Envelope format change:** `[diversifier (11 bytes)][version][ephemeral_pk][nonce][ciphertext]`

**Scanner:** For each note, read diversifier, derive `sk_d = KDF(base_secret, d)`, `pk_d = X25519_base(sk_d)`, try decrypt.

**Relay:** Stores base viewing key (nk-derived); compliance export derives per-note keys when scanning.

**Scope:** Larger change — chain-note.ts, scanner, transact, relay. Defer to separate PR.

---

## Implementation Order

1. **Phase 1** — Low risk, documentation + explicit branching
2. **Phase 2a** — Add expansion, no behavioral change yet
3. **Phase 2b** — Switch chain note VK to nk-derived (breaking for existing registered keys)
4. **Phase 3** — Diversification (future)

---

## Files Impact Summary

| Phase | Files |
|-------|-------|
| 1 | `web/lib/keys.ts`, `web/lib/note-manager.ts` |
| 2a | `web/lib/keys.ts`, `sdk/src/core/compliance-keys.ts` |
| 2b | `sdk/src/core/compliance-keys.ts`, `web/lib/metadata-history.ts`, `web/hooks/use-cloak-sdk.ts` |
| 3 | `sdk/src/core/chain-note.ts`, `sdk/src/core/scanner.ts`, `sdk/src/core/transact.ts`, `services/relay` |
