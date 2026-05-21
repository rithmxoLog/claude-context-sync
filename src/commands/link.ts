import type { Command } from 'commander'
import { ApiClient, type IApiClient } from '../lib/api.js'
import { getApiUrl, readGlobalConfig, readProjectConfig, writeGlobalConfig } from '../lib/config.js'
import { AuthError } from '../lib/errors.js'
import { log } from '../lib/logger.js'

export async function runLink(token: string, cwd: string, clientFactory: (token: string) => IApiClient): Promise<number> {
  const client = clientFactory(token)
  try {
    await client.status()
  } catch (err) {
    if (err instanceof AuthError) {
      log.error('Invalid token.')
      return 2
    }
    throw err
  }

  const cfg = readGlobalConfig()
  const projectCfg = readProjectConfig(cwd)
  const workspaces = { ...(cfg.workspaces ?? {}) }
  if (projectCfg) {
    workspaces[projectCfg.workspace_name] = { token }
  }
  writeGlobalConfig({ token, workspaces })
  log.success('Token saved. Workspace linked successfully.')
  return 0
}

export function registerLink(program: Command): void {
  program
    .command('link <token>')
    .description('Link this machine to an existing workspace using a token')
    .action(async (token: string) => {
      const exitCode = await runLink(token, process.cwd(), (t) => new ApiClient(getApiUrl(), t))
      if (exitCode !== 0) process.exit(exitCode)
    })
}
