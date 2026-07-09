# Task 4 — Documentation Simplification Plan

## Scope

Review and simplify:

- `README.md`
- `docs/how-to-configure-in-nestjs.md`
- `docs/README.md`

## Simplification Opportunities

### 1. `README.md`

| # | Location | Issue | Proposed Change |
|---|----------|-------|-----------------|
| 1.1 | `Configuration` + `Usage Examples > Setup` | The `CryptoConfig` example is repeated almost verbatim. | Keep the example in `Configuration`. In `Usage Examples`, replace the setup block with a one-line reference: "All examples assume a configured `SecureCrypto` instance (see [Configuration](#configuration))." |
| 1.2 | `Overview / Purpose` + `Usage Examples` intro | AES-256-GCM and HMAC-SHA256 algorithms are described twice. | State algorithms once in `Overview`. Remove the duplicate sentence from `Usage Examples`. |
| 1.3 | `Usage Examples > Encrypt` + `Testing` | The non-deterministic ciphertext note appears twice. | Keep the note in `Testing`. Remove it from `Usage Examples`. |
| 1.4 | `Overview / Purpose` > non-goals | Bullet points are wordy. | Tighten each bullet to a single clause (e.g., "No `process.env` reads; pass all config via `CryptoConfig`)." |
| 1.5 | `Status / Stability` | Paragraph is verbose and partly duplicates `Overview`. | Merge into `Overview` or reduce to one sentence: "All API methods are implemented; algorithms may evolve before v1.0." |
| 1.6 | `NestJS Integration Guide` | Provides a minimal factory that duplicates the full guide in `docs/how-to-configure-in-nestjs.md`. | Reduce to a short paragraph and link to the full guide; remove the inline factory code. |
| 1.7 | `Performance Notes` | Some advice is repeated (HKDF cache, cache isolation). | Consolidate into one note per topic; remove redundant "do NOT" warnings. |
| 1.8 | `API Summary` table | Description for `constructor` is long. | Shorten to "Validates and stores config." |

### 2. `docs/how-to-configure-in-nestjs.md`

| # | Location | Issue | Proposed Change |
|---|----------|-------|-----------------|
| 2.1 | `Reusable CryptoModule` + `Provider with ConfigService` | Both sections show the same `useFactory` block; only the enclosing module differs. | Keep `Reusable CryptoModule` as the recommended pattern. In `Provider with ConfigService`, show only the provider object and note that it can be placed in any module. |
| 2.2 | `Overview` | Sentence is more complex than needed. | Simplify to: "Inject `CryptoConfig` explicitly; the library does not read `process.env`." |
| 2.3 | `Key Versioning & Rotation` | Repeats the rotation steps already documented in `README.md`. | Replace the repeated steps with: "See the [Key Rotation Procedure](../README.md#key-rotation-procedure) in the README." Keep only the NestJS-specific bullets (env var, secrets store, background job). |
| 2.4 | `Common Pitfalls` | Explanations are verbose. | Reduce each bullet to one sentence plus the fix. |
| 2.5 | `Deployment & Secret Management` | First two bullets duplicate `README.md` > `Security Best Practices` > `Key Storage`. | Keep concise NestJS-specific guidance; link to README for the full list. |
| 2.6 | `DTO + Decorator Integration` | The note about `EncryptionKey` location repeats the note in `README.md`. | Keep the note only where it first appears or make it shorter. |

### 3. `docs/README.md`

| # | Location | Issue | Proposed Change |
|---|----------|-------|-----------------|
| 3.1 | `For Library Consumers` | Lists README contents that are already in the README table of contents. | Remove the bullet list; keep the link to `README.md` and the two consumer guide links. |
| 3.2 | `For AI Agents` + `Project Information` + `Configuration Files` | Already minimal; no changes needed beyond terminology alignment. | — |

### 4. Cross-File Terminology Alignment

| Term | Current Variations | Proposed Standard |
|------|-------------------|-------------------|
| Master encryption key | `masterKey`, `master key`, `Master Key` | Use `masterKey` in code/config contexts; "master key" in prose. |
| Hash salt | `hashSalt`, `hash salt`, `Hash Salt` | Use `hashSalt` in code/config contexts; "hash salt" in prose. |
| Encrypted payload field | `encryptedData`, `encrypted data`, `EncryptedValue.encryptedData` | Use `encryptedData` when referring to the property; `EncryptedValue` when referring to the object. |
| Key rotation heading | `Key Rotation Procedure`, `Key Versioning & Rotation` | Keep `Key Rotation Procedure` in README; use `Key Versioning & Rotation` in NestJS guide only as a section title linking to the canonical procedure. |
| Config version | `currentVersion`, `version` | Use `currentVersion` for the config setting; `version` for the value stored in `EncryptedValue`. |

## Implementation Steps

1. Edit `README.md`:
   - Remove duplicate `CryptoConfig` example from `Usage Examples > Setup`.
   - Remove duplicate algorithm sentence from `Usage Examples` intro.
   - Remove duplicate non-deterministic ciphertext note from `Usage Examples > Encrypt`.
   - Tighten non-goals bullets.
   - Condense `Status / Stability`.
   - Replace `NestJS Integration Guide` factory code with a short paragraph and link.
   - Consolidate `Performance Notes`.
   - Shorten `constructor` row in API Summary.

2. Edit `docs/how-to-configure-in-nestjs.md`:
   - Simplify `Overview` sentence.
   - Remove redundant `useFactory` block in `Provider with ConfigService`; show only the provider object.
   - Replace duplicated rotation steps with a link to README.
   - Tighten `Common Pitfalls` bullets.
   - Reduce `Deployment & Secret Management` to NestJS-specific points and link to README.
   - Remove or shorten duplicate `EncryptionKey` location note.

3. Edit `docs/README.md`:
   - Remove the README contents bullet list under `For Library Consumers`.

4. Verify:
   - Run `npm run lint` or `markdownlint` if available.
   - Review all internal links still resolve.
   - Ensure no code examples were broken by deletions.

## Expected Outcome

- Reduced word count and visual repetition across the three files.
- Consistent terminology for cryptographic concepts and config fields.
- Shorter, scannable docs without loss of essential security or usage guidance.
- All cross-references remain functional.
