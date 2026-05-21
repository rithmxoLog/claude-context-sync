import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MockApiClient } from '../src/lib/api.mock.js'
import { runPull } from '../src/commands/pull.js'
import { hashContent } from '../src/lib/scanner.js'

let tmpDir: string
let client: MockApiClient

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-sync-pull-'))
  // init project config
  fs.writeFileSync(path.join(tmpDir, '.claude-sync.json'), JSON.stringify({ workspace_name: 'test' }))
  client = new MockApiClient()
  // seed remote with two files
  await client.push(
    [
      { path: 'CLAUDE.md', content: '# Root' },
      { path: 'docs/guide.md', content: '# Guide' },
    ],
    'seed',
  )
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('runPull', () => {
  it('returns 1 when project root not found', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'no-config-'))
    try {
      const code = await runPull(empty, {}, client)
      expect(code).toBe(1)
    } finally {
      fs.rmSync(empty, { recursive: true, force: true })
    }
  })

  it('writes files to disk on fresh pull', async () => {
    await runPull(tmpDir, {}, client)
    expect(fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8')).toBe('# Root')
    expect(fs.readFileSync(path.join(tmpDir, 'docs', 'guide.md'), 'utf8')).toBe('# Guide')
  })

  it('creates parent directories', async () => {
    await runPull(tmpDir, {}, client)
    expect(fs.existsSync(path.join(tmpDir, 'docs'))).toBe(true)
  })

  it('returns 0 on success', async () => {
    const code = await runPull(tmpDir, {}, client)
    expect(code).toBe(0)
  })

  it('writes sync state after pull', async () => {
    await runPull(tmpDir, {}, client)
    const stateRaw = fs.readFileSync(path.join(tmpDir, '.claude-sync-state.json'), 'utf8')
    const state = JSON.parse(stateRaw)
    expect(state['CLAUDE.md']).toBe(hashContent('# Root'))
    expect(state['docs/guide.md']).toBe(hashContent('# Guide'))
  })

  it('overwrites file when hash matches last-pulled hash (clean)', async () => {
    // first pull
    await runPull(tmpDir, {}, client)
    // remote updates content
    await client.push([{ path: 'CLAUDE.md', content: '# Updated' }], 'update')
    // second pull — local hash still matches sync state, so it should overwrite
    await runPull(tmpDir, {}, client)
    expect(fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8')).toBe('# Updated')
  })

  it('skips locally modified file without --force', async () => {
    await runPull(tmpDir, {}, client)
    // user modifies local file
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Local changes', 'utf8')
    // remote pushes update
    await client.push([{ path: 'CLAUDE.md', content: '# Remote update' }], 'remote update')
    // pull without --force
    await runPull(tmpDir, {}, client)
    // local changes preserved
    expect(fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8')).toBe('# Local changes')
  })

  it('overwrites locally modified file with --force', async () => {
    await runPull(tmpDir, {}, client)
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Local changes', 'utf8')
    await client.push([{ path: 'CLAUDE.md', content: '# Remote update' }], 'remote update')
    await runPull(tmpDir, { force: true }, client)
    expect(fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8')).toBe('# Remote update')
  })

  it('writes new file on first pull even when no sync state exists', async () => {
    // no prior pull — sync state absent
    await runPull(tmpDir, {}, client)
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(true)
  })
})
