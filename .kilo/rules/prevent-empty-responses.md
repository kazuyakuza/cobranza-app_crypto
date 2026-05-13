# Prevent Empty Responses

CRITICAL RULE

- **Visible Responses**: AI Agent MUST ALWAYS provide a visible text block at the end of all conversational responses using the format: `Status: [short status phrase]`.
- **Tool-Only / Thinking Operations**: When the agent does background tasks, executing multi-turn reasoning, or calling system tools (where text output is restricted), it MUST update the user interface status by invoking the native UI indicator or updating the `sub_step_status` key in `.kilo/state.json`.
- **Zero-Text Prevention**: Under no circumstances should a turn conclude with an entirely empty payload. If no code or text is required, output at least the current operational status block.
