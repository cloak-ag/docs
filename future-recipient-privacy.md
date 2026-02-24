# Future: Recipient Privacy Enhancements

**Status:** Planned for post-mainnet  
**Priority:** High (after core launch)  
**Related to:** Fixed recipients in proof, recipient must be known

## Current Limitation

### The Problem

In Cloak's current design:

```
Transaction Proof Contains:
├─ publicAmount: -1000000000 (1 SOL withdrawal)
├─ extDataHash: Poseidon(recipient_pubkey, relayer_fee, relayer_pubkey)
└─ ...

The recipient's public key is hashed into extDataHash.
```

**Implication:** When Alice sends to Bob, the proof contains a hash of Bob's address. While not immediately visible on-chain, sophisticated analysis could:
1. Correlate recipient addresses across transactions
2. Link deposits and withdrawals to the same recipient
3. Build partial transaction graphs

### Comparison with ZCash

**ZCash Unified Addresses (UA):**
- Single address encodes multiple receiver types (shielded, transparent, etc.)
- Recipients generate unique addresses per transaction (stealth-like)
- No on-chain linkability between different receives to the same wallet

**Cloak Today:**
- Recipient uses same Solana address for all receives
- Only shielded pool provides privacy
- Recipient address linkable across transactions

## Proposed Solutions

### Option 1: Stealth Addresses (Recommended)

**How it works:**

```
Bob's Master Public Key: PK_bob

When Alice wants to send to Bob:
1. Alice generates ephemeral keypair: (esk, epk)
2. Shared secret = X25519(esk, PK_bob)
3. Stealth address = Hash(shared secret) + PK_bob
4. Alice sends to stealth_address
5. Bob scans chain, tries to decrypt with his private key
6. If successful, Bob knows it's for him and can spend
```

**Benefits:**
- Bob receives to unique address each time
- No on-chain linkability
- Bob only needs one master keypair
- Standard in ZCash, Monero

**Challenges:**
- Requires scanning (but we already do this)
- More complex key derivation in circuits
- Changes commitment structure

### Option 2: One-Time Cloak Addresses

**Simpler variant:**

```
Bob generates:
- Address #1: cloak1abc... (for Alice)
- Address #2: cloak2def... (for Charlie)
- Address #3: cloak3ghi... (for Eve)

Each address derives unique viewing key.
Bob only needs to track which address was given to whom.
```

**Benefits:**
- Simpler to implement
- No protocol changes needed
- Can be done client-side

**Drawbacks:**
- Address management burden on user
- Not true stealth (sender knows which address type)

### Option 3: ZCash-Style Unified Addresses

**Format:**
```
cloak://<shielded-receiver>/<transparent-receiver>?memo=<encrypted-memo>
```

**Properties:**
- Single address supports multiple receiver types
- Encodes privacy preferences
- Backwards compatible with Solana addresses

## Implementation Path

### Phase 1: Address Generation (Post-Mainnet)
- Implement stealth address derivation
- Add to SDK for address generation
- Wallet shows "Generate new receive address"

### Phase 2: Circuit Updates
- Add stealth address validation in transaction circuit
- Modify commitment to include stealth ephemeral key
- Update proof generation

### Phase 3: Recipient Discovery
- Modify scanning to try stealth derivation
- Update compliance export for stealth addresses
- Document for auditors

## Security Considerations

**Questions to resolve:**

1. **Quantum resistance:** Stealth addresses rely on ECDH (X25519). Post-quantum?
   - Current answer: Same as ZCash, acceptable for now

2. **Address reuse:** What if sender reuses stealth address?
   - Mitigation: Reject duplicate commitments in circuit

3. **Recovery:** If Bob loses his viewing key, can he recover?
   - Solution: Master key derivation from seed phrase

## Relation to Other Features

- **Manual UTXO management:** Stealth addresses make this even more important (each has unique key)
- **Decoy notes:** Combined with stealth, provides excellent privacy
- **Light clients:** Stealth requires scanning, impacts light client design

## Decision Log

**2026-02-19:** Deferred to post-mainnet. Current recipient privacy via shielded pool is acceptable for v1.

**Open Questions:**
- Should we implement stealth addresses or unified addresses?
- How does this interact with compliance requirements?
- Can we make it opt-in (address flag) or must be mandatory?

## References

- ZCash ZIP 316: Unified Addresses
- Monero stealth address whitepaper
- Bitcoin BIP 32/44 hierarchical derivation
