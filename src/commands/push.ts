import os from 'node:os'
import { input, select } from '@inquirer/prompts'
import ora from 'ora'
import type { Command } from 'commander'
import type { IApiClient } from '../lib/api.js'
import { ApiClient } from '../lib/api.js'
import { getApiUrl, getToken, getActiveWorkspace, setActiveWorkspace } from '../lib/config.js'
import { findProjectRoot } from '../lib/findRoot.js'
import { log } from '../lib/logger.js'
import { scanMdFiles } from '../lib/scanner.js'

async function pickPushWorkspace(client: IApiClient, root: string): Promise<string | null> {
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
  if (workspaces.length === 1) return workspaces[0]?.name ?? null

  const active = getActiveWorkspace(root)

  const choices = workspaces.map(ws => ({
    name: `${ws.name}${ws.name === active ? '  [active]' : ''}  ${ws.file_count !== undefined ? `(${ws.file_count} files)` : ''}`,
    value: ws.name,
  }))

  return select<string>({
    message: 'Select workspace to push to:',
    choices,
    default: active ?? choices[0]?.value,
    pageSize: 12,
  })
}

export async function runPush(
  cwd: string,
  opts: { message?: string; author?: string; workspace?: string },
  client: IApiClient,
): Promise<number> {
  const root = findProjectRoot(cwd)
  if (!root) {
    log.error('No .claude-sync.json found. Run `claude-sync init` first.')
    return 1
  }

  const files = scanMdFiles(root)
  if (files.length === 0) {
    log.warn('No .md files found. Nothing to push.')
    return 0
  }

  // Workspace picker — explicit flag skips it
  let toWorkspace: string | null = opts.workspace ?? null
  if (!opts.workspace) {
    try {
      toWorkspace = await pickPushWorkspace(client, root)
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('force closed')) return 0
      throw err
    }
  }

  let message: string
  if (opts.message !== undefined) {
    message = opts.message.trim()
    if (!message) {
      log.error('A changelog message is required.')
      return 1
    }
  } else {
    message = (await input({ message: 'Changelog message:' })).trim()
    if (!message) {
      log.error('A changelog message is required.')
      return 1
    }
  }

  const author = opts.author ?? os.userInfo().username
  const wsLabel = toWorkspace ? ` to "${toWorkspace}"` : ''

  const spinner = ora(`Pushing files${wsLabel}…`).start()
  try {
    const result = await client.push(
      files.map(f => ({ path: f.path, content: f.content })),
      message,
      author,
      toWorkspace ?? undefined,
    )
    spinner.stop()

    if (toWorkspace) setActiveWorkspace(root, toWorkspace)
    log.success(`Pushed ${result.pushed} files${wsLabel} (${result.unchanged} unchanged)`)
    return 0
  } catch (err) {
    spinner.stop()
    throw err
  }
}

export function registerPush(program: Command): void {
  program
    .command('push')
    .description('Push all .md files to the workspace — select destination with arrow keys')
    .option('-m, --message <message>', 'changelog message (skip prompt)')
    .option('-a, --author <author>', 'author name (defaults to OS username)')
    .option('--to <name>', 'push to a named workspace (skips workspace picker)')
    .option('-q, --quiet', 'suppress non-error output')
    .action(async (opts: { message?: string; author?: string; to?: string; quiet?: boolean }) => {
      const { setQuiet } = await import('../lib/logger.js')
      if (opts.quiet) setQuiet(true)
      const token = getToken()
      const client = new ApiClient(getApiUrl(), token)
      const exitCode = await runPush(process.cwd(), { ...opts, workspace: opts.to }, client)
      if (exitCode !== 0) process.exit(exitCode)
    })
}
