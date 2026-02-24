# Cloak vs Zcash Sapling: Technical Comparison

This document compares the Cloak privacy protocol with Zcash Sapling, based on analysis of the Cloak codebase (`sdk/`, `services/`, `web/`).

---

## 1. Key Hierarchy

| Aspect | Zcash Sapling | Cloak |
|--------|---------------|-------|
| **Master seed** | 32-byte seed → HD paths (ZIP 32) | One of two (mutually exclusive): wallet: BLAKE3(sig); random: 32 bytes |
| **Spend key derivation** | ask, nsk, ovk (expanded spending key) | `sk_spend = BLAKE3(master \|\| "cloak_spend_key")` |
| **Expanded spend key** | ask, nsk, ovk | `expandSpendKey(sk_spend)` → { ask, nsk, ovk } |
| **View key derivation** | FVK = (ak, nk, ovk) from spend key; IVK from FVK | `vk_secret = BLAKE3(sk_spend \|\| "cloak_view_key_secret")`, then X25519 clamp |
| **Chain note viewing key** | N/A (Sapling uses diversified addresses) | `deriveViewingKeyFromNk(expandSpendKey(sk).nsk)` — IVK-style |
| **Structure** | ask, nsk, ovk, ak, nk, diversifiers | master → spend → (ask, nsk, ovk) → chain note VK from nsk |
| **Stealth addresses** | Diversified addresses (pk_d, d) | Vitalik-style: M=(K,V), P=K+G\*hash(S), ephemeral R on-chain |

**Alignment:** Cloak now has expanded spend key (ask, nsk, ovk) and derives chain note viewing key from nk (nsk), matching Zcash's IVK-style structure. See `docs/ZCASH_ALIGNMENT_PLAN.md` for details. 
---

## 2. Note / UTXO Model

| Aspect | Zcash Sapling | Cloak |
|--------|---------------|-------|
| **Commitment scheme** | Pedersen hash (Jubjub curve) | Poseidon(amount, pubkey, blinding, mint) on BN254 |
| **Blinding** | Per-note randomness in Pedersen | Random field element per UTXO |
| **Note content** | (d, pk_d, value, rcm, memo) | amount, keypair (pk=Poseidon(sk,0)), blinding, mint, index |
| **Nullifier** | nf = PRF_nk(cmu \|\| ρ) | Poseidon(commitment, pathIndex, Poseidon(sk, commitment, pathIndex)) |
| **UTXO keypair** | Address-derived | Per-UTXO: `sk` random field element, `pk = Poseidon(sk, 0)` |
| **Merkle tree** | Incremental Merkle tree of commitments | Same concept; relay + on-chain sync; 32-level depth |

**Differences:**
- Cloak uses Poseidon (SNARK-friendly) instead of Pedersen.
- Cloak nullifiers bind to Merkle path index, unlike Sapling’s cmu/ρ.
- Cloak UTXOs have a per-UTXO keypair (not address-derived); shielded transfers target a recipient’s `publicKey` (Poseidon pubkey).
- Cloak supports multi-token (SOL + SPL) via `mintAddress` in the commitment.

---

## 3. Transaction Flow

| Aspect | Zcash Sapling | Cloak |
|--------|---------------|-------|
| **Deposit** | Transparent → Shielded: value commitment + proof | User signs SOL transfer; ZK proof; direct submission (user pays) |
| **Withdraw** | Shielded → Transparent: reveal value + recipient | Relay submits; proof + recipient; relay pays fees |
| **Transfer** | Shield-to-shield: 2 in, 2 out | Same: 2 inputs, 2 outputs, externalAmount=0 |
| **Circuit structure** | Spend, Output, Binding | Single `transaction` circuit: Merkle proof, nullifiers, commitments, extDataHash, chainNoteHash |
| **Proof system** | Groth16 over BLS12-381 | Groth16 over BN254 (circomlibjs, snarkjs) |
| **Padding** | Dummy inputs/outputs | Zero UTXOs (amount=0, index=0) to pad to 2 in / 2 out |

**Flow specifics:**
- **Deposits:** User signs directly (wallet must move SOL); risk oracle (Range/Switchboard) optional; proof + nullifiers + commitments.
- **Transfers/withdrawals:** Relay signs and pays; user gets privacy from relay fee-payer.
- **extDataHash:** Binds proof to (recipient, relayerFee, relayer).
- **chainNoteHash:** Poseidon(domain, version, amountDataHash, noteTailHash) binds on-chain note envelope to proof.

---

## 4. Scanning (Recipient Discovery)

| Aspect | Zcash Sapling | Cloak |
|--------|---------------|-------|
| **Mechanism** | Compact blocks + trial decryption with IVK | Fetch Transact instructions from RPC; extract CLVK envelope; trial-decrypt with viewing key |
| **Note encryption** | KEM-DEM (KDF + Symmetric) to pk_d | X25519 ECDH + HKDF-SHA256 → AES-256-GCM |
| **Storage** | Notes in mempool/chain; wallet scans | Compact chain notes in instruction data (CLVK envelope) |
| **Scanning scope** | All Sapling outputs | All Cloak program transactions; filter by viewing-key decryption |
| **Integrity check** | Ciphertext validity | Recompute chainNoteHash from decrypted note; compare to on-chain hash |

**Cloak scanning (`sdk/src/core/scanner.ts`):**
1. `getSignaturesForAddress(programId)` with optional `untilSignature`.
2. `getTransaction` for each; parse Transact (0) or TransactSwap (1) instruction.
3. Parse CLVK envelope (magic "CLVK"); extract encrypted note blobs.
4. Trial-decrypt with `viewingKeyPrivate`; verify txType, amount, commitment, chainNoteHash.
5. Sort by timestamp; compute running balance.

**No indexer dependency:** Scanning uses only Solana RPC and the user’s viewing key.

---

## 5. Compliance and Viewing Key Design

| Aspect | Zcash Sapling | Cloak |
|--------|---------------|-------|
| **Shielded pool design** | Fully decentralized; no built-in compliance | Optional compliance via relay + viewing key registration |
| **Viewing key storage** | User-held; no registration | User registers viewing key with relay (user_pubkey → viewing_key_hex); relay stores in DB |
| **Registration** | N/A | POST `/viewing-key/register`: user signs `CLOAK_VIEWING_KEY_{pubkey}`; relay stores hex |
| **Chain note encryption** | Per-address (diversified) | Per-transaction compact note; encrypted to user’s viewing key public |
| **Compliance decryption** | Not supported natively | Relay: load user’s viewing key → scan chain → decrypt CLVK notes → return tx history |
| **User self-export** | Wallet export | POST `/compliance/export`: user signs `CLOAK_VIEW_{pubkey}_{nonce}`; relay returns decrypted history |

**Cloak compliance flow:**
1. User registers viewing key (derived from `sk_spend`) with relay, linked to Solana `user_pubkey`.
2. Every Transact includes a CLVK envelope: compact note encrypted to user’s viewing key public.
3. Compliance: admin (token or signed message) requests decrypt for `user_pubkey` → relay fetches viewing key → scans chain → decrypts notes.
4. User export: user signs; relay returns same decrypted view.

**Difference from Zcash:** Zcash has no such registration or relay-based compliance. Cloak’s compliance is opt-in via viewing key registration and relay cooperation.

---

## 6. Privacy Model

| Aspect | Zcash Sapling | Cloak |
|--------|---------------|-------|
| **Shielded** | Sender, recipient, value, memo | Sender, recipient, value (inside pool) |
| **Visible on-chain** | Transparent tx metadata; nullifier set; commitment tree | Program ID; nullifiers; commitments; publicAmount sign; extDataHash; chainNoteHash; CLVK ciphertexts |
| **Linkability** | Unlinkable with IVK scanning | Relay knows user↔viewing_key; decrypts only that user’s notes |
| **Deposit link** | Transparent→Shielded visible | Depositor signs; link depositor→deposit exists (amount/value shielded) |
| **Withdrawal link** | Reveal value + recipient | Recipient visible; amount in compact note (encrypted) |

**Cloak visibility summary:**
- **Public:** root, nullifiers, output commitments, publicAmount (deposit/withdraw/transfer), mint, chainNoteHash, CLVK blobs.
- **Shielded:** amounts, owners (keypairs), blinding factors, exact input/output mapping.
- **Compliance:** If user registers viewing key, relay can decrypt their chain notes and reconstruct full history.

---

## Summary Table

| Dimension | Zcash Sapling | Cloak |
|-----------|---------------|-------|
| **Curve / hash** | Jubjub, Pedersen | BN254, Poseidon |
| **Master seed** | 32-byte seed | wallet: BLAKE3(sig) or random: 32 bytes (mutually exclusive) |
| **Key hierarchy** | ask/nsk/ovk, FVK, IVK, diversifiers | master→spend→(ask,nsk,ovk); chain-note VK from nsk |
| **Note encryption** | KEM-DEM to diversified address | X25519 + AES-GCM (diversification planned) |
| **Scanning** | IVK trial decrypt over outputs | RPC + CLVK trial decrypt |
| **Compliance** | User holds key; user can export | User holds key; relay stores copy when registered (admin decrypt) |
| **Transaction routing** | User submits | Deposits: user; transfers/withdrawals: relay |
| **Stealth addressing** | Diversified addresses | Vitalik-style (optional, separate from UTXO flow) |

---

## File References

- **Keys:** `web/lib/keys.ts` (getMasterSeed, expandSpendKey), `sdk/src/core/compliance-keys.ts` (deriveViewingKeyFromNk, expandSpendKey)
- **Plan:** `docs/ZCASH_ALIGNMENT_PLAN.md`
- **UTXO:** `sdk/src/core/utxo.ts`
- **Transaction:** `sdk/src/core/transact.ts`
- **Chain notes:** `sdk/src/core/chain-note.ts`
- **Scanner:** `sdk/src/core/scanner.ts`
- **Note manager:** `web/lib/note-manager.ts`, `sdk/src/core/note-manager.ts`
- **Relay compliance:** `services/relay/src/api/compliance.rs`, `services/relay/src/api/viewing_key.rs`
