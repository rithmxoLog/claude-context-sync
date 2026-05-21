import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MockApiClient } from '../src/lib/api.mock.js'
import { runInit } from '../src/commands/init.js'
import { runLink } from '../src/commands/link.js'
import { AuthError } from '../src/lib/errors.js'
import type { IApiClient, StatusFile } from '../src/lib/api.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-sync-cmd-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ---- init ---------------------------------------------------------------

describe('runInit', () => {
  it('creates .claude-sync.json in cwd', async () => {
    const client = new MockApiClient()
    await runInit(tmpDir, { name: 'my-project' }, client)
    const configPath = path.join(tmpDir, '.claude-sync.json')
    expect(fs.existsSync(configPath)).toBe(true)
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    expect(config.workspace_name).toBe('my-project')
  })

  it('returns 0 on success', async () => {
    const client = new MockApiClient()
    const code = await runInit(tmpDir, { name: 'test' }, client)
    expect(code).toBe(0)
  })

  it('returns 0 and warns when already initialized', async () => {
    const client = new MockApiClient()
    await runInit(tmpDir, { name: 'first' }, client)
    const code = await runInit(tmpDir, { name: 'second' }, client)
    expect(code).toBe(0)
    // still has original workspace name
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.claude-sync.json'), 'utf8'))
    expect(config.workspace_name).toBe('first')
  })

  it('appends .claude-sync.json and .claude-sync-state.json to .gitignore', async () => {
    const client = new MockApiClient()
    await runInit(tmpDir, { name: 'test' }, client)
    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8')
    expect(gitignore).toContain('.claude-sync.json')
    expect(gitignore).toContain('.claude-sync-state.json')
  })

  it('does not duplicate .gitignore entries if already present', async () => {
    fs.writeFileSync(
      path.join(tmpDir, '.gitignore'),
      '.claude-sync.json\n.claude-sync-state.json\n',
      'utf8',
    )
    const client = new MockApiClient()
    await runInit(tmpDir, { name: 'test' }, client)
    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8')
    const matches = (gitignore.match(/\.claude-sync\.json/g) ?? []).length
    expect(matches).toBe(1)
  })

  it('preserves existing .gitignore content', async () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\ndist\n', 'utf8')
    const client = new MockApiClient()
    await runInit(tmpDir, { name: 'test' }, client)
    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8')
    expect(gitignore).toContain('node_modules')
    expect(gitignore).toContain('dist')
  })
})

// ---- link ---------------------------------------------------------------

describe('runLink', () => {
  it('returns 0 and saves token when status succeeds', async () => {
    const mockClient = new MockApiClient()
    await mockClient.push([{ path: 'CLAUDE.md', content: '# hi' }], 'seed')

    const code = await runLink('valid-token', (_token) => mockClient)
    expect(code).toBe(0)
  })

  it('returns 2 when status throws AuthError', async () => {
    const failClient: IApiClient = {
      createWorkspace: vi.fn(),
      push: vi.fn(),
      pull: vi.fn(),
      status: vi.fn().mockRejectedValue(new AuthError()),
      log: vi.fn(),
    }
    const code = await runLink('bad-token', (_token) => failClient)
    expect(code).toBe(2)
  })

  it('re-throws non-auth errors', async () => {
    const failClient: IApiClient = {
      createWorkspace: vi.fn(),
      push: vi.fn(),
      pull: vi.fn(),
      status: vi.fn().mockRejectedValue(new Error('network failure')),
      log: vi.fn(),
    }
    await expect(runLink('token', (_t) => failClient)).rejects.toThrow('network failure')
  })
})
