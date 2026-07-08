# Tech: `@cobranza-apps/crypto`

> Source of truth: [brief.md](brief.md). Resolve inconsistencies in favor of brief.md.

## Tech Stack

- **Language**: TypeScript.
- **Runtime**: Node.js 22.14.0 (per `.nvmrc`).
- **Cryptography**: Node.js built-in `crypto` module (no runtime dependencies).
- **Peer / Regular Dependency**: `@cobranza-apps/entities` (provides `EncryptedValue` interface and related contracts).

## Package Manager

npm (standard). No lock file present at initialization time.

## Build & Tooling

- **Build**: `tsc` compiles to `dist/` (gitignored).
- **Test runner**: Jest with `ts-jest` for TypeScript support.
- **Scripts** (planned):
  - `build` — compile TypeScript.
  - `test` — run unit tests.
  - `test:watch` — watch mode for tests.
  - `lint` — static analysis (to be configured in Phase 2).

## Dev Dependencies

- `typescript` — TypeScript compiler.
- `@types/node` — Node.js type definitions.
- `jest` — test framework.
- `ts-jest` — Jest TypeScript transformer.
- `@types/jest` — Jest type definitions.

## Dev Setup

Steps to be executed in later tasks:
1. `npm install` — install dependencies.
2. `npm run build` — compile the library.
3. `npm test` — verify tests pass.

## Technical Constraints

Derived from `brief.md` §7 and §10:

- No `process.env` loading inside the library; all config passed explicitly.
- Framework-agnostic: no hard dependency on NestJS or any other framework.
- Node.js only; browser environments are not supported.
- Fail closed: throw errors instead of returning partial results.
- No password hashing (out of scope).
- No business logic or database interaction.
- Design for future post-quantum algorithm swap.

## Code Standards

Enforced by `.kilo/rules/`:

- **Max lines per file**: `src/` files ≤200 lines (ideally ≤125), excluding blanks/comments/imports.
- **Max lines per method**: ≤50 lines (excluding signature).
- **Max arguments per method**: ≤2 params; use object/type for 3+.
- **Max depth**: ≤2 levels of nesting; extract to method at level 3.
- **Single-section boolean conditions**: complex conditions extracted to named methods.
- **Private members by default**: only make public when absolutely necessary.
- **No commented code**: commented-out code must be removed.
- **Self-documenting code**: prefer descriptive names over comments.
- **Explicit variable names**: descriptive over short/ambiguous.
- **No magic numbers**: use named constants.
- **Security-first approach**: always consider security implications.

## AI Agent Workflow Tooling

- **Sub-agents**: Kilo sub-agents (architect, implementer, code-reviewer, code-simplifier, docs-specialist).
- **Critical Workflow**: defined in `.kilo/commands/critical-workflow.md`.
- **Rules**: `.kilo/rules/` directory.
- **Plans**: `.kilo/plans/` directory.
- **TODOs**: `.agent/todos/` directory.

## Reference

- [brief.md](brief.md) — authoritative scope and requirements.
- [.agent/project-structure.md](../project-structure.md) — current folder layout.
