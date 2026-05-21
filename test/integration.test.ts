import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ApiClient } from '../src/lib/api.js'
import { hashContent } from '../src/lib/scanner.js'

const API_URL = process.env['CLAUDE_SYNC_API_URL']

describe.skipIf(!API_URL)('integration — real backend', () => {
  let client: ApiClient
  let token: string
  let pushDir: string
  let pullDir: string

  beforeAll(async () => {
    pushDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-int-push-'))
    pullDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-int-pull-'))

    // anonymous client to create workspace
    const anonClient = new ApiClient(API_URL!)
    const ws = await anonClient.createWorkspace(`integration-test-${Date.now()}`)
    token = ws.token
    client = new ApiClient(API_URL!, token)
  })

  afterAll(() => {
    fs.rmSync(pushDir, { recursive: true, force: true })
    fs.rmSync(pullDir, { recursive: true, force: true })
  })

  it('creates workspace and returns token', () => {
    expect(token).toBeTruthy()
  })

  it('pushes files and status shows them', async () => {
    const files = [
      { path: 'CLAUDE.md', content: '# Integration Test\n\nHello from integration.' },
      { path: 'docs/guide.md', content: '# Guide\n\nSetup instructions here.' },
    ]
    const pushResult = await client.push(files, 'integration push', 'test-runner')
    expect(pushResult.pushed).toBe(2)
    expect(pushResult.unchanged).toBe(0)

    const statusResult = await client.status()
    const remotePaths = statusResult.files.map(f => f.path)
    expect(remotePaths).toContain('CLAUDE.md')
    expect(remotePaths).toContain('docs/guide.md')

    for (const f of files) {
      const remote = statusResult.files.find(r => r.path === f.path)
      expect(remote?.content_hash).toBe(hashContent(f.content))
    }
  })

  it('pulls files to a second directory with matching content', async () => {
    const pullResult = await client.pull()
    for (const file of pullResult.files) {
      const normalizedPath = file.path.split('/').join(path.sep)
      const absPath = path.join(pullDir, normalizedPath)
      fs.mkdirSync(path.dirname(absPath), { recursive: true })
      fs.writeFileSync(absPath, file.content, 'utf8')
    }

    expect(fs.readFileSync(path.join(pullDir, 'CLAUDE.md'), 'utf8')).toBe(
      '# Integration Test\n\nHello from integration.',
    )
    expect(fs.readFileSync(path.join(pullDir, 'docs', 'guide.md'), 'utf8')).toBe(
      '# Guide\n\nSetup instructions here.',
    )
  })

  it('log shows the push entry', async () => {
    const logResult = await client.log(10)
    expect(logResult.entries.length).toBeGreaterThan(0)
    const entry = logResult.entries[0]
    expect(entry?.message).toBe('integration push')
    expect(entry?.author).toBe('test-runner')
  })

  it('second push with same content counts as unchanged', async () => {
    const files = [
      { path: 'CLAUDE.md', content: '# Integration Test\n\nHello from integration.' },
    ]
    const result = await client.push(files, 'no-op push', 'test-runner')
    expect(result.unchanged).toBe(1)
    expect(result.pushed).toBe(0)
  })
})
