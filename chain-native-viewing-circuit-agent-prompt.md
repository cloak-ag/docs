# Autonomous Agent Prompt: Chain-Native Viewing Circuit Upgrade

Use this prompt to run an agent that implements the full chain-native viewing circuit upgrade in one continuous run, without asking for follow-ups or confirmation.

---

## Prompt (copy-paste this)

You are implementing the **chain-native viewing circuit upgrade** for this Cloak repo. Your only job is to achieve the **definition of done** below. Work in one continuous run until it is achieved.

**Single source of truth:** `docs/chain-native-viewing-circuit-plan.md`  
Read it fully. It contains the frozen spec (preimage schema, hash function, public input layout, instruction layout, test vectors) and the concrete work breakdown.

**Definition of done (all must be true):**
1. Circuit enforces `chain_note_hash` constraints (preimage fields, Poseidon, binding to tx semantics and output commitment).
2. SDK produces valid proofs with the upgraded public input layout (264 bytes including `chain_note_hash`); builds note plaintext first, computes hash, injects into witness/public inputs, encrypts same plaintext into CLVK payload.
3. Program verifies upgraded proofs (expects new public input ordering).
4. Relay compliance decrypt/export verifies `hash(decrypted note) == on-chain chain_note_hash` and rejects mismatches; no `viewing_key_commitment` in request types or instruction encoding.
5. No `viewing_key_commitment` anywhere: removed from SDK, relay, program instruction layout, and any scanners.
6. Validation checklist passed: `send-partial` works without `viewing_key_commitment`; `scan-chain-notes` finds/decrypts correctly; admin compliance decrypt/export matches scanner; negative test (tampered note) is rejected by hash verification.

**Execution order (follow this):**
1. Freeze/align code with the frozen spec in the plan (preimage 90 bytes, field order, Poseidon, etc.).
2. Circuits: add `chain_note_hash` public input and constraints; regenerate wasm/zkey/verifier artifacts; update tests (positive + negative vectors from plan).
3. Program: update verifier / public input layout expectations for 264-byte public inputs.
4. SDK: note plaintext → hash → witness/public inputs → encrypt same plaintext; remove all `viewing_key_commitment` usage; scanner remains decrypt-first.
5. Relay: remove `viewing_key_commitment` handling; add hash verification after decrypt; reject on mismatch.
6. Program instruction layout: remove trailing 32-byte `viewing_key_commitment`; keep `[discriminator|proof|public_inputs:264][CLVK envelope]`.
7. Run full E2E and validation checklist; fix any failures until all items in the definition of done hold.

**Rules for you:**
- Do **not** ask the user for confirmation or “should I do X?”. Decide and do it. If something is ambiguous in the plan, choose a consistent interpretation and document it in code or a short comment.
- Assume you have full access to the repo, build tools, and any needed env (e.g. Node, Rust, Anchor). If a command or step fails, fix the cause and retry; do not stop to ask.
- Work in sequence where one step depends on another (e.g. circuit artifacts before SDK/verifier). Within a step, parallelize only when safe.
- Do not pause “to let the user review.” Only stop when the definition of done is fully satisfied and the validation checklist has been run successfully.
- If you need to touch config, dependencies, or scripts to build/run tests, do it. If the plan doc and codebase disagree, prefer the plan doc and update code to match the frozen spec.

Start by reading `docs/chain-native-viewing-circuit-plan.md`, then execute the work breakdown in order until the definition of done is achieved.
