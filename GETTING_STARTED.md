# claude-sync — Getting Started

## 1. Install

```powershell
npm install
.\install.ps1
```

## 2. Create a new workspace (first machine)

```powershell
claude-sync init
```

Creates a workspace on the backend and prints a token. Save that token — you'll need it to link other machines.

## 3. Link another machine to an existing workspace

```powershell
claude-sync link <token>
```

Use the token printed during `init` on any other machine to join the same workspace.

## 4. Push files

```powershell
claude-sync push
```

Pushes all `.md` files in the current project to the workspace. Select the destination with arrow keys.

## 5. Pull files

```powershell
claude-sync pull
```

Pulls files from the workspace. Select the workspace and version interactively.

## 6. Check sync status

```powershell
claude-sync status
```

Shows which `.md` files are in sync, ahead, or behind.

## 7. View push history

```powershell
claude-sync log
```

Lists past pushes for the current workspace.

## 8. List all workspaces

```powershell
claude-sync repos
```

Shows every repo/workspace stored in the backend.

## 9. Delete a workspace

```powershell
claude-sync delete-repo <name-or-id>
```

Permanently deletes a repo and all its files. Irreversible.
