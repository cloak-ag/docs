# Chain-Native Viewing: Current State and Circuit Plan

## Scope

This document tracks:

- what has already been implemented across `sdk`, `services`, and `web`
- what remains to make chain-note integrity cryptographically bound to the ZK statement
- a no-migration-window rollout (protocol not live yet)

## Current vs Target

| Dimension | Current (Implemented) | Target (Post Circuit Upgrade) |
|---|---|---|
| Chain discovery | Scan program txs, parse/decrypt `CLVK` notes | Same |
| Note confidentiality | X25519 + AES-256-GCM compact notes | Same |
| Note integrity source | Relay-side semantic checks against on-chain public inputs | Proof-level cryptographic binding via `chain_note_hash` public input |
| Trust model for report correctness | Relay must correctly enforce app-layer checks | Anyone can verify note-hash consistency from proof public inputs + decrypted note |
| Metadata DB dependency | Removed (`transaction_metadata` removed) | Same |
| Commitment DB/cache dependency | Removed (`commitments` removed, live chain reconstruction) | Same |
| Relay role in compliance | Decrypt + validate + export | Decrypt + hash-verify + export (stronger guarantees) |
| Poisoned-note resistance | Good (application checks), not statement-bound | Strong (cryptographically statement-bound) |
| Protocol similarity to Zcash | High on chain-native scan/decrypt workflow | Higher on cryptographic note-integrity model |

## Current State (Implemented)

### Architecture

- Relay no longer depends on `transaction_metadata` for compliance/history.
- Relay no longer persists Merkle commitments as cache/index.
- `/commitments` is reconstructed from chain transactions.
- Compliance decrypt/export paths reconstruct from chain notes + viewing key.

### Data model

- `transaction_metadata` table removed.
- `commitments` table removed.
- `viewing_keys` remains (relay-held viewing key model still active).

### Chain notes

- Compact encrypted chain note format implemented (`CLVK` envelope in tx instruction tail).
- Notes are encrypted with X25519 shared secret + AES-256-GCM.
- Current SDK uses HKDF-SHA256 key derivation for chain-note version `2`.
- Relay supports decrypt for compact notes that follow the current envelope format.

### Integrity checks currently enforced (relay side)

- decrypted `tx_type` must match on-chain `publicAmount` semantics
- decrypted `amount` must match on-chain `publicAmount` absolute value (for non-transfer)
- decrypted `commitment` must match on-chain output commitments (except explicit zero-commitment case)
- decrypted withdraw `recipient` must match instruction recipient account

## Key Gap Remaining

Integrity is enforced at the relay application layer, not by the proof statement itself.

To be closer to Zcash-style guarantees, chain-note plaintext semantics should be bound in-circuit.

## Target Circuit Upgrade (No Migration Window)

Because protocol is not live yet, we will do a direct upgrade with no dual-mode period.

### New proof/public input requirement

Add one new public input to transaction proofs:

- `chain_note_hash`

The circuit computes this hash from constrained note fields and enforces equality with provided public input.

### Recommended note-hash preimage

- `domain_tag`
- `note_version`
- `tx_type`
- `amount`
- `recipient`
- `output_commitment_ref`
- `timestamp_bucket` (or exact timestamp if desired)

Hash function: Poseidon (recommended for circuit efficiency and consistency with existing field arithmetic).

### Required circuit constraints

- `tx_type` consistency with `publicAmount` sign semantics
- `amount` consistency with `publicAmount` magnitude rules
- `output_commitment_ref` equals one of constrained output commitments
- `chain_note_hash` equals Poseidon(preimage)

## Implementation Workstreams

### 1) Circuits (`packages/circuits`)

- Extend transaction circuit signals for note fields + `chain_note_hash`
- Add constraints listed above
- Regenerate artifacts (`wasm`, `zkey`, verification key)
- Update tests with positive and negative vectors

### 2) Program verification path

- Ensure new public input layout is expected by verifier path
- Confirm proof verification remains deterministic with new input ordering

### 3) SDK (`sdk`)

- Build note plaintext first
- Compute `chain_note_hash` from plaintext
- Inject hash into witness/public inputs for proof generation
- Encrypt same plaintext into `CLVK` payload
- Enforce local invariant: hash(plaintext used for encryption) equals hash used in proof input

### 4) Relay (`services/relay`)

- Continue decrypting chain notes from on-chain payload
- Recompute note hash from decrypted plaintext
- Read proof public input hash from tx
- Reject/report any mismatch as integrity failure

### 5) Web (`web`)

- Ensure all tx paths use upgraded SDK proof generation flow
- Keep admin/report pages using chain-native decrypt/export paths

## Security Outcome Expected

After circuit upgrade:

- payload integrity is cryptographically bound, not only app-validated
- relay trust assumptions are reduced further
- architecture is materially closer to Zcash’s note-integrity model

## Open Design Choices (To finalize before coding circuits)

Finalized decisions:

- `viewing_key_commitment` will be removed from new transact flow after circuit upgrade.
- Discovery model is trial-decrypt over chain notes (no commitment prefilter dependency).
- Relay-held viewing key storage remains in scope and accepted for now.
- Decoy/churn strategy is out-of-scope for this implementation pass.

Still to finalize before code:

- exact `chain_note_hash` preimage schema (field ordering and normalization)
- whether `timestamp` is exact or bucketed
- zero-commitment semantics for full-withdraw edge case

## Execution Plan (Suggested order)

1. Freeze note preimage schema
2. Update circuit and regenerate artifacts
3. Update SDK witness/proof pipeline
4. Update relay hash-verification path
5. Remove `viewing_key_commitment` from SDK/relay/program instruction encoding and scanners
6. Run full E2E validation (send-partial + scanner + admin export)

## Concrete Work Breakdown (No Migration Window)

### A. Circuit and verifier update

- Add `chain_note_hash` as required public input.
- Add constraints tying note fields to tx semantics and output commitment.
- Regenerate `wasm`, `zkey`, verifier key artifacts.
- Update verifier input ordering assumptions in SDK/relay/program path.

### B. SDK pipeline changes

- Build compact note plaintext first.
- Compute `chain_note_hash` and inject into witness/public inputs.
- Encrypt same plaintext into CLVK payload.
- Remove `viewing_key_commitment` submission.
- Scanner remains decrypt-first (no vkc filter).

### C. Relay changes

- Remove `viewing_key_commitment` request handling and instruction encoding.
- Compliance decrypt/export verifies `hash(decrypted note) == on-chain public input`.
- Reject mismatched notes as integrity failure.

### D. Program/instruction layout cleanup

- Remove trailing 32-byte `viewing_key_commitment` from transact instruction data layout.
- Keep CLVK envelope after `[discriminator|proof|public_inputs]`.

### E. Validation checklist

- `send-partial` succeeds with no `viewing_key_commitment` usage.
- `scan-chain-notes` finds/decrypts txs correctly.
- `/admin/compliance/decrypt` and export outputs match scanner outputs.
- Negative test: tampered note payload is rejected by hash verification path.

## Frozen Spec: `chain_note_hash` v1

### 1) Hash structure (folded Poseidon)

Due to Poseidon arity constraints (only inputs 2,3,4,9 supported), the hash uses a folded structure:

```
chain_note_hash = Poseidon_4(
    domain_tag,         // CLKNOTE1 as field element (4849333698481636657)
    note_version,       // 2 as field element
    amount_data_hash,   // Poseidon_2(publicAmount, extDataHash)
    note_tail_hash      // Poseidon_2(noteTimestamp, noteCommitment)
)
```

Where:
- `publicAmount`: signed i64 converted to BN254 field element (negative mapped via modulus - abs(amount))
- `extDataHash`: 32-byte Poseidon hash of (recipient, relayerFee, relayer) - already a public input
- `noteTimestamp`: u64 milliseconds from the chain note
- `noteCommitment`: 32-byte output commitment reference from the chain note

### 2) Field bindings (direct vs indirect)

| Field | Direct in Hash | Binding Mechanism |
|---|---|---|
| `domain_tag` | Yes | Hardcoded constant |
| `note_version` | Yes | Private circuit input |
| `publicAmount` | Yes | Public input (sign encodes tx_type) |
| `extDataHash` | Yes | Public input (contains recipient hash) |
| `noteTimestamp` | Yes | Private circuit input |
| `noteCommitment` | Yes | Private circuit input, constrained to match output commitments |
| `tx_type` | No | Implicitly bound via `publicAmount` sign (positive=deposit, negative=withdraw, zero=transfer) |
| `amount` | No | Bound via `publicAmount` (absolute value for deposit/withdraw) |
| `recipient` | No | Bound via `extDataHash = Poseidon(recipient, fee, relayer)` |

### 3) Circuit constraints

1. **Merkle proof**: Input notes exist in the tree with claimed root
2. **Nullifier uniqueness**: Each input nullifier is unique
3. **Balance conservation**: sum(inputAmounts) + publicAmount == sum(outputAmounts)
4. **Commitment binding**: `noteCommitment` equals one of `outputCommitment[0]` or `outputCommitment[1]` (or zero if both outputs are zero for full-withdraw)
5. **Hash equality**: `chain_note_hash_public == Poseidon(domain_tag, version, Poseidon(publicAmount, extDataHash), Poseidon(timestamp, noteCommitment))`

### 4) Security properties

- **Amount integrity**: Changing the amount changes `publicAmount`, which changes `amount_data_hash`, breaking the proof
- **Recipient integrity**: Changing the recipient changes `extDataHash`, which changes `amount_data_hash`, breaking the proof
- **Commitment integrity**: Circuit enforces `noteCommitment` matches one of the output commitments
- **Timestamp integrity**: Timestamp is a private input hashed into `note_tail_hash`

### 5) Instruction/public input layout (post-upgrade)

#### Public inputs

Current transaction public inputs are 232 bytes:

- `root[32]`
- `publicAmount[8]`
- `extDataHash[32]`
- `mintAddress[32]`
- `nullifiers[64]`
- `commitments[64]`

Post-upgrade public inputs become 264 bytes by appending:

- `chain_note_hash[32]`

So new layout is:

- `[root|publicAmount|extDataHash|mintAddress|nullifiers|commitments|chain_note_hash]`

#### Instruction bytes

Post-upgrade transact instruction bytes:

- `[discriminator:1][proof:256][public_inputs:264][CLVK envelope optional]`

`viewing_key_commitment` is removed entirely.

### 6) CLVK encrypted note payload (unchanged semantic envelope)

- Envelope magic: `CLVK`
- Envelope version byte: `1`
- Count byte: number of note payloads
- Repeated entries: `[len:u16 LE][note_bytes]`

Compact note payload remains versioned and encrypted using the current SDK key derivation.

### 7) SDK and relay invariants

SDK must enforce before submit:

- Compute `chain_note_hash` via folded Poseidon
- Inject `chainNoteHash`, `noteVersion`, `noteTimestamp`, `noteCommitment` into circuit inputs
- Encrypt chain note with same timestamp and commitment values
- Use same `publicAmount` and `extDataHash` for both hash and proof

Relay must enforce after decrypt:

- Recompute `chain_note_hash` from decrypted note fields + on-chain public inputs
- Compare with on-chain `chain_note_hash` (from public inputs at offset 232)
- Skip notes with mismatches (logged as warnings)

Application-layer checks (relay compliance path):

- `tx_type` matches `publicAmount` sign (deposit>0, withdraw<0, transfer=0)
- `amount` matches `abs(publicAmount)` for deposit/withdraw
- `recipient` matches instruction account for withdrawals
- `commitment` matches output commitments (when non-zero)

### 8) Test vectors to add

#### Positive

- deposit with valid hash/note
- withdraw with valid hash/note
- full-withdraw edge with zero commitment path and valid rule
- shield-to-shield transfer with valid hash

#### Negative

- wrong `noteCommitment` (not matching output commitments) - should fail constraint
- wrong `noteTimestamp` - hash mismatch
- wrong `noteVersion` - hash mismatch
- tampered `amount` in encrypted note - relay app-layer check catches (hash uses publicAmount, not note amount)

### 9) Definition of done for circuit phase

- [x] Circuit enforces `chain_note_hash` constraints (folded Poseidon)
- [x] Circuit enforces `noteCommitment` matches output commitments
- [x] SDK produces valid proofs with 9 public signals / 264-byte layout
- [x] Program verifies upgraded proofs
- [x] Relay compliance recomputes hash and validates
- [x] No `viewing_key_commitment` in relay request types or instruction encoding
- [ ] Circuit test vectors for chain_note_hash (positive + negative)
- [ ] SDK type definitions cleaned up (remove residual viewing_key_commitment fields)
