# claude-sync — Command Reference

Syncs CLAUDE.md and convention docs across machines via a Cloudflare Workers backend.

```
claude-sync [command] [options]
```

---

## Commands

### `init`

Create a new workspace and initialize the current directory.

```
claude-sync init [options]
```

**Options**

| Flag | Description |
|---|---|
| `-n, --name <name>` | Workspace name (skips interactive prompt) |

**What it does**

- Prompts for a workspace name if `--name` is not provided
- Creates the workspace on the backend and saves the token to `~/.claude-sync/config.json`
- Writes `.claude-sync.json` to the current directory
- Appends `.claude-sync.json` and `.claude-sync-state.json` to `.gitignore`

**Example**

```
claude-sync init --name my-project
```

---

### `link`

Link this machine to an existing workspace using a token from another machine.

```
claude-sync link <token>
```

**Arguments**

| Argument | Description |
|---|---|
| `<token>` | Bearer token from the target workspace |

**What it does**

- Validates the token against the backend
- Saves the token to `~/.claude-sync/config.json`
- Associates the token with the current project's workspace name if `.claude-sync.json` exists

**Example**

```
claude-sync link eyJhbGci...
```

---

### `push`

Push all `.md` files from the project root to a workspace.

```
claude-sync push [options]
```

**Options**

| Flag | Description |
|---|---|
| `-m, --message <message>` | Changelog message (skips interactive prompt) |
| `-a, --author <author>` | Author name (defaults to OS username) |
| `--to <name>` | Push to a named workspace (skips workspace picker) |
| `-q, --quiet` | Suppress non-error output |

**What it does**

- Scans all `.md` files recursively from the project root (ignores `node_modules`, `.git`, `dist`, `build`, `.next`)
- Presents an interactive workspace picker if multiple workspaces exist and `--to` is not set
- Prompts for a changelog message if `-m` is not provided
- Sends all files to the backend; the server skips unchanged files
- Updates the active workspace in `.claude-sync.json`

**Example**

```
claude-sync push -m "Update onboarding guide" --to team-docs
```

---

### `pull`

Pull files from a workspace to the local project.

```
claude-sync pull [options]
```

**Options**

| Flag | Description |
|---|---|
| `-a, --all` | Skip all pickers and pull latest from the current workspace |
| `-f, --force` | Overwrite local changes without prompting |
| `-s, --snapshot <id>` | Pull a specific snapshot by changelog entry ID (skips version picker) |
| `--from <name>` | Pull from a named workspace (skips workspace picker) |
| `-q, --quiet` | Suppress non-error output |

**What it does**

- Presents an interactive workspace picker, then a version history picker (up to 50 entries)
- Selecting a workspace in interactive mode implies `--force` (no conflict prompts)
- Skips files with local changes unless `--force` is set; warns when a file is skipped
- Writes files atomically (write to `.tmp` then rename)
- Updates `.claude-sync-state.json` with content hashes of pulled files
- Sets the pulled workspace as the active workspace in `.claude-sync.json`

**Example**

```
# Interactive (workspace + version pickers)
claude-sync pull

# Pull latest from a specific workspace, overwriting local changes
claude-sync pull --from team-docs --force

# Pull a specific historical snapshot
claude-sync pull --from team-docs --snapshot abc12345

# Non-interactive latest pull
claude-sync pull --all
```

---

### `status`

Show the sync status of all `.md` files.

```
claude-sync status [options]
```

**Options**

| Flag | Description |
|---|---|
| `-q, --quiet` | Suppress non-error output |

**Output categories**

| Symbol | Color | Meaning |
|---|---|---|
| `✔` | Green | In sync with remote |
| `~` | Yellow | Modified locally since last push |
| `+` | Blue | Local only — not yet pushed |
| `-` | Red | Remote only — not yet pulled |

**Example**

```
claude-sync status
```

---

### `log`

Show push history for the current workspace.

```
claude-sync log [options]
```

**Options**

| Flag | Description |
|---|---|
| `-l, --limit <n>` | Number of entries to show (default: `10`) |
| `-q, --quiet` | Suppress non-error output |

**Output format**

```
[MM/DD/YYYY] <author>: <message>  (files: <file1>, <file2>, ...)
```

**Example**

```
claude-sync log --limit 25
```

---

### `repos`

List all workspaces stored in the backend.

```
claude-sync repos [options]
```

**Options**

| Flag | Description |
|---|---|
| `-q, --quiet` | Suppress non-error output |

**Output format**

```
Repos in backend (N):

  <name> — <N> files  [<workspace_id>]  created <date>
```

**Example**

```
claude-sync repos
```

---

### `delete-repo`

Permanently delete a workspace and all its files from the backend.

```
claude-sync delete-repo <name-or-id> [options]
```

**Arguments**

| Argument | Description |
|---|---|
| `<name-or-id>` | Workspace name or workspace ID |

**Options**

| Flag | Description |
|---|---|
| `-y, --yes` | Skip the confirmation prompt |

**What it does**

- Looks up the workspace by name or ID
- Displays the workspace details and prompts you to type the repo name to confirm
- Permanently deletes all files and history from the backend

**Example**

```
claude-sync delete-repo old-project
claude-sync delete-repo old-project --yes
```

---

## Global flags

These flags are available on all commands via Commander's version/help defaults.

| Flag | Description |
|---|---|
| `-V, --version` | Print the CLI version |
| `-h, --help` | Show help for a command |

---

## Configuration files

| File | Location | Purpose |
|---|---|---|
| `~/.claude-sync/config.json` | Global (per user) | Stores the auth token, API URL, and per-workspace tokens |
| `.claude-sync.json` | Project root | Stores the workspace name and active workspace |
| `.claude-sync-state.json` | Project root | Stores content hashes of last-synced files for conflict detection |

The API URL defaults to `http://192.168.70.40:4000` and can be overridden via the `CLAUDE_SYNC_API_URL` environment variable or the `api_url` field in `~/.claude-sync/config.json`.

---

## Typical workflows

**First-time setup on a new machine**

```
claude-sync init --name my-project
claude-sync push -m "initial push"
```

**Joining an existing workspace on a second machine**

```
# In the project directory
claude-sync link <token-from-first-machine>
claude-sync pull --all
```

**Day-to-day**

```
# Check what's changed
claude-sync status

# Push updates with a message
claude-sync push -m "Add coding conventions"

# Pull latest changes from the team workspace
claude-sync pull --from team-docs --all
```

**View and restore a previous version**

```
# See history
claude-sync log --limit 20

# Pull a specific snapshot (interactive picker shows history)
claude-sync pull --from team-docs
```
