# claude-sync

Sync `CLAUDE.md` and other markdown convention docs across machines via a Cloudflare Workers backend.

## Requirements

- Node.js 18+

## Install

```bash
npm install -g claude-sync
```

Or link locally for development:

```bash
npm run build
npm link
```

## Quick start

```bash
# In a project directory — creates a workspace and saves token
claude-sync init

# Push all .md files to the workspace
claude-sync push --message "initial sync"

# On another machine — link to the existing workspace
claude-sync link <token>

# Pull all files down
claude-sync pull
```

## Commands

### `claude-sync init [--name <name>]`

Creates a new workspace and initializes the current directory.

- Prompts for a workspace name if `--name` is not provided
- Saves `token` and `workspace_id` to `~/.claude-sync/config.json`
- Writes `workspace_name` to `.claude-sync.json` in the current directory
- Appends `.claude-sync.json` and `.claude-sync-state.json` to `.gitignore`

**Options:**

| Flag | Description |
|------|-------------|
| `-n, --name <name>` | Workspace name (skips prompt) |

---

### `claude-sync link <token>`

Links this machine to an existing workspace using a token from `init`.

Validates the token against the API before saving it.

---

### `claude-sync push [options]`

Scans all `.md` files from the project root and pushes them in one batch.

- Prompts for a changelog message if `--message` is not provided
- Skips unchanged files (server compares SHA-256 hashes)

**Options:**

| Flag | Description |
|------|-------------|
| `-m, --message <msg>` | Changelog message (skips prompt) |
| `-a, --author <name>` | Author name (defaults to OS username) |
| `-q, --quiet` | Suppress non-error output |

---

### `claude-sync pull [options]`

Downloads all files from the workspace and writes them to disk.

- Skips files with local modifications (compares against last-pulled hash)
- Use `--force` to overwrite local changes

**Options:**

| Flag | Description |
|------|-------------|
| `-f, --force` | Overwrite local changes without prompting |
| `-q, --quiet` | Suppress non-error output |

---

### `claude-sync status`

Shows the sync state of all `.md` files, grouped by category:

- **In sync** — local hash matches remote
- **Modified locally** — local differs from remote
- **Local only** — exists locally, not pushed
- **Remote only** — exists remotely, not pulled

---

### `claude-sync log [--limit N]`

Shows recent push history for the workspace.

**Options:**

| Flag | Description |
|------|-------------|
| `-l, --limit <n>` | Number of entries to show (default: 10) |

---

## Config files

| File | Location | Purpose |
|------|----------|---------|
| `~/.claude-sync/config.json` | Global | Stores `token`, `workspace_id`, `api_url` |
| `.claude-sync.json` | Project root | Stores `workspace_name`. **Gitignored.** |
| `.claude-sync-state.json` | Project root | Tracks last-pulled hashes for conflict detection. **Gitignored.** |

## Environment variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_SYNC_API_URL` | Override the API base URL (useful for self-hosting or local dev) |

## What gets synced

Only `.md` files are ever scanned, pushed, or pulled. All other file types are silently ignored.

The following directories are always excluded from scanning:

`node_modules`, `.git`, `dist`, `build`, `.next`, `.claude-sync-cache`

## Self-hosting

Deploy the backend yourself:

1. Clone the backend repo and run `wrangler deploy`
2. Set `api_url` in `~/.claude-sync/config.json`, or export `CLAUDE_SYNC_API_URL`

## License

MIT
# claude-context-sync
