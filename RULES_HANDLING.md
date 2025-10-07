# Provider Rules Handling

This document catalogs how various AI coding tools and agents handle rules files and MCP (Model Context Protocol) configuration, both at project and user levels.

## Rules Files & AGENTS.md Support

| Tool / Agent          | AGENTS.md | Primary Rules File(s)                    | Alternates / Additional Locations                     | Notes  |
|-----------------------|-----------|------------------------------------------|-------------------------------------------------------|--------|
| AGENTS.md (spec)      | 🟢        | `AGENTS.md`                              | User, Project; nested per-subdirectory allowed        | [^A]   |
| GitHub Copilot        | 🔵        | `.github/copilot-instructions.md`        | Path-scoped `.github/instructions/*.instructions.md`  | [^B]   |
| Claude Code           | —         | `CLAUDE.md`                              | —                                                     |        |
| OpenAI Codex CLI      | 🟢        | `AGENTS.md`                              | Global user copy may be merged                        | [^C]   |
| Jules (Google)        | 🟢        | `AGENTS.md`                              | —                                                     | [^D]   |
| Cursor                | 🔵        | `.cursor/rules/*.mdc`                    | Also supports root-level `AGENTS.md`                  | [^E]   |
| Windsurf              | —         | `.windsurf/rules/*.md`                   | Rules managed via UI                                  |        |
| Cline                 | —         | `.clinerules` or `.clinerules/*.md`      | Directory style supported                             |        |
| Crush (Charm)         | —         | `CRUSH.md`                               | Behavior/config in `crush.json` / `.crush.json`       |        |
| Amp (Sourcegraph)     | 🟢        | `AGENTS.md`                              | Also ingests other rule formats                       | [^I]   |
| Amazon Q CLI          | —         | `.amazonq/rules/*.md`                    | —                                                     |        |
| Aider                 | 🔵        | Any Markdown via `--read` or `/read`     | `.aider.conf.yml` controls behavior                   | [^J]   |
| Firebase Studio (IDX) | —         | `.idx/airules.md`                        | —                                                     |        |
| OpenHands             | —         | `.openhands/microagents/repo.md`         | Additional microagents in `.openhands/microagents/`   |        |
| Gemini CLI            | 🔵        | `GEMINI.md`                              | Also supports `AGENTS.md`                             | [^G]   |
| Junie (JetBrains)     | —         | `.junie/guidelines.md`                   | —                                                     |        |
| Kilo Code             | 🔵        | `.kilocode/rules/*.md`                   | Memory Bank: `.kilocode/rules/memory-bank/*.md`       |        |
| opencode (CLI)        | 🟢        | `AGENTS.md`                              | —                                                     |        |
| Goose                 | —         | `.goosehints`                            | Global: `~/.config/goose/.goosehints`                 |        |
| Qwen Code (CLI)       | —         | (no fixed rules file)                    | —                                                     |        |
| Roo Code              | 🔵        | `.roo/rules/*.md` or `.roorules`         | Global rules via extension storage                    |        |
| Zed                   | 🔵        | (reads `AGENTS.md` like any file)        | `.zed/settings.json` for project settings             |        |
| Trae AI               | —         | `.trae/rules/project_rules.md`           | —                                                     |        |
| Warp (terminal)       | —         | `WARP.md`                                | Root + subdir-local variants                          |        |
| Kiro (IDE)            | —         | `.kiro/steering/*.md`                    | Baseline steering like `structure.md`                 |        |
| Firebender            | —         | `firebender.json` (`rules` array)        | Can reference external Markdown                       |        |
| Phoenix               | 🟢        | `AGENTS.md`                              | —                                                     | [^NEW] |
| Semgrep               | 🟢        | `AGENTS.md`                              | —                                                     | [^NEW] |
| Devin (Cognition)     | 🟢        | `AGENTS.md`                              | —                                                     | [^NEW] |
| Ona                   | 🟢        | `AGENTS.md`                              | —                                                     | [^NEW] |

**Legend:**
- 🟢 = Primary AGENTS.md convention
- 🔵 = AGENTS.md supported/optional

### OpenAI Codex

- Primary rules file: `AGENTS.md`
  - Project-scoped rules: `./AGENTS.md` 
  - Path-scoped rules: `./subdir/AGENTS.md`
  - User/global scoped rules: `~/.codex/AGENTS.md`
    - Automatically included upon session start if it exists.
- @mention behavior:
  - Codex DOES NOT load @mentioned files into context automatically.
  - After receiving instructions, Codex has been observed to read through @mentioned files individually.

### Claude Code

- Primary rules file: `CLAUDE.md`
  - Project-scoped rules: `./CLAUDE.md` 
  - Path-scoped rules: `./subdir/CLAUDE.md`
    - Claude also loads in `../CLAUDE.md` files that are further up in the path, regardless of project root.
  - User/global scoped rules: `~/.claude/CLAUDE.md`
    - Automatically included upon session start if it exists.
- @mention behavior:
  - Claude DOES load @mentioned `*.md` files (even nested) into context automatically.
  - Claude DOES NOT support non-Markdown @mentioned files.
  
### Cursor

- Primary rules file: `*.mdc`
  - Project-scoped rules: `./.cursor/rules/*.mdc`
    - Cursor DOES support nesting `.mdc` files in subdirectories within `.cursor/rules/`.
  - Path-scoped rules: `./subdir/.cursor/rules/*.md`
  - User/global scoped rules:
    - Cursor uses plain text user-scoped rules in its settings.
- @mention behavior:
  - Cursor may SOMETIMES load @mentioned files into context automatically.
  - Cursor DOES support @mentioned files with non-`.md` extensions.

**Notes (Rules Files):**

[^A]: AGENTS.md spec & examples. Root recommended; nested per-package allowed.[^1]
[^B]: Copilot supports repo-wide `.github/copilot-instructions.md` and path-scoped `.instructions.md` with YAML front-matter; AGENTS.md support indicated in recent editor guidance.[^2][^1]
[^C]: Codex treats `AGENTS.md` as first-class; listed on official AGENTS.md ecosystem. May merge with global `~/.codex/AGENTS.md`.[^3][^1]
[^D]: Jules listed as AGENTS.md consumer in ecosystem docs.[^4][^1]
[^E]: Cursor uses `.mdc` with front-matter (`description`, `globs`, `alwaysApply`). Docs explicitly state AGENTS.md in project root is supported.[^5]
[^G]: Gemini CLI: Official Google doc states "Customize Gemini using AGENTS.md files." Primary is `GEMINI.md`, but AGENTS.md is explicitly supported.[^6][^1]
[^I]: Amp publicly endorses AGENTS.md as the standard and ingests other formats.[^7]
[^J]: Aider reads arbitrary Markdown including AGENTS.md when configured via `--read`/`/read`. AGENTS.md site shows specific Aider config snippet.[^8][^1]
[^NEW]: Recently added to AGENTS.md ecosystem

---

## MCP Configuration

| Tool / Agent      | Project-Level MCP Config                         | User-Level MCP Config                              | Notes   |
|-------------------|--------------------------------------------------|----------------------------------------------------|---------|
| GitHub Copilot    | `.vscode/mcp.json`                               | User profile `mcp.json` (via "MCP: Open User Configuration") | [^24]   |
| Claude Code       | `.mcp.json` (repo root)                          | `~/.claude.json` (via `claude mcp add`)            | [^25]   |
| OpenAI Codex CLI  | (project support varies)                         | `~/.codex/config.toml`                             | [^26]   |
| Jules (Google)    | — (not an MCP client)                            | —                                                  |         |
| Cursor            | `.cursor/mcp.json`                               | `~/.cursor/mcp.json`                               | [^27]   |
| Windsurf          | "View raw config" → `mcp_config.json`            | `~/.codeium/windsurf/mcp_config.json`              | [^28]   |
| Cline             | (workspace rules separate)                       | `cline_mcp_settings.json` (via extension UI)       | [^29]   |
| Crush (Charm)     | `crush.json` or `.crush.json`                    | `$HOME/.config/crush/crush.json`                   | [^30]   |
| Amp (Sourcegraph) | UI-managed                                       | `~/.config/amp/settings.json`                      | [^31]   |
| Amazon Q CLI      | `.amazonq/mcp.json`                              | `~/.aws/amazonq/mcp.json`                          | [^32]   |
| Aider             | `.aider.conf.yml` (Aider acts as MCP server)     | (same; not a typical MCP client)                   | [^33]   |
| Firebase Studio   | `.idx/mcp.json`                                  | —                                                  | [^34]   |
| Gemini CLI        | `.gemini/settings.json`                          | `~/.gemini/settings.json`                          | [^13]   |
| OpenHands         | `config.toml` (per-run/working dir)              | `~/.openhands/config.toml`                         | [^35]   |
| Junie (JetBrains) | IDE UI; (some builds: `.junie/mcp/mcp.json`)     | IDE UI; (some builds: `~/.junie/mcp/mcp.json`)     | [^31]   |
| Kilo Code         | `.kilocode/mcp.json`                             | Extension storage (VS Code globalStorage path)     | [^36]   |
| opencode (CLI)    | `opencode.json` (MCP section)                    | `~/.config/opencode/opencode.json`                 | [^37]   |
| Goose             | —                                                | —                                                  |         |
| Qwen Code (CLI)   | `.qwen/settings.json` (less common)              | `~/.qwen/settings.json`                            | [^38]   |
| Roo Code          | Project rules separate                           | `mcp_settings.json` via UI                         | [^39]   |
| Zed               | `.zed/settings.json`                             | `~/.config/zed/settings.json` (`context_servers`)  | [^19]   |
| Trae AI           | IDE UI                                           | IDE UI                                             | [^40]   |
| Warp (terminal)   | UI (Personal → MCP Servers)                      | UI (Personal → MCP Servers)                        | [^31]   |
| Kiro (IDE)        | `.kiro/settings/mcp.json`                        | IDE UI                                             | [^31]   |
| Firebender        | `firebender.json` (MCP section merges)           | Personal `firebender.json` (merged with project)   | [^41]   |

**Notes (MCP Configuration):**

[^24]: VS Code docs show repo-scoped `.vscode/mcp.json` and user-scope `mcp.json`.
[^25]: Claude Code MCP config is JSON with env-var expansion; user/project scopes documented.
[^26]: Codex CLI uses TOML in `~/.codex/config.toml` for MCP.
[^27]: Cursor MCP JSON paths: `~/.cursor/mcp.json` (global) and `.cursor/mcp.json` (project).
[^28]: Windsurf exposes "View raw config" → `mcp_config.json` (project) and `~/.codeium/windsurf/mcp_config.json` (user).
[^29]: Cline stores MCP settings in `cline_mcp_settings.json` via its MCP panel.
[^30]: Crush supports global `$HOME/.config/crush/crush.json` and project `.crush.json` / `crush.json`.
[^31]: Shared reference for multiple tools (Amp, Junie, Warp, Kiro) - see container-use.com.
[^32]: Amazon Q supports global `~/.aws/amazonq/mcp.json` and project `.amazonq/mcp.json`.
[^33]: Aider config is `.aider.conf.yml`; Aider is typically an MCP **server** rather than client.
[^34]: Firebase Studio (interactive chat) uses `.idx/mcp.json`.
[^35]: OpenHands uses `config.toml` (user and project/local depending on run mode).
[^36]: Kilo Code supports project `.kilocode/mcp.json`; user config in VS Code extension storage.
[^37]: opencode documents MCP under `mcp` section of `opencode.json` (global and per-project).
[^38]: Qwen Code tutorials use `~/.qwen/settings.json` for MCP configuration.
[^39]: Roo Code MCP configured via UI and saved to extension settings JSON.
[^40]: Trae IDE MCP support indicated in release notes and UI; concrete file paths vary by build.
[^41]: Firebender merges project/personal `firebender.json` including MCP sections.

---

## Key Findings

### AGENTS.md Adoption
- **Strong adoption:** Codex CLI, Jules, Amp, opencode, Phoenix, Semgrep, Devin, and Ona treat AGENTS.md as the primary convention (🟢)
- **Growing support:** Copilot, Cursor, Gemini CLI, Aider, Kilo Code, Roo Code, and Zed support AGENTS.md alongside their primary formats (🔵)
- **New ecosystem members:** Phoenix, Semgrep, Devin, and Ona recently added to the AGENTS.md ecosystem

### MCP Configuration Patterns
- **Project-level:** Most tools support a project-scoped MCP config file (`.mcp.json`, `mcp_config.json`, or within existing config files)
- **User-level:** User configs typically live in `~/.config/<tool>/` or tool-specific home directories
- **UI-managed:** Several tools (Windsurf, Warp, Trae, Kiro) manage MCP primarily through UI with file-based fallbacks

### Implementation Notes
- **Cursor accuracy:** Official docs confirm `.mdc` with front-matter (`globs`, `alwaysApply`, `description`) plus root AGENTS.md support
- **Codex `.codex/AGENTS.md`:** Global `~/.codex/AGENTS.md` is confirmed; project `.codex/AGENTS.md` treatment unclear. Keep root `AGENTS.md` as canonical.

---

## References

[^1]: https://agents.md/ "AGENTS.md"
[^2]: https://code.visualstudio.com/docs/copilot/customization/custom-instructions "Use custom instructions in VS Code"
[^3]: https://developers.openai.com/codex/cli/ "Codex CLI"
[^4]: https://docs.factory.ai/cli/configuration/agents-md "AGENTS.md"
[^5]: https://cursor.com/docs/context/rules "Rules | Cursor Docs"
[^6]: https://developer.android.com/studio/gemini/agent-files "Customize Gemini using AGENTS.md files | Android Studio"
[^7]: https://ampcode.com/news/AGENTS.md "From AGENT.md to AGENTS.md"
[^8]: https://aider.chat/docs/config.html "Configuration"
[^13]: https://google-gemini.github.io/gemini-cli/docs/cli/configuration.html "Gemini CLI Configuration"
[^19]: https://zed.dev/docs/configuring-zed "Configuring Zed | Zed Code Editor Documentation"
[^24]: https://code.visualstudio.com/docs/copilot/customization/mcp-servers "Use MCP servers in VS Code"
[^25]: https://docs.claude.com/en/docs/claude-code/mcp "Connect Claude Code to tools via MCP"
[^26]: https://zitniklab.hms.harvard.edu/ToolUniverse/guide/building_ai_scientists/codex_cli.html "GPT Codex CLI - ToolUniverse Documentation"
[^27]: https://trigger.dev/docs/mcp-introduction "MCP Introduction"
[^28]: https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/get-started/tools/windsurf "Get started using the Azure MCP Server with Windsurf"
[^29]: https://docs.cline.bot/mcp/configuring-mcp-servers "Configuring MCP Servers"
[^30]: https://github.com/charmbracelet/crush/issues/870 "Global `crush.json` MCP tools not loaded if project `.crush. ..."
[^31]: https://container-use.com/agent-integrations "Agent Integration - Container Use"
[^32]: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/mcp-ide.html "MCP configuration for Q Developer in the IDE"
[^33]: https://aider.chat/docs/config/aider_conf.html "YAML config file"
[^34]: https://firebase.google.com/docs/studio/mcp-servers "Connect to Model Context Protocol (MCP) servers - Firebase"
[^35]: https://docs.all-hands.dev/usage/how-to/cli-mode "CLI - All Hands Docs - OpenHands"
[^36]: https://github.com/Kilo-Org/kilocode/issues/2291 "MCPs not been detected · Issue #2291 · Kilo-Org/kilocode"
[^37]: https://opencode.ai/docs/config/ "Config"
[^38]: https://milvus.io/blog/hands-on-tutorial-build-your-own-coding-copilot-with-qwen3-coder-qwen-code-and-code-context.md "Build a Coding Copilot with Qwen3-Coder & Code Context - Milvus"
[^39]: https://www.reddit.com/r/RooCode/comments/1k9xsy4/how_do_i_get_my_mcp_servers_from_cline_to_roo/ "How do I get my MCP servers from cline to roo : r/RooCode"
[^40]: https://traeide.com/news/6 "Trae IDE v1.3.0 Supports MCP Protocol & .rules ..."
[^41]: https://docs.firebender.com/context/configurations "Project vs Personal Config"
