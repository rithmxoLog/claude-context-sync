import type { Command } from 'commander'
import type { IApiClient } from '../lib/api.js'
import { ApiClient } from '../lib/api.js'
import { getApiUrl, getToken } from '../lib/config.js'
import { log } from '../lib/logger.js'

export async function runLog(
  opts: { limit?: number },
  client: IApiClient,
): Promise<number> {
  const limit = opts.limit ?? 10
  const { entries } = await client.log(limit)

  const safeEntries = entries ?? []

  if (safeEntries.length === 0) {
    log.info('No entries yet.')
    return 0
  }

  for (const entry of safeEntries) {
    const date = new Date(entry.created_at).toLocaleDateString()
    const files = entry.files_changed.join(', ')
    console.log(`[${date}] ${entry.author}: ${entry.message}  (files: ${files})`)
  }

  return 0
}

export function registerLog(program: Command): void {
  program
    .command('log')
    .description('Show push history for this workspace')
    .option('-l, --limit <n>', 'number of entries to show', '10')
    .option('-q, --quiet', 'suppress non-error output')
    .action(async (opts: { limit?: string; quiet?: boolean }) => {
      const { setQuiet } = await import('../lib/logger.js')
      if (opts.quiet) setQuiet(true)
      const token = getToken()
      const client = new ApiClient(getApiUrl(), token)
      const limit = opts.limit !== undefined ? parseInt(opts.limit, 10) : 10
      const exitCode = await runLog({ limit }, client)
      if (exitCode !== 0) process.exit(exitCode)
    })
}
