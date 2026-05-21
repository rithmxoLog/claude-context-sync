import fs from 'node:fs'
import path from 'node:path'
import { input } from '@inquirer/prompts'
import type { Command } from 'commander'
import type { IApiClient } from '../lib/api.js'
import { getApiUrl, readGlobalConfig, readProjectConfig, writeGlobalConfig, writeProjectConfig } from '../lib/config.js'
import { log } from '../lib/logger.js'

export async function runInit(
  cwd: string,
  opts: { name?: string },
  client: IApiClient,
): Promise<number> {
  if (readProjectConfig(cwd) !== null) {
    log.warn('Project already initialized (.claude-sync.json exists). Nothing to do.')
    return 0
  }

  const name = opts.name?.trim() ||
    (await input({ message: 'Workspace name:' })).trim()

  if (!name) {
    log.error('Workspace name is required.')
    return 1
  }

  const workspace = await client.createWorkspace(name)

  const cfg = readGlobalConfig()
  const workspaces = { ...(cfg.workspaces ?? {}), [workspace.name]: { token: workspace.token } }
  writeGlobalConfig({ token: workspace.token, workspace_id: workspace.workspace_id, workspaces, api_url: getApiUrl() })
  writeProjectConfig(cwd, { workspace_name: workspace.name })
  updateGitignore(cwd)

  log.success(`Workspace "${workspace.name}" created.`)
  log.info(`Token saved to ~/.claude-sync/config.json`)
  log.info(`Backend: ${getApiUrl()}`)
  return 0
}

function updateGitignore(cwd: string): void {
  const gitignorePath = path.join(cwd, '.gitignore')
  const entries = ['.claude-sync.json', '.claude-sync-state.json']

  let content = ''
  try {
    content = fs.readFileSync(gitignorePath, 'utf8')
  } catch {
    // file doesn't exist — start fresh
  }

  const lines = content.split('\n')
  const toAdd = entries.filter(e => !lines.some(l => l.trim() === e))
  if (toAdd.length === 0) return

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : ''
  fs.writeFileSync(gitignorePath, content + separator + toAdd.join('\n') + '\n', 'utf8')
}

export function registerInit(program: Command, clientFactory: () => IApiClient): void {
  program
    .command('init')
    .description('Create a new workspace and initialize this project')
    .option('-n, --name <name>', 'workspace name (skip prompt)')
    .action(async (opts: { name?: string }) => {
      const cwd = process.cwd()
      const exitCode = await runInit(cwd, opts, clientFactory())
      if (exitCode !== 0) process.exit(exitCode)
    })
}
