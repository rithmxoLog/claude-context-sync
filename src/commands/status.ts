import chalk from 'chalk'
import type { Command } from 'commander'
import type { IApiClient } from '../lib/api.js'
import { ApiClient } from '../lib/api.js'
import { getApiUrl, getToken } from '../lib/config.js'
import { findProjectRoot } from '../lib/findRoot.js'
import { log } from '../lib/logger.js'
import { scanMdFiles } from '../lib/scanner.js'

export interface StatusResult {
  inSync: string[]
  modifiedLocally: string[]
  localOnly: string[]
  remoteOnly: string[]
}

export async function runStatus(
  cwd: string,
  client: IApiClient,
): Promise<{ exitCode: number; result: StatusResult }> {
  const root = findProjectRoot(cwd)
  if (!root) {
    log.error('No .claude-sync.json found. Run `claude-sync init` first.')
    return { exitCode: 1, result: { inSync: [], modifiedLocally: [], localOnly: [], remoteOnly: [] } }
  }

  const [localFiles, remoteStatus] = await Promise.all([
    Promise.resolve(scanMdFiles(root)),
    client.status(),
  ])

  const localMap = new Map(localFiles.map(f => [f.path, f.hash]))

  const remoteMap = new Map((remoteStatus.files ?? []).map(f => [f.path, f.content_hash]))

  const result: StatusResult = { inSync: [], modifiedLocally: [], localOnly: [], remoteOnly: [] }

  for (const [filePath, localHash] of localMap) {
    const remoteHash = remoteMap.get(filePath)
    if (remoteHash === undefined) {
      result.localOnly.push(filePath)
    } else if (localHash === remoteHash) {
      result.inSync.push(filePath)
    } else {
      result.modifiedLocally.push(filePath)
    }
  }

  for (const filePath of remoteMap.keys()) {
    if (!localMap.has(filePath)) {
      result.remoteOnly.push(filePath)
    }
  }

  // Print grouped output
  if (result.inSync.length > 0) {
    console.log(chalk.green('\nIn sync:'))
    for (const p of result.inSync) console.log(chalk.green(`  ✔ ${p}`))
  }
  if (result.modifiedLocally.length > 0) {
    console.log(chalk.yellow('\nModified locally:'))
    for (const p of result.modifiedLocally) console.log(chalk.yellow(`  ~ ${p}`))
  }
  if (result.localOnly.length > 0) {
    console.log(chalk.blue('\nLocal only (not pushed):'))
    for (const p of result.localOnly) console.log(chalk.blue(`  + ${p}`))
  }
  if (result.remoteOnly.length > 0) {
    console.log(chalk.red('\nRemote only (not pulled):'))
    for (const p of result.remoteOnly) console.log(chalk.red(`  - ${p}`))
  }

  const total = localMap.size + result.remoteOnly.length
  if (total === 0) {
    log.info('No .md files found locally or remotely.')
  }

  return { exitCode: 0, result }
}

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('Show sync status of .md files')
    .option('-q, --quiet', 'suppress non-error output')
    .action(async (opts: { quiet?: boolean }) => {
      const { setQuiet } = await import('../lib/logger.js')
      if (opts.quiet) setQuiet(true)
      const token = getToken()
      const client = new ApiClient(getApiUrl(), token)
      const { exitCode } = await runStatus(process.cwd(), client)
      if (exitCode !== 0) process.exit(exitCode)
    })
}
