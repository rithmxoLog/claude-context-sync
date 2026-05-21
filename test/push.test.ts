import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MockApiClient } from '../src/lib/api.mock.js'
import { runPush } from '../src/commands/push.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-sync-push-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function writeFile(relPath: string, content: string): void {
  const abs = path.join(tmpDir, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf8')
}

function initProject(): void {
  writeFile('.claude-sync.json', JSON.stringify({ workspace_name: 'test' }))
}

describe('runPush', () => {
  it('returns 1 when .claude-sync.json not found', async () => {
    const client = new MockApiClient()
    const code = await runPush(tmpDir, { message: 'test' }, client)
    expect(code).toBe(1)
  })

  it('returns 0 and pushes .md files', async () => {
    initProject()
    writeFile('CLAUDE.md', '# Hello')
    writeFile('docs/guide.md', '# Guide')
    writeFile('src/index.ts', 'export {}')

    const client = new MockApiClient()
    const code = await runPush(tmpDir, { message: 'initial' }, client)
    expect(code).toBe(0)

    const { files } = await client.status()
    const paths = files.map(f => f.path)
    expect(paths).toContain('CLAUDE.md')
    expect(paths).toContain('docs/guide.md')
    expect(paths).not.toContain('src/index.ts')
  })

  it('sends paths with forward slashes', async () => {
    initProject()
    writeFile('nested/deep/doc.md', '# Deep')

    const client = new MockApiClient()
    await runPush(tmpDir, { message: 'slash test' }, client)

    const { files } = await client.status()
    expect(files[0]?.path).toBe('nested/deep/doc.md')
    expect(files[0]?.path).not.toContain('\\')
  })

  it('returns 0 with warning when no .md files found', async () => {
    initProject()
    writeFile('readme.txt', 'not markdown')

    const client = new MockApiClient()
    const code = await runPush(tmpDir, { message: 'empty' }, client)
    expect(code).toBe(0)
  })

  it('returns 1 when message is empty string', async () => {
    initProject()
    writeFile('CLAUDE.md', '# Hello')

    const client = new MockApiClient()
    const code = await runPush(tmpDir, { message: '   ' }, client)
    expect(code).toBe(1)
  })

  it('finds project root when cwd is a subdirectory', async () => {
    initProject()
    writeFile('CLAUDE.md', '# Root doc')
    const subdir = path.join(tmpDir, 'src', 'deep')
    fs.mkdirSync(subdir, { recursive: true })

    const client = new MockApiClient()
    const code = await runPush(subdir, { message: 'from subdir' }, client)
    expect(code).toBe(0)

    const { files } = await client.status()
    expect(files.map(f => f.path)).toContain('CLAUDE.md')
  })

  it('uses provided author in push', async () => {
    initProject()
    writeFile('CLAUDE.md', '# Hello')

    const client = new MockApiClient()
    await runPush(tmpDir, { message: 'custom author', author: 'alice' }, client)

    const { entries } = await client.log()
    expect(entries[0]?.author).toBe('alice')
  })
})
