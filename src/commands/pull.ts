import fs from 'node:fs'
import path from 'node:path'
import { select } from '@inquirer/prompts'
import ora from 'ora'
import type { Command } from 'commander'
import type { IApiClient } from '../lib/api.js'
import { ApiClient } from '../lib/api.js'
import { getApiUrl, getToken, readSyncState, writeSyncState, setActiveWorkspace, getActiveWorkspace } from '../lib/config.js'
import { findProjectRoot } from '../lib/findRoot.js'
import { log } from '../lib/logger.js'
import { hashContent } from '../lib/scanner.js'

function writePulledFile(rootDir: string, filePath: string, content: string): void {
  const normalizedPath = filePath.split('/').join(path.sep)
  const absPath = path.join(rootDir, normalizedPath)
  const tmpPath = absPath + '.tmp'
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  fs.writeFileSync(tmpPath, content, 'utf8')
  fs.renameSync(tmpPath, absPath)
}

function formatEntryLabel(entry: { message: string; author: string; created_at: string; files_changed: string[] }): string {
  const date = new Date(entry.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  const fileList = entry.files_changed.slice(0, 3).join(', ')
  const overflow = entry.files_changed.length > 3 ? ` +${entry.files_changed.length - 3} more` : ''
  return `[${date}]  ${entry.author}: ${entry.message}  (${fileList}${overflow})`
}

async function pickWorkspace(client: IApiClient, root: string, verb: string): Promise<string | null> {
  const spinner = ora('Loading workspaces…').start()
  let workspaces: Awaited<ReturnType<IApiClient['listRepos']>>['workspaces']
  try {
    const result = await client.listRepos()
    workspaces = result.workspaces
    spinner.stop()
  } catch (err) {
    spinner.stop()
    throw err
  }

  if (workspaces.length === 0) return null

  const active = getActiveWorkspace(root)

  const choices = workspaces.map(ws => ({
    name: `${ws.name}${ws.name === active ? '  [active]' : ''}  ${ws.file_count !== undefined ? `(${ws.file_count} files)` : ''}`,
    value: ws.name,
  }))

  return select<string>({
    message: `Select workspace to ${verb}:`,
    choices,
    default: active ?? choices[0]?.value,
    pageSize: 12,
  })
}

async function pickSnapshot(client: IApiClient, workspace?: string): Promise<string | null> {
  const spinner = ora('Loading version history…').start()
  let entries: Awaited<ReturnType<IApiClient['log']>>['entries']
  try {
    const result = await client.log(50, workspace ?? undefined)
    entries = result.entries
    spinner.stop()
  } catch (err) {
    spinner.stop()
    throw err
  }

  if (entries.length === 0) {
    log.info('No push history yet — pulling latest.')
    return null
  }

  const choices = [
    { name: 'Latest  —  all current files', value: null as string | null },
    ...entries.map(e => ({ name: formatEntryLabel(e), value: e.id })),
  ]

  const snapshotId = await select<string | null>({
    message: 'Select a version to pull:',
    choices,
    pageSize: 12,
  })

  return snapshotId
}

export async function runPull(
  cwd: string,
  opts: { force?: boolean; all?: boolean; snapshot?: string; from?: string },
  client: IApiClient,
): Promise<number> {
  const root = findProjectRoot(cwd)
  if (!root) {
    log.error('No .claude-sync.json found. Run `claude-sync init` first.')
    return 1
  }

  // Step 1: Determine workspace — explicit flag > interactive picker
  let fromWorkspace: string | null = opts.from ?? null
  let interactive = false
  if (!opts.all && !opts.from) {
    try {
      fromWorkspace = await pickWorkspace(client, root, 'pull from')
      interactive = true
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('force closed')) return 0
      throw err
    }
  }

  // Interactive mode always overwrites — no conflict prompts
  const force = opts.force || interactive

  // Step 2: Determine snapshot — explicit flag > interactive picker > latest
  let snapshotId: string | null = opts.snapshot ?? null
  if (!opts.all && !opts.snapshot) {
    try {
      snapshotId = await pickSnapshot(client, fromWorkspace ?? undefined)
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('force closed')) return 0
      throw err
    }
  }

  const wsLabel = fromWorkspace ? `${fromWorkspace} ` : ''
  const label = snapshotId ? `${wsLabel}snapshot ${snapshotId.slice(0, 8)}…` : `${wsLabel}latest`
  const spinner = ora(`Pulling ${label}…`).start()
  let pulled: Awaited<ReturnType<IApiClient['pull']>>
  try {
    pulled = await client.pull(snapshotId ?? undefined, fromWorkspace ?? undefined)
    spinner.stop()
  } catch (err) {
    spinner.stop()
    throw err
  }

  const syncState = readSyncState(root)
  let written = 0
  let skipped = 0

  for (const file of pulled.files) {
    const absPath = path.join(root, file.path.split('/').join(path.sep))
    const localExists = fs.existsSync(absPath)

    if (localExists && !force) {
      const localContent = fs.readFileSync(absPath, 'utf8')
      const localHash = hashContent(localContent)
      const lastKnownHash = syncState[file.path]

      if (lastKnownHash !== undefined && localHash !== lastKnownHash) {
        log.warn(`Skipping ${file.path} — local changes detected (use --force to overwrite)`)
        skipped++
        continue
      }
    }

    writePulledFile(root, file.path, file.content)
    syncState[file.path] = hashContent(file.content)
    written++
  }

  writeSyncState(root, syncState)

  // Remember which workspace we pulled from so push defaults to it
  if (fromWorkspace) {
    setActiveWorkspace(root, fromWorkspace)
    log.success(`Pulled ${written} files — active workspace set to "${fromWorkspace}"`)
  } else {
    const skipMsg = skipped > 0 ? `, skipped ${skipped} (local changes — use --force to overwrite)` : ''
    log.success(`Pulled ${written} files${skipMsg}`)
  }
  return 0
}

export function registerPull(program: Command): void {
  program
    .command('pull')
    .description('Pull files from the workspace — select workspace and version with arrow keys')
    .option('-a, --all', 'skip all pickers and pull latest from current workspace')
    .option('-f, --force', 'overwrite local changes without prompting')
    .option('-s, --snapshot <id>', 'pull a specific snapshot by changelog ID (skips picker)')
    .option('--from <name>', 'pull from a named workspace (skips workspace picker)')
    .option('-q, --quiet', 'suppress non-error output')
    .action(async (opts: { all?: boolean; force?: boolean; snapshot?: string; from?: string; quiet?: boolean }) => {
      const { setQuiet } = await import('../lib/logger.js')
      if (opts.quiet) setQuiet(true)
      const token = getToken()
      const client = new ApiClient(getApiUrl(), token)
      const exitCode = await runPull(process.cwd(), opts, client)
      if (exitCode !== 0) process.exit(exitCode)
    })
}
