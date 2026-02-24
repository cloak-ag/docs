# Proposal: ZCash-Style Shielded Addresses for Cloak

## Executive Summary

This document proposes implementing **ZCash-style fully shielded addresses** (z-addresses) in Cloak. This would provide maximum privacy for users who want complete transaction obfuscation, similar to how ZCash's z-addresses work.

---

## Table of Contents

1. [Current State](#current-state)
2. [What Are Shielded Addresses?](#what-are-shielded-addresses)
3. [Why Implement Shielded Addresses?](#why-implement-shielded-addresses)
4. [Implementation Options](#implementation-options)
5. [Proposed Implementation](#proposed-implementation)
6. [Technical Requirements](#technical-requirements)
7. [Changes to Current Architecture](#changes-to-current-architecture)
8. [Migration Strategy](#migration-strategy)
9. [Tradeoffs & Considerations](#tradeoffs--considerations)
10. [Implementation Roadmap](#implementation-roadmap)

---

## Current State

### Today's Cloak Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT CLOAK ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User A (Public Solana) ─────▶ Deposit TX ────▶ Shield Pool (Merkle Tree)   │
│                                    │                     │                  │
│                                    │ on-chain:           │ encrypted:       │
│                                    │ • Amount            │ • Amount         │
│                                    │ • Recipient        │ • Recipient       │
│                                    │ • Sender           │ • Sender          │
│                                    │                    │                   │
│  User B (Public Solana) ◀──── Withdraw TX ◀────────────┘                    │
│                                                                             │
│  Problem: Deposit/Withdraw txs are PUBLIC on Solana                         │
│  Solution: Shielded addresses would hide tx from public view                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What Cloak Currently Has

| Feature | Status | Description |
|---------|--------|-------------|
| Shielded UTXOs | ✅ | Amounts and recipients encrypted in Merkle tree |
| Nullifiers | ✅ | Prevents double-spending |
| Zero-knowledge proofs | ✅ | Validates transactions |
| Viewing keys | ✅ | Users/admins can view transactions |
| **Fully shielded addresses** | ❌ | Not implemented |

### What's Missing

1. **Private addresses**: Users can't generate z-addr equivalents
2. **Private transactions**: Can't send directly between shielded addresses without touching public Solana
3. **Full privacy**: Deposit/withdraw are still visible on-chain

---

## What Are Shielded Addresses?

### Definition

A **shielded address** (z-address) is a cryptographic address where:
- The address itself reveals nothing about the owner
- All transactions involving this address are completely private
- No one except the holder of the viewing key can see transactions

### Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ADDRESS TYPES COMPARISON                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │   Public addr   │  │  Cloak addr     │  │   Shielded addr (proposed) ││
│  │   (t-addr)      │  │   (current)     │  │   (z-addr)                    ││
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────────────────┤│
│  │ Fully public    │  │ Partial privacy│  │ Fully private              ││
│  │                 │  │                 │  │                            ││
│  │ • Address known │  │ • Address known│  │ • Address hidden           ││
│  │ • Balance known │  │ • Balance known│  │ • Balance hidden          ││
│  │ • Tx visible   │  │ • Tx partially │  │ • Tx completely hidden     ││
│  │                 │  │   visible      │  │                            ││
│  │ Example:       │  │ Example:       │  │ Example:                  ││
│  │ 7x8x...        │  │ cloak_abc123  │  │ zcloak_xyz789             ││
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘│
│                                                                             │
│  Privacy Level:     LOW          MEDIUM           HIGH                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How Shielded Addresses Work (ZCash Model)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ZCASH SHIELDED TRANSACTION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Alice (z-addr) ──────────────────────────────────────────────▶ Bob (z-addr)│
│                                                                             │
│  ON-CHAIN:                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Nullifier (prevents double-spend)                                │   │
│  │ • Commitment (hides amount)                                        │   │
│  │ • zkSNARK proof (validates tx without revealing info)             │   │
│  │ • Encrypted memo (for recipient)                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  WHAT THE WORLD SEES: "A transaction happened"                            │
│  WHAT ONLY ALICE/BOB SEE: "Alice sent 1.5 SOL to Bob"                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why Implement Shielded Addresses?

### Use Cases

1. **Maximum Privacy Users**
   - Some users want complete financial privacy
   - Similar to cash - no one knows what you bought
   - Protection against surveillance

2. **Enterprise Privacy**
   - Companies may want to hide supplier payments
   - Salary payments could be private
   - M&A transaction privacy

3. **Regulatory Flexibility**
   - Can provide compliance via viewing keys when required
   - Balance privacy with legal obligations

4. **Competitive Advantage**
   - Differentiate from other privacy protocols
   - Feature parity with ZCash on Solana

### Market Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRIVACY PROTOCOLS COMPARISON                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Protocol     │ Chain     │ Privacy   │ Viewing Keys │ Compliance         │
│  ─────────────┼───────────┼───────────┼──────────────┼─────────────       │
│  ZCash        │ Custom    │ Full      │ Optional     │ External           │
│  Monero       │ Custom    │ Full      │ None         │ None               │
│  Aztec        │ Ethereum  │ Full      │ Optional     │ Yes                │
│  Cloak (curr) │ Solana    │ Partial   │ Mandatory    │ Built-in           │
│  Cloak (prop) │ Solana    │ Full      │ Mandatory    │ Built-in           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Options

### Option 1: Full zkSNARK Implementation

Like ZCash - implement complete zero-knowledge proofs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPTION 1: zkSNARK                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Pros:                                                                     │
│  • Maximum privacy (proven mathematically)                                 │
│  • Industry standard (ZCash proven it works)                               │
│  • No information leakage                                                  │
│                                                                             │
│  Cons:                                                                     │
│  • Complex to implement                                                    │
│  • Heavy computational overhead                                            │
│  • Trusted setup required                                                  │
│  • Large proof sizes                                                      │
│                                                                             │
│  Effort: ⭐⭐⭐⭐⭐ (Very High)                                           │
│  Timeline: 6-12 months                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Option 2: Homomorphic Encryption

Use additive homomorphic encryption for amounts.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OPTION 2: HOMOMORPHIC ENCRYPTION                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Pros:                                                                     │
│  • Can do math on encrypted values                                        │
│  • Simpler than zkSNARK                                                   │
│  • No trusted setup                                                       │
│                                                                             │
│  Cons:                                                                     │
│  • Still need to hide sender/recipient                                    │
│  • Requires additional encryption layer                                   │
│                                                                             │
│  Effort: ⭐⭐⭐⭐ (High)                                                   │
│  Timeline: 4-8 months                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Option 3: Encryption + Proofs (Recommended)

Hybrid approach using existing Cloak infrastructure.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              OPTION 3: ENCRYPTION + PROOFS (RECOMMENDED)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Use existing:                                                             │
│  • Merkle tree commitments (already have)                                 │
│  • Nullifiers (already have)                                              │
│  • Viewing keys (just implemented)                                         │
│                                                                             │
│  Add:                                                                     │
│  • Shielded address format                                                │
│  • Stealth addressing                                                     │
│  • Encrypted memo fields                                                  │
│                                                                             │
│  Pros:                                                                     │
│  • Leverages existing work                                                │
│  • Incremental implementation                                              │
│  • Maintains compliance features                                           │
│  • Faster to implement                                                    │
│                                                                             │
│  Cons:                                                                     │
│  • Less mathematically pure than zkSNARK                                  │
│  • Need careful security analysis                                         │
│                                                                             │
│  Effort: ⭐⭐⭐ (Medium)                                                   │
│  Timeline: 2-4 months                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Proposed Implementation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               PROPOSED SHIELDED ADDRESS ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     SHIELDED ADDRESS (z-addr)                       │  │
│  │                                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  shielded_public_key (p)                                     │  │  │
│  │  │  └───▶ Used as the address (visible on-chain)               │  │  │
│  │  │                                                              │  │  │
│  │  │  viewing_key (v) ──▶ Derived from p, shared with recipient   │  │  │
│  │  │                                                              │  │  │
│  │  │  spending_key (s) ──▶ Secret, used to sign transactions     │  │  │
│  │  │                                                              │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Transaction Flow:                                                         │
│                                                                             │
│  1. Alice wants to send to Bob's shielded address                         │
│  2. Alice derives Bob's transmission key from Bob's address               │
│  3. Alice encrypts the amount and memo for Bob                            │
│  4. Alice creates a commitment and nullifier                              │
│  5. Alice proves (zkSNARK) she can spend her input UTXOs                 │
│  6. On-chain: commitment + nullifier + proof (opaque)                    │
│  7. Bob (with viewing key) can detect and decrypt the tx                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Components to Implement

#### 1. Shielded Address Format

```typescript
// Proposed shielded address format
interface ShieldedAddress {
  version: number;           // Version byte
  type: 'sprout' | 'sapling'; // Address type
  publicKey: Uint8Array;    // 32 bytes - the visible address
  paymentAddress: Uint8Array; // For encrypting to recipient
}

// Base58 encoding prefix
const SHIELDED_PREFIX = 'zcloak';  // Similar to 'z' in ZCash
// Address example: zcloak1abc123...xyz
```

#### 2. Key Derivation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KEY DERIVATION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Random Seed (256 bits)                                                    │
│         │                                                                   │
│         ▼                                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                    SPENDING KEY (s)                                │   │
│  │         Keep SECRET - can spend funds                               │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ├──▶ PUBLIC KEY (p) ──▶ Address (visible)                         │
│         │                                                                  │
│         ├──▶ VIEWING KEY (v) ──▶ Can view incoming txns                   │
│         │                                                                  │
│         └──▶ TRANSMISSION KEY (t) ──▶ Used by sender to encrypt          │
│                                        to recipient                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3. Transaction Structure

```rust
// Proposed on-chain shielded transaction
struct ShieldedTx {
    // Commitment to the output (hides amount)
    commitment: [u8; 32],
    
    // Nullifier (reveals this UTXO was spent, but not which one)
    nullifier: [u8; 32],
    
    // Zero-knowledge proof
    proof: [u8; 512],
    
    // Encrypted memo for recipient
    encrypted_memo: Vec<u8>,
    
    // Transaction fee
    fee: u64,
}
```

#### 4. Transaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 SHIELDED TRANSACTION FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SENDER SIDE:                                                              │
│                                                                             │
│  1. Input UTXOs (owned) ──▶ Prove ownership via spending key             │
│                                                                             │
│  2. Output: Bob's shielded address                                        │
│     ├── Encrypt amount with Bob's transmission key                          │
│     ├── Create commitment: C = g^amount * h^randomness                     │
│     └── Generate nullifier: n = PRF(nullifier_key, position)              │
│                                                                             │
│  3. Create zkSNARK proof:                                                  │
│     • Input UTXOs exist and are unspent                                    │
│     • Sum(inputs) = Sum(outputs) + fee                                    │
│     • Nullifier is correctly computed                                      │
│                                                                             │
│  4. ON-CHAIN: Submit C + n + proof + encrypted_memo + fee                │
│                                                                             │
│  RECIPIENT SIDE:                                                           │
│                                                                             │
│  5. Scan all new commitments                                              │
│  6. Try to decrypt with viewing key                                       │
│  7. If successful: decode amount, add to balance                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Requirements

### 1. Cryptographic Primitives

| Primitive | Requirement | Implementation |
|-----------|-------------|----------------|
| Pedersen Commitments | Hide amounts | `bulletproofs` or `zkgroups` |
| PRF (Pseudo-Random) | Nullifier generation | ChaCha20-Poly1305 or Blake2 |
| ElGamal Encryption | Encrypt to recipient | `rage-dalek` or custom |
| zkSNARK | Transaction validity | `arkworks` or `bellman` |
| Hash Functions | Merkle tree | Poseidon or Pedersen |

### 2. On-Chain Storage

```rust
// Anchor program additions
#[account]
pub struct ShieldedPool {
    pub merkle_root: Pubkey,        // Current merkle root
    pub nullifier_root: Pubkey,     // Nullifier set root
    pub shielded_count: u64,        // Number of shielded UTXOs
    pub feeVault: Pubkey,          // Fee collection
}

// Shielded transaction (sent to program)
#[instruction]
pub fn shielded_transfer(
    ctx: Context<ShieldedTransfer>,
    commitment: [u8; 32],
    nullifier: [u8; 32],
    proof: Vec<u8>,
    encrypted_memo: Vec<u8>,
) -> Result<()>
```

### 3. Client-Side Changes

```
Files to modify:
├── programs/
│   └── cloak-program/
│       ├── src/
│       │   └── shielded_transfer.rs    (NEW)
│       └── Cargo.toml
├── web/
│   ├── lib/
│   │   └── shielded-address.ts       (NEW)
│   ├── components/
│   │   ├── shielded-send.tsx         (NEW)
│   │   └── shielded-receive.tsx       (NEW)
│   └── hooks/
│       └── use-shielded-wallet.ts    (NEW)
└── circom/
    └── circuits/
        └── shielded-transfer.r1cs    (NEW)
```

### 4. New Dependencies

```toml
# Cargo.toml additions
bellman = "0.7"          # zkSNARK proofs
zk-benchmark = "0.5"    # Benchmarks
rage-dalek = "4"         # ElGamal encryption
bulletproofs = "4"       # Range proofs
```

---

## Changes to Current Architecture

### Before vs After

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE EVOLUTION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BEFORE (Current):                                                         │
│  ┌─────────┐    Deposit    ┌──────────────┐    Withdraw    ┌─────────┐    │
│  │ Public  │ ──────────▶ │   Merkle     │ ────────────▶ │ Public  │    │
│  │ Address │   on-chain:  │    Tree      │   on-chain:   │ Address │    │
│  │         │   Amount      │  (encrypted) │   Amount      │         │    │
│  └─────────┘   Visible     └──────────────┘   Visible     └─────────┘    │
│                                                                             │
│  AFTER (With Shielded):                                                    │
│  ┌─────────┐    Deposit    ┌──────────────┐    Withdraw    ┌─────────┐    │
│  │ Public  │ ──────────▶ │   Merkle     │ ────────────▶ │ Public  │    │
│  │ Address │   on-chain:  │    Tree      │   on-chain:   │ Address │    │
│  │         │   Amount      │  (encrypted) │   Amount      │         │    │
│  └─────────┘              └──────────────┘               └─────────┘    │
│       │                         ▲                                      │
│       │                         │                                      │
│       ▼                         │                                      │
│  ┌─────────┐   Private TX   ┌──────────────┐                           │
│  │Shielded │ ─────────────▶ │   Merkle     │                           │
│  │ Address │   on-chain:    │    Tree      │                           │
│  │         │   COMMITMENT    │  (encrypted) │                           │
│  │         │   + NULLIFIER   │              │                           │
│  │         │   + PROOF       │              │                           │
│  └─────────┘   (OPAQUE)     └──────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Integration with Existing Features

| Feature | Current | With Shielded |
|---------|---------|---------------|
| Merkle Tree | ✅ | ✅ (expanded) |
| Nullifiers | ✅ | ✅ (expanded) |
| Viewing Keys | ✅ | ✅ (works with both) |
| Compliance | ✅ | ✅ |
| Shielded Addresses | ❌ | ✅ NEW |
| Private Transfers | ❌ | ✅ NEW |

---

## Migration Strategy

### Phase 1: Backward Compatibility

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MIGRATION STRATEGY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: Backward Compatible                                             │
│  • Introduce shielded addresses alongside existing                         │
│  • Users can have both public and shielded addresses                       │
│  • No breaking changes                                                    │
│                                                                             │
│  Phase 2: Feature Parity                                                  │
│  • Shielded transfers between users                                       │
│  • Shielded to public conversions                                          │
│  • Full feature set available                                              │
│                                                                             │
│  Phase 3: Default Privacy                                                 │
│  • New users get shielded addresses by default                            │
│  • Deprecate public-only mode                                             │
│  • Migration tools for existing users                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### User Experience

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER EXPERIENCE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  New User Flow:                                                             │
│                                                                             │
│  1. Create Wallet ─────────▶ Auto-generate shielded address                │
│         │                                                                    │
│         ▼                                                                    │
│  2. Receive Screen ───────▶ Show both public AND shielded address          │
│         │                                                                    │
│         ▼                                                                    │
│  3. Send Screen ──────────▶ Default to shielded (can toggle)              │
│                                                                             │
│  Existing User:                                                             │
│                                                                             │
│  1. Update app ──────────▶ Get prompted to generate shielded address       │
│         │                                                                    │
│         ▼                                                                    │
│  2. One-time setup ───────▶ Generate and backup shielded keys              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tradeoffs & Considerations

### Security Tradeoffs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY ANALYSIS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  zkSNARK vs Encryption-Based:                                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ zkSNARK (Option 1)                                                  │   │
│  │ ✅ Mathematically proven - even with infinite compute              │   │
│  │    can't break privacy                                              │   │
│  │ ❌ Complex trusted setup                                           │   │
│  │ ❌ If setup compromised, privacy breaks                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Encryption + Proofs (Option 3) [RECOMMENDED]                       │   │
│  │ ✅ Simpler, proven primitives                                      │   │
│  │ ✅ No trusted setup                                                │   │
│  │ ⚠️ Security depends on encryption strength                         │   │
│  │ ⚠️ Requires careful implementation                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Performance Tradeoffs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PERFORMANCE IMPACT                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Current (Public Transfer):                                                │
│  • On-chain: 1 transaction                                                │
│  • Time: ~400ms (Solana block time)                                       │
│  • Cost: ~$0.001                                                           │
│                                                                             │
│  With Shielded Transfer:                                                   │
│  • On-chain: 1 transaction (but larger)                                    │
│  • Time: ~400ms + zkSNARK proving (1-10s)                                │
│  • Cost: ~$0.01-0.10 (more compute)                                       │
│                                                                             │
│  Trade-off: More privacy = More compute                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Regulatory Considerations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REGULATORY FLEXIBILITY                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Pro:                                                                      │
│  • Viewing keys still work (mandatory compliance)                          │
│  • Can provide regulatory access when required                             │
│  • Better than completely opaque (Monero)                                  │
│                                                                             │
│  Con:                                                                      │
│  • May face regulatory scrutiny for fully private txs                       │
│  • Some jurisdictions may ban shielded addresses                           │
│  • Need legal consultation for each jurisdiction                           │
│                                                                             │
│  Mitigation:                                                              │
│  • Built-in compliance (viewing keys) addresses concerns                    │
│  • Can implement tiered access (KYC → full privacy)                       │
│  • Geographic restrictions possible                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Timeline Estimate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IMPLEMENTATION ROADMAP                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Month 1-2: Core Cryptography                                              │
│  ├── Implement key generation                                              │
│  ├── Implement Pedersen commitments                                        │
│  ├── Implement encryption/decryption                                       │
│  └── Unit tests for all primitives                                         │
│                                                                             │
│  Month 3-4: On-Chain Program                                               │
│  ├── Add shielded pool to Anchor program                                   │
│  ├── Implement shielded transfer instruction                               │
│  ├── Add nullifier checks                                                  │
│  └── Integration tests                                                     │
│                                                                             │
│  Month 5-6: Client Integration                                            │
│  ├── Web wallet support for shielded addresses                            │
│  ├── UI for shielded send/receive                                         │
│  ├── Address book integration                                             │
│  └── End-to-end testing                                                    │
│                                                                             │
│  Month 7: Beta Testing                                                     │
│  ├── Testnet deployment                                                    │
│  ├── Security audit                                                        │
│  └── Bug fixes                                                             │
│                                                                             │
│  Month 8: Launch                                                           │
│  ├── Mainnet deployment                                                    │
│  ├── Documentation                                                         │
│  └── Marketing/announcement                                                │
│                                                                             │
│  Total: ~8 months                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Resource Requirements

| Role | Quantity | Duration |
|------|----------|----------|
| Cryptography Engineer | 1 | 8 months |
| Solana Developer | 1 | 6 months |
| Frontend Developer | 1 | 4 months |
| Security Auditor | 1 | 2 months |

---

## Summary

### What This Enables

| Feature | Benefit |
|---------|---------|
| Complete privacy | No one can see transaction details |
| Regulatory flexibility | Viewing keys still work |
| Competitive advantage | First on Solana |
| Maximum user choice | Privacy for those who want it |

### Key Decisions Needed

1. **Implementation approach**: zkSNARK vs Encryption-based
2. **Timeline**: Start now vs Defer
3. **Resource allocation**: Dedicated team vs Concurrent
4. **Regulatory strategy**: Proactive legal review

### Next Steps

1. **Decision**: Choose implementation path
2. **Research**: Deep dive into chosen cryptographic libraries
3. **Audit**: Security review of proposed architecture
4. **Prototype**: Build minimal viable shielded transfer
5. **Iterate**: Based on learnings from prototype

---

## Appendix: Reference Implementations

- [ZCash Sapling](https://github.com/zcash/zcash) - Reference implementation
- [Aztec Protocol](https://github.com/AztecProtocol/aztec3) - Ethereum rollup privacy
- [Mina Protocol](https://github.com/MinaProtocol/mina) - Lightweight zkSNARK
- [rage-dalek](https://github.com/ashhanai/rage-dalek) - Rust ElGamal encryption

---

*Document Version: 1.0*
*Last Updated: 2026-02-17*
*Authors: [To be added]*
