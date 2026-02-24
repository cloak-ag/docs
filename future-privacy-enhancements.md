# Future Privacy Enhancements (Post-Mainnet)

**Status:** Backlog for post-mainnet development  
**Last Updated:** 2026-02-19

This document tracks privacy and usability enhancements planned for after the core mainnet launch. These are valuable but not blockers for v1.

---

## P1: Automatic UTXO Management

**Current State:**
- Users (or apps) must manually track UTXO indices
- Must manually select inputs for transactions
- Must calculate and manage change outputs
- Error-prone: lost UTXO = lost funds

**Target State (ZCash-like):**
- Wallet maintains local UTXO database automatically
- User just sees "balance: 3.5 SOL"
- Wallet auto-selects optimal inputs
- Change handled transparently
- Recovery from seed phrase restores all UTXOs

**Implementation:**
```typescript
// Instead of:
const inputs = [utxo1, utxo2]; // Manual selection

// Automatic:
const amount = BigInt("1000000000");
const tx = await wallet.createTransaction({ amount, recipient });
// Wallet picks inputs, calculates change, generates proof
```

**Why Deferred:**
- Requires wallet software (browser extension/mobile)
- Current SDK approach works for programmatic use
- Mainnet can launch without this

---

## P2: Time-Delayed & Batched Note Publishing

**Current State:**
- Encrypted notes published immediately in transaction
- Timestamp exactly matches block time
- Easy timing correlation attacks

**Target State:**
- Notes published with random delay (e.g., 1-10 blocks)
- Or: Notes batched and published at regular intervals
- Multiple transactions' notes mixed together

**Benefits:**
- Breaks timing correlation
- Observer sees note but doesn't know which tx it belongs to
- Similar to ZCash's block-based discovery

**Implementation Options:**

1. **Delayed Publication:**
```
Tx confirmed at block N
Note actually written at block N+random(1,10)
```

2. **Batch Publication:**
```
Every 10 blocks: publish batch of pending notes
Mixed from multiple transactions
```

**Challenges:**
- Requires state management (relay holds notes temporarily)
- Recipient can't see funds immediately
- UX complexity

**Why Deferred:**
- Significant UX trade-off (delayed visibility)
- Complex implementation
- Current privacy is acceptable for v1

---

## P3: Token-Agnostic Swaps

**Current State:**
- Swap reveals input = SOL, output = specific SPL token
- Token type visible in SwapState PDA

**Target State:**
- Hide which token is being swapped to/from
- Only proof verifier knows token types

**Analysis:**
- **Hard on Solana:** Orca pools are public, can't hide interaction
- **Limited benefit:** Token type often inferrable from amounts/patterns
- **Not priority:** Shielded pool is already privacy-preserving

**Verdict:** Won't implement. Other features provide better ROI.

---

## P4: Pre-Flight Transaction Simulation

**Current State:**
- Transaction submitted → May fail due to stale root
- Retry logic handles it, but wastes time

**Target State:**
- Simulate transaction before proof generation
- Detect stale root early
- Graceful error with clear message

**Easy Implementation:**
```rust
// Before generating proof:
let current_root = get_onchain_root().await?;
if !root_history.contains(proof_root) {
    return Err("Root expired, fetching fresh merkle proof...");
}
```

**Why Easy Fix:**
- One additional RPC call
- Better UX
- Reduces failed transactions

**Status:** Could do for mainnet, not critical

---

## P5: Distributed Relay Network

**Current State:**
- Single relay operator
- Centralization risk
- Censorship possible

**Target State:**
- Multiple relay operators
- Users can choose relay
- Relays compete on fees/uptime
- Fallback if one relay is down

**Architecture:**
```
User Wallet
    ↓
Relay Discovery (registry on-chain)
    ↓
Select Relay (lowest fee, best uptime)
    ↓
Submit proof → Relay
    ↓
Relay submits to Solana
```

**Benefits:**
- Censorship resistance
- No single point of failure
- Market competition

**Why Deferred:**
- Requires governance/registry contract
- Operational complexity
- Single relay is fine for v1

---

## P6: Enhanced Decoy Strategy

**Current State:**
- `cloak-bots/` generates fake transactions
- Fixed schedule

**Target State:**
- Dynamic decoy rate based on real transaction volume
- Decoy transactions have realistic patterns
- Mix real and decoy in same blocks

**Implementation:**
```python
# Decoy controller
real_tx_count = get_recent_tx_count()
decoy_rate = calculate_optimal_decoy_rate(real_tx_count)
for i in range(decoy_rate):
    generate_realistic_decoy_tx()
```

**Status:** `cloak-bots/` is already built, can enhance later

---

## P7: Compliance Export Improvements

**Current State:**
- Admin wallet can export any user's history
- Requires viewing key registration

**Target State:**
- Time-bounded exports (only last 90 days)
- Audit logs for compliance access
- User notification when exported
- Opt-in compliance (user chooses which relay has viewing key)

**Why Deferred:**
- Current system works for v1
- Legal/regulatory requirements still evolving
- Can add restrictions without protocol changes

---

## Summary: Mainnet vs Post-Mainnet

| Feature | Mainnet (v1) | Post-Mainnet |
|---------|--------------|--------------|
| Core shielded transfers | ✅ | ✅ |
| Decoy transactions | ✅ (basic) | ✅ (enhanced) |
| Compliance export | ✅ | ✅ (with restrictions) |
| Automatic UTXO mgmt | ❌ | ✅ |
| Stealth addresses | ❌ | ✅ |
| Time-delayed notes | ❌ | ✅ (if desired) |
| Distributed relays | ❌ | ✅ |
| Pre-flight validation | ⚠️ (optional) | ✅ |

**Focus for mainnet:** Get the core working securely.
**Post-mainnet:** UX improvements and advanced privacy features.

---

## Related Documents

- `docs/future-recipient-privacy.md` - Stealth/unified addresses
- `docs/chain-native-viewing-circuit-plan.md` - Current architecture
