# Agent Context Testing Suite

CONTEXT LABEL: 📖 README (testing/README.md)

This directory contains a comprehensive test harness for evaluating how AI coding agents load and handle context from rules files, @mentions, and various file formats.

## Directory Structure

```text
testing/
├── README.md                   # This file (📖)
├── TEST_INDEX.md               # Test catalog (📋)
├── AGENTS.md                   # Root rules file (🤖)
├── CLAUDE.md*                  # Symlink to AGENTS.md
├── .gitignore                  # Git ignore configuration
├── .config/
│   └── settings.yml            # Hidden directory test (🔒)
├── docs/
│   ├── AGENTS.md               # Docs context (📝)
│   └── CLAUDE.md*              # Symlink to AGENTS.md
├── src/
│   ├── AGENTS.md               # Code context (💻)
│   ├── CLAUDE.md*              # Symlink to AGENTS.md
│   ├── utils.js                # JavaScript test (🟨)
│   └── config.toml             # TOML test (⚙️)
├── tests/
│   ├── .hidden-rules.md        # Hidden file test (🔒)
│   ├── .testyrc                # Dotfile test (🎛️)
│   ├── MANIFEST                # No-extension file test (📦)
│   ├── secrets.md              # Gitignored file test (🔐)
│   ├── comments.md             # HTML comment test (💬)
│   ├── references.md           # @mention aggregator (🔗)
│   ├── mention-formats.md      # @mention syntax tests (📝)
│   ├── circular-1.md           # Circular ref test (♻️)
│   ├── circular-2.md           # Circular ref test (♻️)
│   ├── order-1.md              # Load order test (1️⃣)
│   ├── order-2.md              # Load order test (2️⃣)
│   └── order-3.md              # Load order test (3️⃣)
└── a/
    ├── AGENTS.md               # Deep nesting root (📂)
    ├── chain-a.md              # Chain start (🔗)
    └── b/
        ├── chain-b.md          # Chain middle (🔗)
        └── c/
            ├── chain-c.md      # Chain end (🔗)
            └── d/e/
                └── deep.md     # Deep nesting test (🗂️)
```

## Expected Behaviors by Test Type

### Auto-Loading Tests

**Root Files** (`AGENTS.md`, `CLAUDE.md`)
- **Expected:** Should auto-load when agent starts from `testing/`
- **Contains:** Main test instructions, @mentions to `docs/` and `src/` subdirectories
- **CONTEXT:** `🤖 Agents (testing/AGENTS.md)` or `🤖 Agents (testing/CLAUDE.md)`

**Subdirectory Rules** (`docs/`, `src/`)
- **Expected:** May auto-load if @mentioned from root OR if agent started from subdirectory
- **CONTEXT:** `📝 Docs (testing/docs/AGENTS.md)`, `💻 Code (testing/src/AGENTS.md)`

**User/Global Rules**
- **Expected:** Some agents auto-load `~/.claude/CLAUDE.md` or `~/.codex/AGENTS.md`
- **CONTEXT:** `👤 User (~/.claude/CLAUDE.md)` or similar

### File Format Tests

**JavaScript** (`src/utils.js`)
- **Expected:** Only loads if @mentioned and agent supports non-.md files
- **CONTEXT:** `🟨 JavaScript (testing/src/utils.js)`

**TOML** (`src/config.toml`)
- **Expected:** Only loads if @mentioned and agent supports non-.md files
- **CONTEXT:** `⚙️ Config (testing/src/config.toml)`

**YAML** (`.config/settings.yml`)
- **Expected:** Only loads if @mentioned from `references.md`
- **CONTEXT:** `🔒 Hidden Config (testing/.config/settings.yml)`

**No Extension** (`MANIFEST`)
- **Expected:** May or may not load depending on agent file detection
- **CONTEXT:** `📦 Manifest (testing/tests/MANIFEST)`

### Discovery Tests

**Hidden Files** (`.hidden-rules.md`, `.testyrc`)
- **Expected:** Usually NOT auto-discovered unless explicitly @mentioned
- **CONTEXT:** `🔒 Hidden (testing/tests/.hidden-rules.md)`, `🎛️ RC File (testing/tests/.testyrc)`

**Hidden Directory** (`.config/settings.yml`)
- **Expected:** Only loads if @mentioned in `references.md`
- **CONTEXT:** `🔒 Hidden Config (testing/.config/settings.yml)`

**Gitignored Files** (`secrets.md`)
- **Expected:** May still load if @mentioned, despite being in `.gitignore`
- **CONTEXT:** `🔐 Secrets (testing/tests/secrets.md)`

**Deep Nesting** (`a/b/c/d/e/deep.md`)
- **Expected:** Only loads if explicitly @mentioned
- **CONTEXT:** `🗂️ Deep (testing/a/b/c/d/e/deep.md)`

### @Mention Chain Tests

**Linear Chain** (`chain-a` → `chain-b` → `chain-c`)
- **Expected:** If agent auto-loads @mentions, all three should appear
- **CONTEXT:** `🔗 Chain A (testing/a/chain-a.md)`, `🔗 Chain B (testing/a/b/chain-b.md)`, `🔗 Chain C (testing/a/b/c/chain-c.md)`
- **Depth Test:** Determines how many levels deep @mentions are followed AND tests nested directory resolution

**Circular References** (`circular-1` ↔ `circular-2`)
- **Expected:** Agent should detect loop and stop (not infinite)
- **CONTEXT:** `♻️ Circular 1 (testing/tests/circular-1.md)`, `♻️ Circular 2 (testing/tests/circular-2.md)` (both or neither)

**Load Order** (`order-1` → `order-2` → `order-3`)
- **Expected:** Numbers reveal the order context was loaded
- **CONTEXT:** `1️⃣ First (testing/tests/order-1.md)`, `2️⃣ Second (testing/tests/order-2.md)`, `3️⃣ Third (testing/tests/order-3.md)` (in order)

### Special Detection Tests

**HTML Comments** (`comments.md`)
- **Expected:** Most agents WON'T see CONTEXT LABEL in `<!-- -->` comments
- **CONTEXT:** `💬 Hidden Comments (testing/tests/comments.md)` (only if comment parsing works)

**@Mention Formats** (`mention-formats.md`)
- **Expected:** Tests inline, list, code block, and path variations
- **Reveals:** Which @mention syntaxes the agent recognizes

## Usage Instructions

### Running Tests

1. **Start from `testing/` directory** to test root-level discovery
2. **Use Testy commands:**
   - `Testy --list` - Shows all CONTEXT labels currently loaded
   - `Testy --summary` - Detailed breakdown of available context

### Interpreting Results

**Minimal Context (Expected from most agents):**
```
CONTEXT: 🤖 Agents (testing/AGENTS.md)
```

**With @Mention Auto-Loading:**
```
CONTEXT: 🤖 Agents (testing/AGENTS.md), 📝 Docs (testing/docs/AGENTS.md), 💻 Code (testing/src/AGENTS.md)
```

**With Deep @Mention Chains:**
```
CONTEXT: 🤖 Agents, 📝 Docs, 💻 Code, 🔗 References, 🔒 Hidden Config, 🟨 JavaScript, ⚙️ Config
```

**With User/Global Rules:**
```
CONTEXT: 👤 User (~/.claude/CLAUDE.md), 🤖 Agents (testing/CLAUDE.md), 📝 Docs, 💻 Code
```

## What Each CONTEXT Label Reveals

| Label | What It Means |
|-------|---------------|
| 🤖 Agents | Root rules file was loaded |
| 📝 Docs | Documentation subdirectory rules loaded |
| 💻 Code | Source code subdirectory rules loaded |
| 👤 User | User/global rules file auto-loaded |
| 🟨 JavaScript | Non-.md file loaded (.js) |
| ⚙️ Config | Non-.md file loaded (.toml) |
| 🔒 Hidden Config | Hidden directory file loaded (.config/) |
| 🔐 Secrets | Gitignored file loaded despite .gitignore |
| 🔗 Chain A/B/C | @mention chain followed 1/2/3 levels deep |
| 1️⃣ 2️⃣ 3️⃣ | Load order sequence detected |
| ♻️ Circular | Circular reference handling works |
| 💬 Hidden Comments | HTML comment parsing works |
| 📦 Manifest | No-extension file detection works |
| 🗂️ Deep | Deep nesting (5+ levels) works |
| 🎛️ RC File | Dotfile detection works |

## Testing Different Agents

### OpenAI Codex
- Expected to auto-load: `AGENTS.md`, `~/.codex/AGENTS.md`
- @mention behavior: May NOT auto-load @mentioned files
- File format support: Unknown

### Claude Code
- Expected to auto-load: `CLAUDE.md`, `~/.claude/CLAUDE.md`, parent `../CLAUDE.md`
- @mention behavior: DOES auto-load @mentioned `.md` files
- File format support: `.md` only

### Cursor
- Expected to auto-load: `.cursor/rules/*.mdc`
- @mention behavior: SOMETIMES auto-loads @mentioned files
- File format support: All file types supported

## Notes

- **Never read files manually** - Let the agent's auto-loading reveal what it has access to
- **Order matters** - The CONTEXT list shows load sequence
- **Path information** - Full paths help distinguish root vs subdirectory files
- **Missing labels** - If a CONTEXT LABEL doesn't appear, that file wasn't loaded
