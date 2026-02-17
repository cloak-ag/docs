# Cloak Viewing Keys Implementation

## Complete Technical Documentation

---

## Table of Contents

1. [The Original Problem](#the-original-problem)
2. [What Are Viewing Keys?](#what-are-viewing-keys)
3. [The ZCash Model](#the-zcash-model)
4. [How Cloak Implemented Viewing Keys](#how-cloak-implemented-viewing-keys)
5. [Code Changes & Implementation Details](#code-changes--implementation-details)
6. [The Compliance Feature](#the-compliance-feature)
7. [Database Storage: What We Store vs. What We Don't](#database-storage-what-we-store-vs-what-we-dont)
8. [Summary](#summary)

---

## The Original Problem

### Before Viewing Keys

In the original Cloak implementation, there was **no way** for:

1. **Users** to view their own transaction history (private balance)
2. **Admins/Regulators** to audit transaction history for compliance

The system had:
- Shielded transactions (encrypted amounts and recipients)
- Merkle tree commitments on-chain
- Zero-knowledge proofs for transaction validity

**But there was a critical missing piece**: Once a transaction was committed to the Merkle tree, there was no mechanism to:
- Decrypt and view the transaction details
- Generate compliance reports for regulators
- Allow users to see their own transaction history

### The Privacy Paradox

This created a paradox:
- Users couldn't prove their transaction history
- Regulators couldn't verify **compliance**
- Even the users themselves couldn't see what transactions they had made

This is unlike traditional banking where both the customer and the institution can view transaction history.

---

## What Are Viewing Keys?

### Definition

A **viewing key** is a cryptographic key that allows someone to decrypt and view transaction details that would otherwise be private (encrypted) in a shielded pool.

### Types of Viewing Keys

1. **User's Viewing Key**: Derived from the user's wallet, allows viewing own transactions
2. **Compliance Viewing Key**: Shared with a third party (like Cloak), allows auditing

### The Analogy

Think of it like a bank statement:
- Without viewing keys: The bank vault is completely opaque - no one can see inside
- With viewing keys: The user has a "read-only key" to see their own statements, while auditors have a "compliance key" to verify regulatory compliance

---

## The ZCash Model

ZCash is the canonical example of viewing keys in practice. Here's how it works:

### Two Zones

```
┌───────────────────────────────────────────────────────────┐
│                    ZCASH ARCHITECTURE                     │
├───────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐      ┌─────────────────────────┐ │
│  │  TRANSPARENT ZONE   │      │    SHIELDED POOL        │ │
│  │                     │      │                         │ │
│  │  Regular public     │      │  Zero-knowledge proofs  │ │
│  │  transactions       │◀────▶│  hide:                  │ │
│  │                     │      │  • Amount               │ │
│  │  - All balances     │      │  • Sender               │ │
│  │  - All transactions │      │  • Recipient            │ │
│  │                     │      │                         │ │
│  └─────────────────────┘      │  But NOT invisible to   │ │
│                               │  those with viewing keys│ │
│                               └─────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

### How ZCash Viewing Keys Work

1. **When you create a shielded address**, ZCash generates:
   - A **spending key** (can spend funds - keep secret!)
   - A **viewing key** (can see transactions - can share)

2. **The viewing key allows**:
   - Decrypting incoming payments
   - Viewing transaction history
   - Generating audit trails

3. **Key difference from ZCash**: Viewing keys in ZCash are **OPTIONAL**
   - Users can choose to share their viewing key or not
   - No one can force a user to reveal their transaction history

---

## How Cloak Implemented Viewing Keys

### Design Decisions

Based on ZCash but adapted for Cloak's architecture:

| Aspect | ZCash | Cloak |
|--------|-------|-------|
| Viewing Key | Optional | **Mandatory** |
| Sharing | User decides | Auto-shared with Cloak |
| Compliance | Not built-in | **Built-in feature** |
| Storage | Wallet-side | Relay server |

### Why Mandatory?

Cloak chose mandatory viewing keys because:

1. **Regulatory Compliance**: Unlike ZCash (which prioritizes maximum privacy), Cloak needs to support compliance requirements for real-world adoption
2. **User Safety**: Prevents illegal use of the protocol
3. **Institutional Adoption**: Institutions require audit trails

### The Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                      CLOAK VIEWING KEYS ARCHITECTURE                      │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                     USER'S ENCRYPTION KEY                          │   │
│  │                                                                    │   │
│  │   Wallet Signature ──▶ PBKDF2 ──▶ Encryption Key (in memory)       │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  ┌──────────────────────────────┐    ┌──────────────────────────────────┐ │
│  │    USER'S VIEWING KEY        │    │   COMPLIANCE VIEWING KEY         │ │
│  │                              │    │                                  │ │
│  │  Derived from encryption     │    │  Derived from master compliance  │ │
│  │  key via PBKDF2              │    │  key (relay's public key)        │ │
│  │                              │    │                                  │ │
│  │  Used to:                    │    │  Used to:                        │ │
│  │  • Decrypt own UTXOs         │    │  • Encrypt transaction metadata  │ │
│  │  • View private balance      │    │  • Allow admin compliance audit  │ │
│  │                              │    │                                  │ │
│  └──────────────────────────────┘    └──────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Connects Wallet
        │
        ▼
┌─────────────────────────────┐
│  Encryption Provider        │
│                             │
│  1. Wallet signs message    │
│  2. PBKDF2 derives key      │
│  3. Key stored in memory    │
└─────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐    ┌─────────────────────────┐
│  User's Viewing Key           │    │  Compliance Key         │
│  (on device)                  │    │  (shared with relay)    │
│                               │    │                         │
│  • Decrypt UTXOs locally      │    │  • Encrypt tx metadata  │
│  • View private balance       │    │  • Enable compliance    │
└───────────────────────────────┘    └─────────────────────────┘
```

---

## Code Changes & Implementation Details

### 1. Encryption Provider (`web/components/encryption-provider.tsx`)

This is the core component that handles viewing key derivation.

**Location**: `web/components/encryption-provider.tsx`

**What it does**:
- Signs a message with the user's wallet on connect
- Derives encryption key using PBKDF2
- Stores the key in memory (NOT in localStorage for security)
- Provides `useEncryptionReady()` hook for components

```typescript
// Key code changes:
const ENCRYPTION_MESSAGE =
  "Cloak: Sign in\n\n" +
  "Sign this message to securely access your Cloak account.\n" +
  "This does NOT authorize any transaction or spend any funds.";

// On wallet connect:
const signature = await signMessage(encoded);
const sigHex = Array.from(signature)
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

// Use hex-encoded signature as the "password" for PBKDF2
const ok = await initStorageEncryption(sigHex);
```

### 2. Crypto Storage Library (`web/lib/crypto-storage.ts`)

Handles the actual encryption/decryption logic.

**Location**: `web/lib/crypto-storage.ts`

**Functions**:
- `initStorageEncryption(password)` - Initialize encryption with derived key
- `isEncryptionReady()` - Check if encryption is initialized
- `clearEncryptionKey()` - Clear key from memory on disconnect

### 3. SDK Integration (`web/hooks/use-cloak-sdk.ts`)

The Cloak SDK was extended to support viewing keys for compliance.

**Location**: `web/hooks/use-cloak-sdk.ts`

**New functions added**:
- `exportComplianceHistoryPdf()` - Export compliance as PDF
- `exportComplianceHistoryCsv()` - Export compliance as CSV

```typescript
// Compliance export flow:
const exportComplianceHistoryPdf = useCallback(async (): Promise<void> => {
  // 1. Get nonce from relay
  const nonceResponse = await fetch(`${relayUrl}/compliance/nonce`);
  const { nonce } = await nonceResponse.json();

  // 2. Sign the nonce with user's wallet
  const messageBytes = new TextEncoder().encode(nonce);
  const signatureBytes = await signMessage(messageBytes);
  const signature = Buffer.from(signatureBytes).toString("base64");

  // 3. Request compliance export
  const response = await fetch(`${relayUrl}/compliance/export`, {
    method: "POST",
    body: JSON.stringify({ user_pubkey, signature, format: "pdf" }),
  });

  // 4. Download the file
  const blob = await response.blob();
  // ... download logic
}, [publicKey, signMessage, relayUrl]);
```

### 4. Balance Mode UI (`web/app/privacy/_components/BalanceMode.tsx`)

Updated the UI to replace transaction history with compliance export buttons.

**Location**: `web/app/privacy/_components/BalanceMode.tsx`

**Changes**:
- Removed: Transaction history table (was showing locally decrypted metadata)
- Added: "Export PDF" and "Export CSV" buttons for compliance

```tsx
// New UI components:
<button
  onClick={exportCompliancePdf}
  disabled={isExportingCompliance || !connected}
  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#31146F]..."
>
  <FileDown className="w-4 h-4" />
  {isExportingCompliance ? "Exporting..." : "Export PDF"}
</button>

<button
  onClick={exportComplianceCsv}
  disabled={isExportingCompliance || !connected}
  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-700..."
>
  <FileSpreadsheet className="w-4 h-4" />
  {isExportingCompliance ? "Exporting..." : "Export CSV"}
</button>
```

### 5. State Management (`web/app/privacy/_hooks/usePrivacyPageState.ts`)

Added state and handlers for compliance export.

**Location**: `web/app/privacy/_hooks/usePrivacyPageState.ts`

**New state**:
- `isExportingCompliance` - Loading state for export
- `exportCompliancePdf` - Handler for PDF export
- `exportComplianceCsv` - Handler for CSV export

---

## The Compliance Feature

### How Compliance Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLIANCE EXPORT FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User clicks "Export PDF"                                       │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Browser requests nonce from relay                     │   │
│  │    GET /compliance/nonce                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 2. User signs nonce with wallet                          │   │
│  │    (proves they own the address)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 3. Browser POSTs to /compliance/export                   │   │
│  │    { user_pubkey, signature, format: "pdf" }             │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 4. Relay validates signature                             │   │
│  │    - Verifies nonce was signed by the user               │   │
│  │    - Queries blockchain indexer                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 5. Blockchain Indexer scans for Cloak transactions       │   │
│  │    - Deposit transactions                                │   │
│  │    - Withdraw transactions                               │   │
│  │    - Computes running balance                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 6. Relay returns PDF/CSV                                 │   │
│  │    - Transaction list                                    │   │
│  │    - Summary (deposits, withdrawals, net)                │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                                     │
│           ▼                                                     │
│  User downloads PDF/CSV file                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Admin Compliance API

For admins to query any user's compliance data:

**Endpoint**: `POST /admin/compliance/decrypt`

**Requires**:
- Admin wallet signature
- Target user address
- Optional date range (after/before)

**Returns**:
- Full transaction history
- Summary statistics

---

## Database Storage: What We Store vs. What We Don't

### What We DON'T Store

**❌ We do NOT store transaction history in a database**

This is a critical design decision. The compliance data is NOT persisted in any database. Instead:

1. **The relay indexes the blockchain** in real-time
2. **For each query**, it scans for Cloak protocol transactions
3. **Computes on-demand** - no storage required

This means:
- No database of user transactions
- No compliance data at rest
- Complete privacy (data only exists on-chain)

### What We DO Store

**✅ What IS stored:**

1. **Encryption Key Material** (in user's browser memory only)
   - Derived from wallet signature
   - Never stored on disk or in database

2. **Encrypted UTXO Data** (local storage)
   - User's own UTXOs, encrypted with their viewing key
   - Stored locally in browser, not on server

3. **Relay Server State** (runtime, not persisted)
   - Session data for API authentication
   - No long-term transaction storage

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA STORAGE ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    USER'S BROWSER                           │    │
│  │                                                             │    │
│  │  ┌─────────────────────────────────────────────────────┐    │    │
│  │  │ In-Memory (never persisted):                        │    │    │
│  │  │ • Encryption key (derived from wallet signature)    │    │    │
│  │  │ • Decrypted UTXO view keys                          │    │    │
│  │  └─────────────────────────────────────────────────────┘    │    │
│  │                                                             │    │
│  │  ┌─────────────────────────────────────────────────────┐    │    │
│  │  │ LocalStorage (encrypted):                           │    │    │
│  │  │ • User's UTXOs (encrypted with viewing key)         │    │    │
│  │  │ • Wallet keys (encrypted)                           │    │    │
│  │  └─────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                              │ (requests)                           │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      RELAY SERVER                           │    │
│  │                                                             │    │
│  │  ┌─────────────────────────────────────────────────────┐    │    │
│  │  │ NO DATABASE - Computed on-demand:                   │    │    │
│  │  │ • Indexes blockchain for Cloak txs                  │    │    │
│  │  │ • Returns transactions + summary                    │    │    │
│  │  │ • No persistent storage of user data                │    │    │
│  │  └─────────────────────────────────────────────────────┘    │    │
│  │                                                              │    │
│  │  Runtime only:                                              │    │
│  │  • Session management                                      │    │
│  │  • API rate limiting                                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                              │ (scans)                              │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   SOLANA BLOCKCHAIN                         │    │
│  │                                                              │    │
│  │  • Deposit transactions (public)                           │    │
│  │  • Withdraw transactions (public)                          │    │
│  │  • Merkle tree commitments (encrypted data)                │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Design?

1. **Privacy**: No central database of transactions = harder target for hackers
2. **Trust**: Users don't have to trust us with their data
3. **Regulatory Compliance**: Still works because we can compute compliance on-demand
4. **Simplicity**: No database sync, no migration issues
5. **Security**: Encryption keys never leave user's device

---

## Summary

### What Was Implemented

1. **Viewing Keys**: Cryptographic keys derived from wallet signature allowing transaction decryption
2. **User Viewing**: Users can view their own private balance via decrypted UTXOs
3. **Compliance Export**: Users can export their transaction history as PDF/CSV
4. **Admin API**: Admins can query any user's compliance data (with authorization)

### Code Changes Made

| File | Changes |
|------|---------|
| `encryption-provider.tsx` | Core viewing key derivation logic |
| `crypto-storage.ts` | Encryption/decryption utilities |
| `use-cloak-sdk.ts` | Added compliance export functions |
| `BalanceMode.tsx` | Added export buttons UI |
| `usePrivacyPageState.ts` | Added export state management |

### Key Differences from ZCash

| Aspect | ZCash | Cloak |
|--------|-------|-------|
| Viewing Keys | Optional | Mandatory |
| Storage | Wallet-side | Relay (computed) |
| Compliance | Not built-in | Built-in |
| User Control | Full control | Protocol-level |

### Data Storage Philosophy

- **Never store** transaction history in a database
- **Always compute** compliance on-demand from blockchain
- **Keep keys** in user's browser memory only
- **Encrypt locally** - server never sees plain text

---

## Questions?

If you have questions about the implementation, refer to:
- Architecture docs: `docs/architecture/viewing-keys-compliance.md`
- Code: `web/components/encryption-provider.tsx`
- Tests: (if available)
