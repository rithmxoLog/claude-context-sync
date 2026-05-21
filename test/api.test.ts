import { describe, it, expect, beforeEach } from 'vitest'
import { MockApiClient } from '../src/lib/api.mock.js'
import { hashContent } from '../src/lib/scanner.js'

let client: MockApiClient

beforeEach(() => {
  client = new MockApiClient()
})

describe('MockApiClient.createWorkspace', () => {
  it('returns workspace_id, token, and name', async () => {
    const result = await client.createWorkspace('my-project')
    expect(result.name).toBe('my-project')
    expect(result.workspace_id).toBeTruthy()
    expect(result.token).toBeTruthy()
  })

  it('returns distinct ids for multiple workspaces', async () => {
    const a = await client.createWorkspace('a')
    const b = await client.createWorkspace('b')
    expect(a.workspace_id).not.toBe(b.workspace_id)
    expect(a.token).not.toBe(b.token)
  })
})

describe('MockApiClient.push', () => {
  it('returns pushed count equal to number of new files', async () => {
    const result = await client.push(
      [{ path: 'CLAUDE.md', content: '# Hello' }],
      'initial push',
    )
    expect(result.pushed).toBe(1)
    expect(result.unchanged).toBe(0)
    expect(result.files).toContain('CLAUDE.md')
  })

  it('counts unchanged files when content is identical', async () => {
    await client.push([{ path: 'CLAUDE.md', content: '# Hello' }], 'first')
    const result = await client.push(
      [{ path: 'CLAUDE.md', content: '# Hello' }],
      'second',
    )
    expect(result.pushed).toBe(0)
    expect(result.unchanged).toBe(1)
  })

  it('counts as pushed when content changes', async () => {
    await client.push([{ path: 'CLAUDE.md', content: '# Hello' }], 'first')
    const result = await client.push(
      [{ path: 'CLAUDE.md', content: '# Updated' }],
      'second',
    )
    expect(result.pushed).toBe(1)
    expect(result.unchanged).toBe(0)
  })
})

describe('MockApiClient.status', () => {
  it('returns files with correct content_hash after push', async () => {
    const content = '# Status Test'
    await client.push([{ path: 'doc.md', content }], 'push')
    const { files } = await client.status()
    expect(files).toHaveLength(1)
    expect(files[0]?.path).toBe('doc.md')
    expect(files[0]?.content_hash).toBe(hashContent(content))
    expect(files[0]?.version).toBe(1)
  })

  it('increments version on update', async () => {
    await client.push([{ path: 'doc.md', content: 'v1' }], 'v1')
    await client.push([{ path: 'doc.md', content: 'v2' }], 'v2')
    const { files } = await client.status()
    expect(files[0]?.version).toBe(2)
  })
})

describe('MockApiClient.pull', () => {
  it('returns pushed content', async () => {
    await client.push(
      [
        { path: 'CLAUDE.md', content: '# Root' },
        { path: 'docs/guide.md', content: '# Guide' },
      ],
      'push docs',
    )
    const { files } = await client.pull()
    expect(files).toHaveLength(2)
    const paths = files.map(f => f.path)
    expect(paths).toContain('CLAUDE.md')
    expect(paths).toContain('docs/guide.md')
  })

  it('returns updated content after re-push', async () => {
    await client.push([{ path: 'doc.md', content: 'original' }], 'first')
    await client.push([{ path: 'doc.md', content: 'updated' }], 'second')
    const { files } = await client.pull()
    expect(files[0]?.content).toBe('updated')
  })
})

describe('MockApiClient.log', () => {
  it('returns entries in reverse chronological order', async () => {
    await client.push([{ path: 'a.md', content: 'a' }], 'first push')
    await client.push([{ path: 'b.md', content: 'b' }], 'second push')
    const { entries } = await client.log()
    expect(entries[0]?.message).toBe('second push')
    expect(entries[1]?.message).toBe('first push')
  })

  it('respects limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await client.push([{ path: `file${i}.md`, content: `content ${i}` }], `push ${i}`)
    }
    const { entries } = await client.log(2)
    expect(entries).toHaveLength(2)
  })

  it('returns empty entries when nothing pushed', async () => {
    const { entries } = await client.log()
    expect(entries).toEqual([])
  })

  it('does not create log entry when all files unchanged', async () => {
    await client.push([{ path: 'doc.md', content: 'same' }], 'first')
    await client.push([{ path: 'doc.md', content: 'same' }], 'no-op')
    const { entries } = await client.log()
    expect(entries).toHaveLength(1)
  })
})
