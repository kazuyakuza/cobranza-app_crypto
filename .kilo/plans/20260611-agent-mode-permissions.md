# Plan: Clarify Tool Permissions for All Agents and Modes

## Pre-Analysis

**Goal**: Update all files in `.kilo/modes/` and `.kilo/agents/` to explicitly declare tool permissions in both the YAML frontmatter `permission` section and the prompt body.

**Current State**:
- `plan.md` (mode): No permission section. Minimal prompt, references tool-selection-priority.
- `architect.md`: Has partial permissions. Prompt mentions tool preference but not explicit tool list.
- `code-reviewer.md`: Has partial permissions (only edit + bash). Missing read, mcp, grep, glob. Prompt says nothing about tools.
- `code-simplifier.md`: No permission section. No tool mention in prompt.
- `docs-specialist.md`: Minimal permissions (edit: allow, bash: deny). No tool mention.
- `frontend-specialist.md`: No permission section. No tool mention.
- `implementer.md`: Comprehensive permissions. Prompt mentions tool preference but not explicit tool list.

**Permission Categories** (from kilo-config): `read`, `edit`, `glob`, `grep`, `bash`, `task`, `webfetch`, `mcp`, `question`, `todowrite`

## Step-by-Step Plan

### Step 1: Update `.kilo/modes/plan.md`

**Permission additions**:
```yaml
permission:
  read: allow
  edit:
    "*.md": allow
    "*": deny
  bash: deny
  task: allow
  question: allow
  mcp: allow
  webfetch: allow
```

**Prompt additions** (after existing content):
Add an explicit "Tools" section listing what tools Plan Agent can use and for what purpose:
- `task` — delegate to sub-agents (primary tool)
- `question` — present choices to user
- `read` — read project files
- `edit`/`write` — create and update plan .md files only
- `mcp` (vscode-mcp-server_*, Bifrost_*) — explore codebase
- `webfetch` — research
- NO `bash` — all CLI ops delegated to implementer
- NO editing source code files

### Step 2: Update `.kilo/agents/architect.md`

**Current permissions**: read: allow, edit: "*.md": allow / "*": deny, bash: deny, task: allow, webfetch: allow, mcp: allow
**Needed changes**: Add `grep: allow` and `glob: allow` for code exploration. Add `todowrite: allow`. Make permission section clearer with comments.

**Updated permissions**:
```yaml
permission:
  read: allow
  edit:
    "*.md": allow           # plan files only
    "*": deny               # no source code edits
  bash: deny                # no CLI operations
  task: allow               # can delegate to sub-agents
  webfetch: allow           # research
  mcp: allow                # code analysis (vscode-mcp-server_*, Bifrost_*)
  grep: allow               # search codebase
  glob: allow               # find files by pattern
```

**Prompt additions**: Add explicit "Tools" section after existing "Tool Preference" line.
List allowed tools and their purposes. State explicitly what is forbidden (bash, editing non-.md files).

### Step 3: Update `.kilo/agents/code-reviewer.md`

**Current permissions**: edit: "*.md": allow / "*": deny, bash: "git *": allow / "*": deny
**Needed changes**: Add `read`, `grep`, `glob`, `mcp` permissions.

**Updated permissions**:
```yaml
permission:
  read: allow
  edit:
    "*.md": allow           # review fix plans
    "*": deny               # no source code edits
  grep: allow               # search code for patterns
  glob: allow               # find files
  mcp: allow                # code analysis (vscode-mcp-server_*, Bifrost_*)
  bash:
    "git *": allow          # git operations for review
    "*": deny               # no other CLI ops
```

**Prompt additions**: Add "Tools" section. List what tools are available and what they should be used for. Mention that `edit` is restricted to .md fix-plan files, and `bash` is restricted to git commands only.

### Step 4: Update `.kilo/agents/code-simplifier.md`

**Current**: No permissions. No tool mention.
**Needed**: Full permissions section + explicit tool list in prompt.

**Updated permissions**:
```yaml
permission:
  read: allow
  edit: allow               # refactoring code
  grep: allow               # search for patterns
  glob: allow               # find files
  mcp: allow                # code analysis & refactoring (vscode-mcp-server_*, Bifrost_*)
  bash:
    "npm *": allow
    "npx *": allow
    "yarn *": allow
    "pnpm *": allow
    "git *": allow
    "*": deny               # restrict CLI ops
```

**Prompt additions**: Add "Tools" section after existing content. List vscode-mcp-server_* for refactoring (rename, move, replace_lines, create_file), Bifrost_* for code analysis, grep for searching, bash restricted to npm/git.

### Step 5: Update `.kilo/agents/docs-specialist.md`

**Current permissions**: edit: allow, bash: deny
**Needed changes**: Add `read`, `grep`, `glob`, `mcp` permissions.

**Updated permissions**:
```yaml
permission:
  read: allow
  edit: allow               # documentation and code comments
  grep: allow               # search codebase for context
  glob: allow               # find relevant files
  mcp: allow                # code reading/analysis (vscode-mcp-server_*, Bifrost_*)
  bash: deny                # no CLI operations
```

**Prompt additions**: Add "Tools" section. List tools for reading code (to understand what to document), editing docs/comments, searching codebase.

### Step 6: Update `.kilo/agents/frontend-specialist.md`

**Current**: No permissions. No tool mention.
**Needed**: Full permissions section + explicit tool list in prompt.

**Updated permissions**:
```yaml
permission:
  read: allow
  edit: allow               # frontend code
  grep: allow               # search
  glob: allow               # find files
  mcp: allow                # code analysis + refactoring (vscode-mcp-server_*, Bifrost_*)
  bash:
    "npm *": allow
    "npx *": allow
    "yarn *": allow
    "pnpm *": allow
    "git *": allow
    "*": deny
  webfetch: allow           # research frontend APIs/docs
```

**Prompt additions**: Add "Tools" section. List frontend-relevant tools: vscode-mcp-server_* for editing, Bifrost_* for analysis, bash for npm/dev-server/build, webfetch for API research.

### Step 7: Update `.kilo/agents/implementer.md`

**Current permissions**: read: allow, edit: allow, bash: allow, glob: allow, grep: allow, task: allow, webfetch: allow, mcp: allow
**Current**: Already comprehensive. Prompt mentions tool preference but not explicit list.

**Changes**: Keep permissions as-is (they're already correct). Add explicit "Tools" section in the prompt body listing what tools are available and for what purpose, plus any restrictions (e.g., `git push` only to `origin`).

### Step 8: Verify Consistency

After all edits, verify:
- Each agent has permissions matching its role
- Each prompt contains explicit "Tools" section
- No agent has conflicting permissions (e.g., `bash: allow` + no bash in prompt)
- Tool names used in prompts match actual available tool names
- All frontmatter is valid YAML

## File Summary

| File | New permissions | New prompt section |
|------|----------------|-------------------|
| `.kilo/modes/plan.md` | Yes (first time) | "Tools" section |
| `.kilo/agents/architect.md` | Updated (add grep, glob) | "Tools" section |
| `.kilo/agents/code-reviewer.md` | Updated (add read, grep, glob, mcp) | "Tools" section |
| `.kilo/agents/code-simplifier.md` | Yes (first time) | "Tools" section |
| `.kilo/agents/docs-specialist.md` | Updated (add read, grep, glob, mcp) | "Tools" section |
| `.kilo/agents/frontend-specialist.md` | Yes (first time) | "Tools" section |
| `.kilo/agents/implementer.md` | No change needed | "Tools" section |
