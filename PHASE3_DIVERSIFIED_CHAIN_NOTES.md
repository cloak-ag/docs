# Phase 3: Diversified Chain Note Encryption

**Goal:** Per-output encryption keys (diversifiers), Zcash-style. Each output gets a unique encryption key derived from a diversifier, reducing linkability between outputs.

**No backwards compatibility.** Clean break from current format.

---

## Current (Phase 2)

- One chain note per tx (or per "primary" output)
- Encrypted to single viewing key public (nk-derived)
- Format: `[version 1][ephemeral 32][nonce 12][ciphertext]` = 46 + ciphertext bytes
- Scanner: trial-decrypt with viewing key private

---

## Target (Phase 3)

- **Per-output** chain notes: 2 notes per tx (one per output UTXO)
- Each note encrypted to `pk_d` where `pk_d = X25519(derive_sk_d(nk, d))`
- Diversifier `d` (11 bytes): `BLAKE3("cloak_div_v1" || nk || commitment || output_index)[0:11]`
- Envelope format: `[diversifier 11][version 1][ephemeral 32][nonce 12][ciphertext]` = 57 + ciphertext bytes

---

## Design

### Diversifier derivation

```
d = BLAKE3("cloak_div_v1" || nk || commitment_hex || output_index_le8)[0:11]
```

- `nk`: 32 bytes (from expandSpendKey.nsk)
- `commitment_hex`: 64-char hex of output commitment
- `output_index`: 0 or 1 (uint8)
- `d`: 11 bytes

### Per-output key derivation

```
sk_d = BLAKE3("cloak_sk_d_v1" || nk || d)  // 32 bytes, then clamp for X25519
pk_d = X25519_base(sk_d)
```

Scanner/receiver: has `nk` (or full viewing key base). For each envelope, read `d`, derive `sk_d`, derive `pk_d`, try decrypt with ephemeral+nonce+ciphertext.

### Envelope layout (new)

| Offset | Size | Content |
|--------|------|---------|
| 0 | 11 | Diversifier `d` |
| 11 | 1 | Version (3 for diversified) |
| 12 | 32 | Ephemeral X25519 public key |
| 44 | 12 | AES-GCM nonce |
| 56 | N | Ciphertext |

**Decoder:** Read `d[0:11]`, `version`, `ephemeral`, `nonce`, `ciphertext`. If version=2 (legacy, optional for transition period—we're not supporting), use old logic. Version 3 = diversified.

---

## Implementation Order

### 1. SDK: compliance-keys.ts

Add:
```ts
export function deriveDiversifiedViewingKey(nk: Uint8Array, diversifier: Uint8Array): ViewingKeyPair
export function deriveDiversifier(nk: Uint8Array, commitmentHex: string, outputIndex: number): Uint8Array
```

### 2. SDK: chain-note.ts

- Bump `NOTE_VERSION` to 3 for diversified
- New format: `[d 11][v 1][ephemeral 32][nonce 12][ciphertext]`
- `encryptCompactChainNote(note, nk, commitmentHex, outputIndex)` — derives d, then sk_d/pk_d, encrypts
- `decryptCompactChainNote(noteBytes, nk)` — reads d from envelope, derives sk_d, decrypts
- Remove old encrypt/decrypt that used raw viewing key public/private

### 3. SDK: transact.ts

- Change `chainNoteViewingKeyPublic` → `chainNoteViewingKeyNk` (pass nk, not pk) — or keep passing viewing key but we need nk for diversifier derivation. Actually: sender has `viewingKeyPair` (private+public from nk). For encryption we need pk_d per output. So sender derives d from nk + commitment + index, then pk_d. We need to pass `viewingKeyPrivate` or `nk` to transact for deriving diversifiers. **Alternative:** pass `chainNoteViewingKeyPair` (private key) so we can derive diversifiers. The private key is needed to compute d (we use nk = expanded.nsk). So we need either:
  - `chainNoteViewingKeyNk` (32 bytes) — nk for diversifier derivation; we also need the public for... no, we encrypt to pk_d, not the base viewing key. So we only need nk.
  - Options: pass `nk` (32 bytes) or pass the full viewing key private (which we can use to... no, we need nk specifically for diversifier derivation). The chain note viewing key is derived from nk. So the flow is: nk → deriveViewingKeyFromNk → base viewing key pair. For diversification: nk + d → sk_d, pk_d. So we need `nk` in the SDK. The caller currently has `viewingKeyPair` from `deriveViewingKeyFromSpendKey`. They don't have nk directly. We could:
    - Have caller pass `nk` (from expandSpendKey) — more explicit
    - Have `chainNoteViewingKeyNk` — 32 bytes, the nk used for chain notes
  - So: add `chainNoteViewingKeyNk` option. When building chain notes, for each output we derive d = f(nk, commitment, index), pk_d = derive(nk, d), encrypt to pk_d.

- For each output (index 0, 1): build note with txType/amount/recipient/commitment, derive d, derive pk_d, encrypt.
- Emit 2 encrypted notes per tx (one per output). Zero UTXOs can have a dummy/empty note or we skip encryption for zero-value outputs (amount=0). Check current behavior: do we emit a note for zero outputs? Currently we emit 1 note for the "primary" output. For diversified we'd have 2 outputs, so 2 notes. Zero output might have commitment 0... we still need to encrypt something for consistency, or we could have a "null" note (e.g. empty ciphertext with a sentinel). Simpler: always emit 2 notes. For zero output, use commitment 0 or the actual zero-UTXO commitment.

### 4. SDK: scanner.ts

- Parse new envelope: read 11-byte diversifier, version 3, then ephemeral/nonce/ciphertext
- For trial decrypt: derive sk_d from nk + d, decrypt
- Support only version 3 (no legacy)

### 5. Relay

- Relay stores viewing key (32-byte private). For compliance export it scans chain notes. With diversification, it needs to derive sk_d per note. So relay needs the base viewing key (or nk). Currently it stores `viewing_key` hex (the private key of the chain note viewing key pair). That's `vk_private` from `deriveViewingKeyFromNk(nk)`. To derive sk_d we need `nk`, not vk_private. So we have a problem: we derive vk from nk, but sk_d is derived from nk + d. The relay has vk_private. Can we get nk from vk_private? No — it's a one-way derivation. So we must store `nk` at the relay, not the expanded viewing key. OR we store the spend key / seed — no, we don't want that. The fix: **store nk** (or the full viewing key material from which we can derive). The current flow: user registers `viewingKeyPrivate` = the 32-byte secret from deriveViewingKeyFromNk(nk). That's the X25519 secret for the base viewing key. For diversification we need nk. So we have two options:
  - **(A)** Change registration to store `nk` instead of viewing key private. Then relay derives base viewing key when needed (for old notes? no, we're not backwards compatible), and derives sk_d for each diversified note.
  - **(B)** Store both: keep storing the viewing key private for the "base" (undiversified) — but we're removing undiversified. So we only need nk.
  - **(C)** The viewing key private we store IS derived from nk. There's no inverse. So we must store nk. **Registration change:** user registers `nk` (32 bytes) instead of the viewing key private. The relay will derive sk_d per note from nk + d.

- Actually wait: if we store nk, the relay can derive the base viewing key via deriveViewingKeyFromNk, and also derive sk_d for diversifiers. So the relay needs to store `nk`. The current schema stores `viewing_key` (hex of 32 bytes). We could repurpose that: it now means `nk` instead of the X25519 secret. The registration message stays the same; we just change what we store. The user would call `deriveViewingKeyFromSpendKey` to get the viewing key pair, but for registration we'd send `expandSpendKey(sk).nsk` = nk. So the API changes: `registerViewingKey` takes `nk` not `viewingKeyPrivate`. The web/SDK would need to pass nk. That's a breaking change for the registration payload — but we said no backwards compat.

Let me update the design: relay stores `nk`. Registration endpoint accepts `nk_hex`. The viewer (web) gets nk from expandSpendKey when creating keys. So we add a way to export nk from the key hierarchy. Currently we have viewingKeyPair (from nk) but we don't expose nk. We could add `getChainNoteNk(sk_spend)` or similar that returns expanded.nsk.

### 6. Web

- `getChainNoteNk()` from keys: `expandSpendKey(sk_spend).nsk` — export for registration + transact
- Registration: send `nk_hex` (relay stores nk)
- Transact: pass `chainNoteViewingKeyNk` = nk bytes/hex

---

## File Summary

| Component | Changes |
|-----------|---------|
| compliance-keys.ts | deriveDiversifier, deriveDiversifiedViewingKey |
| chain-note.ts | New envelope format (d 11 + v 1 + …), encrypt/decrypt with diversifier |
| transact.ts | chainNoteViewingKeyNk, 2 notes per tx, derive d per output |
| scanner.ts | Parse v3 envelope, derive sk_d, trial decrypt |
| relay viewing_key | Store nk instead of vk_private |
| web | Pass nk to transact and registration |

---

## Migration (none)

Clean break. Old chain notes are unreadable. Users re-register with nk.
