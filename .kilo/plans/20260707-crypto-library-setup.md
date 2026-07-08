# Global Plan: Crypto Library Setup

## Overview

Setup the `@cobranza-apps/crypto` TypeScript library project. This plan covers the initialization of project info, README, project structure, and package configuration. All work follows the Critical Workflow.

## Pre-Analysis

### Project State
- `.agent/project-info/brief.md` exists with comprehensive crypto library specs.
- `.agent/project-info/.initialized` exists, indicating partial initialization.
- Core project info files `product.md`, `context.md`, `architecture.md`, `tech.md` are **missing**.
- `README.md` is the base template from the starter repo, not library-specific.
- `.agent/project-structure.md` shows `(no folders yet)`.
- `package.json` does **not exist**.
- `.nvmrc` specifies Node `22.14.0`.
- `.gitignore` is present and appropriate.

### Technical Decisions
- **Package Manager**: npm (standard, no lock file present yet).
- **Language**: TypeScript targeting Node 22.
- **Test Runner**: Jest (specified in brief).
- **Build Output**: `dist/` (already gitignored).
- **Project Structure**: Single package at repo root (not monorepo `packages/crypto/`), matching the actual repo layout.

---

## Task 1: Initialize Project Info

### Description
Create the remaining core project info files: `product.md`, `context.md`, `architecture.md`, `tech.md`. Remove `.initialized`. Update `AGENTS.md` links if needed.

### 4.1 Analysis & Planning
- **Sub-agent**: architect
- Analyze `brief.md` to derive product goals, architecture, tech stack, and current context.
- Generate concise but complete project info files.
- Save plan to `.kilo/plans/20260707-task1-init-project-info.md`.

### 4.2 Implementation
- **Sub-agent**: implementer
- Create `.agent/project-info/product.md`
- Create `.agent/project-info/context.md`
- Create `.agent/project-info/architecture.md`
- Create `.agent/project-info/tech.md`
- Remove `.agent/project-info/.initialized`
- Commit: `chore: initialize project info files`

### 4.3 Code Review & Simplification
- **Sub-agents**: code-reviewer, code-simplifier
- Review project info files for accuracy against `brief.md`.
- Simplify where verbose.
- Save fix/simplification plan to `.kilo/plans/20260707-task1-fix.md`.
- **Sub-agent**: implementer applies fixes.

### 4.4 Documentation
- **Sub-agent**: docs-specialist
- Add JSDoc-style headers and TOC to project info files > 100 lines.
- Ensure cross-linking between files.

### 4.5 Verification
- **Sub-agent**: architect
- Verify all 5 core project info files exist and are consistent.
- Check `.initialized` is removed.

### 4.6 Task Completion
- **Sub-agent**: implementer
- Append `[DONE]` to Task 1 line in TODO file.
- Commit: `chore: complete project info initialization`

---

## Task 2: Update README File

### Description
Replace the base template `README.md` with a library-specific README for `@cobranza-apps/crypto`.

### 4.1 Analysis & Planning
- **Sub-agent**: architect
- Design README sections: Overview, Installation, Usage, API summary, NestJS integration, Security, Testing, License.
- Save plan to `.kilo/plans/20260707-task2-readme.md`.

### 4.2 Implementation
- **Sub-agent**: implementer
- Overwrite `README.md` with new content derived from `brief.md`.
- Commit: `docs: add crypto library readme`

### 4.3 Code Review & Simplification
- **Sub-agents**: code-reviewer, code-simplifier
- Review for completeness and clarity.
- Save fix plan to `.kilo/plans/20260707-task2-fix.md`.
- **Sub-agent**: implementer applies fixes.

### 4.4 Documentation
- **Sub-agent**: docs-specialist
- Ensure proper Markdown formatting, TOC, and cross-references.

### 4.5 Verification
- **Sub-agent**: architect
- Verify README covers all sections from plan and brief requirements.

### 4.6 Task Completion
- **Sub-agent**: implementer
- Append `[DONE]` to Task 2 line in TODO file.
- Commit: `chore: complete readme update`

---

## Task 3: Define Project Structure

### Description
Update `.agent/project-structure.md` and create the `src/` folder hierarchy as described in `brief.md` section 8.

### 4.1 Analysis & Planning
- **Sub-agent**: architect
- Map brief section 8 structure to actual repo root layout.
- Proposed `src/` folders:
  - `src/` - root source
  - `src/testing/` - test utilities and vectors
  - `tests/` - unit tests (outside src)
  - `docs/` - already exists
- Save plan to `.kilo/plans/20260707-task3-structure.md`.

### 4.2 Implementation
- **Sub-agent**: implementer
- Update `.agent/project-structure.md` with new folder definitions.
- Create empty placeholder files in `src/` and `src/testing/` to establish structure:
  - `src/index.ts`
  - `src/config.ts`
  - `src/crypto.service.ts`
  - `src/hkdf.ts`
  - `src/utils.ts`
  - `src/testing/index.ts`
  - `src/testing/test-vectors.ts`
- Commit: `chore: define project structure`

### 4.3 Code Review & Simplification
- **Sub-agents**: code-reviewer, code-simplifier
- Validate folder names and locations against project rules.
- Save fix plan if needed.
- **Sub-agent**: implementer applies fixes.

### 4.4 Documentation
- **Sub-agent**: docs-specialist
- Add folder-level comments in `project-structure.md` for AI agents.

### 4.5 Verification
- **Sub-agent**: architect
- Verify all folders exist on disk and match `project-structure.md`.

### 4.6 Task Completion
- **Sub-agent**: implementer
- Append `[DONE]` to Task 3 line in TODO file.
- Commit: `chore: complete project structure definition`

---

## Task 4: Set Up and Configure package.json, Add and Install Dependencies

### Description
Create `package.json` and `tsconfig.json`, then install dependencies.

### 4.1 Analysis & Planning
- **Sub-agent**: architect
- Define package metadata (name `@cobranza-apps/crypto`, version `0.1.0`, main, types, exports including `testing` subpath).
- Define scripts: build, test, lint (if applicable).
- Dev deps: `typescript`, `jest`, `@types/jest`, `ts-jest`.
- Peer dep: `@cobranza-apps/entities`.
- `tsconfig.json` for Node 22, strict mode.
- Save plan to `.kilo/plans/20260707-task4-package.md`.

### 4.2 Implementation
- **Sub-agent**: implementer
- Create `package.json`.
- Create `tsconfig.json`.
- Run `npm install`.
- Commit: `chore: initialize package.json and install dependencies`

### 4.3 Code Review & Simplification
- **Sub-agents**: code-reviewer, code-simplifier
- Validate JSON correctness, dependency versions, and tsconfig strictness.
- Save fix plan.
- **Sub-agent**: implementer applies fixes.

### 4.4 Documentation
- **Sub-agent**: docs-specialist
- Add inline comments in `tsconfig.json` if needed.
- Update README with installation instructions if not done in Task 2.

### 4.5 Verification
- **Sub-agent**: architect
- Verify `node_modules` exists, `package-lock.json` generated, scripts valid.

### 4.6 Task Completion
- **Sub-agent**: implementer
- Append `[DONE]` to Task 4 line in TODO file.
- Commit: `chore: complete package setup`

---

## Step 5: TODO File Completion

- **Sub-agent**: implementer
- Rename TODO file to `20260707-todo-0-DONE.md`.
- Ensure all changes committed in feature branch.
- Merge feature branch to `main`.
- Push `main` to `origin` only.

## Continuation

Propose user to proceed with next TODO file or task.
