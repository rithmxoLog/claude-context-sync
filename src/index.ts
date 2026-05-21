#!/usr/bin/env node
import { Command } from 'commander'
import { ApiClient } from './lib/api.js'
import { getApiUrl, getToken } from './lib/config.js'
import { registerInit } from './commands/init.js'
import { registerLink } from './commands/link.js'
import { registerPush } from './commands/push.js'
import { registerPull } from './commands/pull.js'
import { registerStatus } from './commands/status.js'
import { registerLog } from './commands/log.js'
import { registerRepos } from './commands/repos.js'
import { registerDeleteRepo } from './commands/delete-repo.js'

const program = new Command()

program
  .name('claude-sync')
  .description('Sync CLAUDE.md and convention docs across machines')
  .version('0.1.0')

registerInit(program, () => new ApiClient(getApiUrl()))
registerLink(program)
registerPush(program)
registerPull(program)
registerStatus(program)
registerLog(program)
registerRepos(program)
registerDeleteRepo(program)

program.parse()
