import { input } from '@inquirer/prompts'
import chalk from 'chalk'
import type { Command } from 'commander'
import { ApiClient, type IApiClient } from '../lib/api.js'
import { getApiUrl, getToken } from '../lib/config.js'
import { log } from '../lib/logger.js'

export async function runDeleteRepo(
  nameOrId: string,
  opts: { yes?: boolean },
  client: IApiClient,
): Promise<number> {
  const { workspaces } = await client.listRepos()

  const target = workspaces.find(
    w => w.name === nameOrId || w.workspace_id === nameOrId,
  )

  if (!target) {
    log.error(`No repo found matching "${nameOrId}".`)
    return 1
  }

  console.log(
    `\n  ${chalk.bold(target.name)}  ${chalk.dim(`[${target.workspace_id}]`)}` +
    (target.file_count !== undefined ? chalk.dim(`  ${target.file_count} files`) : '') +
    '\n',
  )

  if (!opts.yes) {
    const answer = await input({
      message: `Type the repo name to confirm deletion:`,
    })
    if (answer.trim() !== target.name) {
      log.warn('Name did not match. Aborted.')
      return 1
    }
  }

  await client.deleteRepo(target.workspace_id)
  log.success(`Repo "${target.name}" deleted.`)
  return 0
}

export function registerDeleteRepo(program: Command): void {
  program
    .command('delete-repo <name-or-id>')
    .description('Permanently delete a repo and all its files from the backend')
    .option('-y, --yes', 'skip confirmation prompt')
    .action(async (nameOrId: string, opts: { yes?: boolean }) => {
      const token = getToken()
      const client = new ApiClient(getApiUrl(), token)
      const exitCode = await runDeleteRepo(nameOrId, opts, client)
      if (exitCode !== 0) process.exit(exitCode)
    })
}
