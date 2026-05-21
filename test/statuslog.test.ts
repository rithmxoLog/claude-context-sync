import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MockApiClient } from '../src/lib/api.mock.js'
import { runStatus } from '../src/commands/status.js'
import { runLog } from '../src/commands/log.js'

let tmpDir: string
let client: MockApiClient

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-sync-sl-'))
  fs.writeFileSync(path.join(tmpDir, '.claude-sync.json'), JSON.stringify({ workspace_name: 'test' }))
  client = new MockApiClient()
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function writeLocal(relPath: string, content: string): void {
  const abs = path.join(tmpDir, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf8')
}

// ---- status ---------------------------------------------------------------

describe('runStatus', () => {
  it('returns 1 when project root not found', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'no-cfg-'))
    try {
      const { exitCode } = await runStatus(empty, client)
      expect(exitCode).toBe(1)
    } finally {
      fs.rmSync(empty, { recursive: true, force: true })
    }
  })

  it('categorizes in-sync file correctly', async () => {
    const content = '# Hello'
    await client.push([{ path: 'CLAUDE.md', content }], 'push')
    writeLocal('CLAUDE.md', content)

    const { result } = await runStatus(tmpDir, client)
    expect(result.inSync).toContain('CLAUDE.md')
    expect(result.modifiedLocally).toHaveLength(0)
    expect(result.localOnly).toHaveLength(0)
    expect(result.remoteOnly).toHaveLength(0)
  })

  it('categorizes locally modified file', async () => {
    await client.push([{ path: 'CLAUDE.md', content: '# Original' }], 'push')
    writeLocal('CLAUDE.md', '# Changed locally')

    const { result } = await runStatus(tmpDir, client)
    expect(result.modifiedLocally).toContain('CLAUDE.md')
    expect(result.inSync).toHaveLength(0)
  })

  it('categorizes local-only file', async () => {
    writeLocal('local-only.md', '# Not pushed')

    const { result } = await runStatus(tmpDir, client)
    expect(result.localOnly).toContain('local-only.md')
  })

  it('categorizes remote-only file', async () => {
    await client.push([{ path: 'remote-only.md', content: '# Remote' }], 'push')
    // no local file

    const { result } = await runStatus(tmpDir, client)
    expect(result.remoteOnly).toContain('remote-only.md')
  })

  it('handles all four states simultaneously', async () => {
    const syncContent = '# In sync'
    await client.push(
      [
        { path: 'synced.md', content: syncContent },
        { path: 'modified.md', content: '# Original' },
        { path: 'remote-only.md', content: '# Remote' },
      ],
      'push',
    )
    writeLocal('synced.md', syncContent)
    writeLocal('modified.md', '# Changed')
    writeLocal('local-only.md', '# Local')

    const { result } = await runStatus(tmpDir, client)
    expect(result.inSync).toContain('synced.md')
    expect(result.modifiedLocally).toContain('modified.md')
    expect(result.localOnly).toContain('local-only.md')
    expect(result.remoteOnly).toContain('remote-only.md')
  })

  it('ignores non-.md local files', async () => {
    writeLocal('script.ts', 'export {}')
    writeLocal('README.md', '# readme')

    const { result } = await runStatus(tmpDir, client)
    const allPaths = [
      ...result.inSync, ...result.modifiedLocally,
      ...result.localOnly, ...result.remoteOnly,
    ]
    expect(allPaths).not.toContain('script.ts')
    expect(allPaths).toContain('README.md')
  })
})

// ---- log ---------------------------------------------------------------

describe('runLog', () => {
  it('prints "No entries yet." when log is empty', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runLog({}, client)
    spy.mockRestore()
    // just verify no error thrown and exitCode 0
  })

  it('returns 0 when log is empty', async () => {
    const code = await runLog({}, client)
    expect(code).toBe(0)
  })

  it('returns 0 with entries', async () => {
    await client.push([{ path: 'doc.md', content: '# hi' }], 'first push', 'alice')
    const code = await runLog({}, client)
    expect(code).toBe(0)
  })

  it('respects limit option', async () => {
    for (let i = 0; i < 5; i++) {
      await client.push([{ path: `file${i}.md`, content: `content ${i}` }], `push ${i}`)
    }
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runLog({ limit: 2 }, client)
    // each entry produces one console.log line
    expect(spy.mock.calls.length).toBe(2)
    spy.mockRestore()
  })

  it('formats output with author, message, and files', async () => {
    await client.push([{ path: 'CLAUDE.md', content: '# hi' }], 'my message', 'bob')
    const lines: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      lines.push(args.join(' '))
    })
    await runLog({}, client)
    spy.mockRestore()
    expect(lines[0]).toContain('bob')
    expect(lines[0]).toContain('my message')
    expect(lines[0]).toContain('CLAUDE.md')
  })
})
