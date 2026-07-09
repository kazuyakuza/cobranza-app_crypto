# Simplification Plan — DTO / Decorator Integration Doc

**File reviewed:** `docs/dto-decorator-integration.md`
**Current size:** 421 lines
**Verdict:** Simplifications proposed

## Summary of Proposed Changes

The document is complete and accurate, but contains redundancy between sections, an over-long Option C, and a comparison table with overlapping criteria. The proposed edits reduce duplication and tighten prose without removing any essential guidance.

## Detailed Simplifications

### 1. Consolidate Prerequisites

**Current:** Numbered list with three items and two cross-links.
**Proposed:** Convert to a single paragraph that states the three requirements inline.

**Rationale:** The requirements are simple and do not need a numbered list. This removes ~4 lines and keeps the focus on implementation.

### 2. Move Interceptor DTO Note to Option B

**Current:** The DTO shape section contains a note stating that `@IsEncryptedField()` is omitted in the interceptor variant. Option B repeats the same explanation.
**Proposed:** Remove the note from the DTO shape section. Keep the full explanation only in Option B's "Validation-timing nuance" subsection.

**Rationale:** The note is contextually relevant only when the reader is studying the interceptor pattern. Removing the duplicate reduces cognitive load.

### 3. Remove "Pitfall — pipe ordering" from Option A

**Current:** Option A ends with a dedicated pipe-ordering pitfall subsection. The same warning appears again in the Common pitfalls section.
**Proposed:** Delete the Option A subsection. Retain and slightly expand the corresponding bullet in Common pitfalls.

**Rationale:** Centralizing the warning in one place avoids duplication and keeps the option sections focused on the happy path.

### 4. Restructure Option C

**Current:** Option C presents two full implementations:

1. Entity listener with static-holder workaround (~70 lines)
2. DI-friendly `@EventSubscriber()` alternative (~55 lines)

The "Recommended patterns" section then explicitly recommends the subscriber approach.
**Proposed:**

- Make `@EventSubscriber()` the primary and only full example in Option C.
- Reduce the entity-listener static-holder pattern to a short "Note on entity listeners" paragraph that explains the DI limitation and links to the subscriber as the preferred solution.

**Rationale:** The static-holder pattern is verbose, harder to maintain, and already discouraged by the recommendation section. Removing it as a full example significantly shortens the document while preserving the security guidance.

### 5. Simplify the Comparison Table

**Current:** 6 rows × 3 columns.

| Criteria | Pipe | Interceptor | Subscriber |
|---|---|---|---|
| Encryption coverage | Controller only | Controller only | All write paths |
| Auditability | Explicit per endpoint | Implicit per route | Transparent at entity layer |
| DI support | Full | Full | Full (subscriber variant) |
| Response decryption | Separate pipe needed | Same interceptor | Not needed |
| Event-driven / batch writes | Not covered | Not covered | Covered |
| Complexity | Low | Low | Medium |

**Proposed:** 4 rows × 3 columns.

| Criteria | Pipe | Interceptor | Subscriber |
|---|---|---|---|
| Coverage | Controller only | Controller only | All write paths (REST, events, batch) |
| DI support | Full | Full | Full |
| Best for | Explicit endpoint transformation | Cross-cutting route logic | Authoritative persistence layer |
| Complexity | Low | Low | Medium |

**Rationale:** "Auditability" and "Response decryption" are inferred from "Best for" and the surrounding prose. "Event-driven / batch writes" is already captured by "Coverage". This makes the table scannable while retaining the decision-making information.

### 6. Tighten the Recommendation Section

**Current:** Three paragraphs restating the comparison table.
**Proposed:** One paragraph:

> Use the `@EventSubscriber()` as the authoritative encryption layer for all TypeORM writes. Add an interceptor or pipe in API-facing services only for inbound shaping and outbound decryption. For services without HTTP endpoints, the subscriber alone is sufficient.

**Rationale:** The table already conveys the trade-offs. The recommendation should be a concise directive.

### 7. Streamline Common Pitfalls

**Current:** Six bullets. Two of them duplicate content from earlier sections (pipe ordering and entity-listener DI limitation).
**Proposed:** Keep four bullets:

1. Pipe ordering with global `ValidationPipe`
2. Logging encrypted payloads
3. Entity-listener DI limitation (one-line pointer to subscriber)
4. Hash column salt consistency
5. Interceptor does not cover non-HTTP triggers
6. Mutating `request.body` directly is fragile

Combine the entity-listener limitation into a single short bullet that refers back to Option C. Remove the separate "Pipe ordering" explanation if it is already covered by the consolidated pitfall.

**Rationale:** The section should be a quick checklist, not a re-read of earlier details.

## Expected Outcome

- Estimated reduction: ~90–110 lines (from 421 to ~310–330 lines).
- Reduced redundancy between option sections and the pitfalls/recommendation sections.
- Comparison table becomes a faster decision aid.
- Option C focuses on the recommended pattern while still acknowledging the entity-listener limitation.

## Files to Modify

- `docs/dto-decorator-integration.md`

## What Was NOT Proposed

- No changes to code semantics or API behavior.
- No removal of complete options (Pipe, Interceptor, Subscriber all remain).
- No changes to external cross-links or references.
