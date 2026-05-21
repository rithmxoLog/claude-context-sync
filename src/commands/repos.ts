import chalk from 'chalk'
import type { Command } from 'commander'
import type { IApiClient } from '../lib/api.js'
import { ApiClient } from '../lib/api.js'
import { getApiUrl, getToken } from '../lib/config.js'
import { log } from '../lib/logger.js'

export async function runRepos(client: IApiClient): Promise<number> {
  const { workspaces } = await client.listRepos()

  if (workspaces.length === 0) {
    log.info('No repos found in the backend.')
    return 0
  }

  console.log(chalk.bold(`\nRepos in backend (${workspaces.length}):\n`))
  for (const ws of workspaces) {
    const date = new Date(ws.created_at).toLocaleDateString()
    const fileCount = ws.file_count !== undefined ? chalk.dim(` — ${ws.file_count} files`) : ''
    console.log(`  ${chalk.cyan(ws.name)}${fileCount}  ${chalk.dim(`[${ws.workspace_id}]  created ${date}`)}`)
  }

  return 0
}

export function registerRepos(program: Command): void {
  program
    .command('repos')
    .description('List all repos (workspaces) stored in the backend')
    .option('-q, --quiet', 'suppress non-error output')
    .action(async (opts: { quiet?: boolean }) => {
      const { setQuiet } = await import('../lib/logger.js')
      if (opts.quiet) setQuiet(true)
      const token = getToken()
      const client = new ApiClient(getApiUrl(), token)
      const exitCode = await runRepos(client)
      if (exitCode !== 0) process.exit(exitCode)
    })
}
