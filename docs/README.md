# Documentation Index

This directory contains guides and reference documentation for `@cobranza-apps/crypto`.

## For AI Agents

- [How to Set Up Git](./how-to-set-up-git.md) — Configure Git credentials for GitHub authentication.
- [How to Write TODO Files](./how-to-write-todo-files.md) — Formats and conventions for task assignment via TODO files.

## For Library Consumers

See the [README](../README.md) for full library documentation.

Consumer-focused guides:

- [Testing Utilities](./testing-utilities.md) — Importing and using `@cobranza-apps/crypto/testing` (Jest + NestJS), test-vector design.
- [How to Configure in NestJS](./how-to-configure-in-nestjs.md) — Wiring `SecureCrypto` into a NestJS service via `ConfigService` (module, provider, interceptor, DTO, rotation, testing).

## Project Information

Detailed project context lives in [`.agent/project-info/`](../.agent/project-info/):

- [`brief.md`](../.agent/project-info/brief.md) — Authoritative scope, requirements, and cryptographic strategy.
- [`architecture.md`](../.agent/project-info/architecture.md) — Technical architecture, API surface, and security boundaries.
- [`product.md`](../.agent/project-info/product.md) — Product vision and goals.
- [`tech.md`](../.agent/project-info/tech.md) — Technology stack and tooling.
- [`context.md`](../.agent/project-info/context.md) — Current project state and recent changes.

## Configuration Files

Project configuration and build setup:

- [`package.json`](../package.json) — Package metadata, dependencies, scripts, and Jest configuration.
- [`tsconfig.json`](../tsconfig.json) — TypeScript compiler options with inline comments explaining key decisions.

## Workflow

AI agents must follow the [Critical Workflow](../.kilo/commands/critical-workflow.md) and read [`AGENTS.md`](../AGENTS.md) before contributing.
