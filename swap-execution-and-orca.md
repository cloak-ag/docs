# Swap Execution Architecture: Jupiter (Default)

**Status:** Current state + options  
**Last Updated:** 2026-02-20

---

## Non-Custodial Requirement

**Cloak must never custody user assets.** The relay is fee-payer and transaction submitter only. All token flows go:

1. **Deposit**: User → program-owned pool
2. **Transfer**: Pool → pool (internal)
3. **Withdraw**: Pool → recipient (direct, program CPI)
4. **Swap**: Pool → SwapState PDA → wSOL ATA (PDA-owned) → DEX CPI → recipient ATA

The relay never holds wSOL or output tokens. The SwapState PDA signs for the swap via CPI; our program invokes the DEX with the PDA as authority. Any design that requires the relay to hold assets (e.g. off-chain swap, relay-as-intermediary) is not acceptable.

---

## Why Swaps Must Happen On-Chain

The Cloak protocol is UTXO-based. A private swap burns a shielded UTXO (e.g. SOL-denominated) and creates a shielded UTXO in another token. The swap (wSOL → output token) **must execute atomically** with proof verification:

1. **TX1 – TransactSwap**: User submits a Groth16 proof. The program validates it, burns the nullifier, creates a `SwapState` PDA, and transfers SOL to it. No token swap yet.
2. **TX2 – PrepareSwapSol + ExecuteSwapJupiter**: Relay submits:
   - `PrepareSwapSol` – SOL → wSOL ATA owned by SwapState
   - `ExecuteSwapJupiter` – SyncNative + Jupiter CPI + SPL transfer (PDA output ATA → recipient) + close SwapState

The Jupiter CPI runs **inside the same program invocation**. The SwapState PDA owns the wSOL ATA and signs for the swap via CPI. Output tokens go straight to the recipient ATA. The relay never custodies assets.

**Off-chain swaps would break this design:**

- If the relay swapped off-chain, it would need to hold wSOL or tokens, becoming custodial.
- If the user swapped separately, we lose atomicity and privacy: the proof and swap are no longer tied.

So the swap **has to** run as a CPI from the shield-pool program.

---

## Current State: Jupiter (Default)

### What the program does

- **ExecuteSwapJupiter (instruction 7)**: SyncNative + Jupiter CPI. Swap into PDA output ATA, SPL transfer to recipient, close PDA ATA, close SwapState.

### What the relay does

- Jupiter Quote + swap-instructions API with PDA as user. All swaps go through Jupiter.


---

## Comparison: Privacy Cash

[Privacy Cash](../reference/privacy-cash/) (reference implementation) implements SOL and SPL deposit/withdraw; **private swap will soon follow** (not yet implemented). Their design:

- **Pool ownership**: Funds live in program-owned accounts (`tree_token_account` for SOL, `tree_ata` for SPL). The program PDA is authority.
- **User-signer model**: The **user** signs the `transact`/`transact_spl` call. Withdrawals transfer directly from pool to recipient in the same instruction. No relay in the critical path.
- **Cloak difference**: Our swap flow requires a **two-step** execution because the user doesn't have wSOL—the SwapState PDA does after TX1. The relay submits TX2 as fee-payer. The relay never custodies: the PDA signs for the DEX CPI. Same non-custodial principle; different execution model (relay-submitted vs user-signed).

---

## Why Orca Is Annoying

1. **Single DEX lock-in**: Only Orca Whirlpool works. If Jupiter’s best route is Raydium, Lifinity, etc., we ignore it and force Orca.
2. **Orca-specific plumbing**: Tick arrays, oracle, vault layout, account order. Our program and relay both speak Orca’s format.
3. **Pool discovery split**: Jupiter tells us best route; we filter for Orca, then do our own Orca account derivation (tick arrays, etc.).
4. **Maintenance**: Orca’s program/accounts can change; we must keep our CPI and client in sync.

---

## Options

### A. Keep Orca (status quo)

- **Pros**: Works today, non-custodial, proven.
- **Cons**: Lock-in, complexity, suboptimal routing when Orca isn’t best.

### B. Enable Jupiter path when 6025 is fixed

- **Pros**: One CPI target; Jupiter routes across all supported DEXes.
- **Cons**: Depends on Jupiter/Jupiter Route supporting PDA-as-user. Need to re-test periodically (e.g. with `get_swap_instructions_for_pda`).

**Action**: Periodically re-test Jupiter with PDA user; if it works, switch relay to `ExecuteSwapJupiter`. Use `CLOAK_TRY_JUPITER_SWAP=true` to attempt Jupiter first, with Orca fallback.

### C. Add more DEX CPIs (Raydium, etc.)

- **Pros**: Less dependence on a single DEX.
- **Cons**: More program code, more relay logic, more maintenance. Does not solve "best route" routing.

---

## Recommendation

1. **Short term**: Keep Orca. Document clearly that ExecuteSwap is Orca-only and Jupiter is used for pool discovery.
2. **Medium term**: Re-test Jupiter PDA path (e.g. quarterly or when Jupiter changelog hints at PDA support). If 6025 is resolved, switch to ExecuteSwapJupiter as primary and keep Orca as fallback.
3. **Avoid**: Adding multiple DEX CPIs unless we have a concrete need Orca cannot satisfy.

---

## Files Reference

| Layer       | Orca-specific                | Jupiter / generic           |
|-------------|------------------------------|-----------------------------|
| Program     | `execute_swap.rs`            | `execute_swap_jupiter.rs`   |
| Relay       | `swap_handler.rs` (Orca CPI) | `jupiter.rs` (swap-instructions, unused) |
| Transaction | `build_execute_swap_instruction_with_pda` | `build_execute_swap_jupiter_instruction` |

---

## Testing Jupiter (Non-Custodial)

To test whether Jupiter now supports PDA-as-user, set:

```
CLOAK_TRY_JUPITER_SWAP=true
```

On mainnet, the relay will attempt `get_swap_instructions_for_pda` + `ExecuteSwapJupiter` first. If the Jupiter API or on-chain execution fails (e.g. 6025), it falls back to Orca. The flow remains fully non-custodial: SwapState PDA signs, assets never touch the relay.

---

## Working Around 6025 (Jupiter PDA-as-Destination)

Per [Jupiter error 6025](https://dev.jup.ag/docs/swap/common-errors): `InvalidTokenAccount` — "A token account passed in is invalid, it can be uninitialized or not expected."

**Root cause** (from [Jupiter IDL](https://solscan.io/account/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4#anchorProgramIdl)): The `route` instruction expects both `userSourceTokenAccount` and `userDestinationTokenAccount` to be owned by `userTransferAuthority`. We pass `destinationTokenAccount = recipient_ata` (recipient's ATA). Its owner is the **recipient wallet**, not the PDA. Jupiter rejects: the destination is "not expected" for this user.

**Non-custodial workaround — swap into PDA ATA, then transfer:**

1. Do **not** pass `destinationTokenAccount` to Jupiter; let it derive `ATA(swap_state_pda, output_mint)`.
2. Ensure the PDA's output-mint ATA exists before the swap (relay creates it).
3. Jupiter CPI: wSOL (PDA) → output tokens (PDA's output ATA).
4. Our program (same instruction): SPL Token transfer PDA's output ATA → recipient ATA (PDA signs).
5. Close PDA's output ATA, close SwapState.

The PDA briefly holds output tokens only within the same atomic instruction; we immediately transfer to the recipient. No relay custody.

**Implementation steps:**

- Relay: `get_swap_instructions_for_pda` — omit `destinationTokenAccount` (or pass PDA's output ATA).
- Relay: Ensure PDA's output-mint ATA exists before building the tx.
- Program: `ExecuteSwapJupiter` — after Jupiter CPI, add SPL Token transfer (PDA's output ATA → recipient ATA), then close PDA's output ATA.
