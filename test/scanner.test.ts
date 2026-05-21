import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-sync-scanner-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function writeFile(relPath: string, content: string): void {
  const abs = path.join(tmpDir, relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf8')
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex')
}

describe('scanMdFiles', () => {
  it('returns only .md files', async () => {
    const { scanMdFiles } = await import('../src/lib/scanner.js')
    writeFile('CLAUDE.md', '# Hello')
    writeFile('src/index.ts', 'export {}')
    writeFile('docs/guide.md', '# Guide')

    const files = scanMdFiles(tmpDir)
    const filePaths = files.map(f => f.path)
    expect(filePaths).toContain('CLAUDE.md')
    expect(filePaths).toContain('docs/guide.md')
    expect(filePaths.every(p => p.endsWith('.md'))).toBe(true)
    expect(filePaths).not.toContain('src/index.ts')
  })

  it('matches .MD extension case-insensitively', async () => {
    const { scanMdFiles } = await import('../src/lib/scanner.js')
    writeFile('README.MD', '# uppercase')
    writeFile('notes.Md', '# mixed')

    const files = scanMdFiles(tmpDir)
    expect(files.length).toBe(2)
  })

  it('returns paths with forward slashes', async () => {
    const { scanMdFiles } = await import('../src/lib/scanner.js')
    writeFile('a/b/c.md', '# deep')

    const files = scanMdFiles(tmpDir)
    expect(files[0]?.path).toBe('a/b/c.md')
    expect(files[0]?.path).not.toContain('\\')
  })

  it('returns paths relative to rootDir', async () => {
    const { scanMdFiles } = await import('../src/lib/scanner.js')
    writeFile('docs/api.md', '# API')

    const files = scanMdFiles(tmpDir)
    expect(files[0]?.path).toBe('docs/api.md')
  })

  it('prunes node_modules', async () => {
    const { scanMdFiles } = await import('../src/lib/scanner.js')
    writeFile('node_modules/pkg/README.md', '# pkg')
    writeFile('CLAUDE.md', '# root')

    const files = scanMdFiles(tmpDir)
    expect(files.map(f => f.path)).toEqual(['CLAUDE.md'])
  })

  it('prunes .git directory', async () => {
    const { scanMdFiles } = await import('../src/lib/scanner.js')
    writeFile('.git/COMMIT_EDITMSG.md', '# commit')
    writeFile('notes.md', '# notes')

    const files = scanMdFiles(tmpDir)
    expect(files.map(f => f.path)).toEqual(['notes.md'])
  })

  it('prunes dist, build, .next, .claude-sync-cache', async () => {
    const { scanMdFiles } = await import('../src/lib/scanner.js')
    for (const dir of ['dist', 'build', '.next', '.claude-sync-cache']) {
      writeFile(`${dir}/output.md`, `# ${dir}`)
    }
    writeFile('real.md', '# real')

    const files = scanMdFiles(tmpDir)
    expect(files.map(f => f.path)).toEqual(['real.md'])
  })

  it('hashes content with SHA-256', async () => {
    const { scanMdFiles } = await import('../src/lib/scanner.js')
    const content = '# Hello World\n'
    writeFile('test.md', content)

    const files = scanMdFiles(tmpDir)
    expect(files[0]?.hash).toBe(sha256(content))
  })

  it('returns content of each file', async () => {
    const { scanMdFiles } = await import('../src/lib/scanner.js')
    writeFile('doc.md', '# My Doc\n\nSome text.')

    const files = scanMdFiles(tmpDir)
    expect(files[0]?.content).toBe('# My Doc\n\nSome text.')
  })

  it('returns empty array when no .md files exist', async () => {
    const { scanMdFiles } = await import('../src/lib/scanner.js')
    writeFile('index.ts', 'export {}')

    const files = scanMdFiles(tmpDir)
    expect(files).toEqual([])
  })
})

describe('hashContent', () => {
  it('matches crypto.createHash sha256', async () => {
    const { hashContent } = await import('../src/lib/scanner.js')
    const content = 'hello world'
    expect(hashContent(content)).toBe(sha256(content))
  })
})

describe('isIgnored', () => {
  it('returns true for all ignored dirs', async () => {
    const { isIgnored } = await import('../src/lib/scanner.js')
    for (const d of ['node_modules', '.git', 'dist', 'build', '.next', '.claude-sync-cache']) {
      expect(isIgnored(d)).toBe(true)
    }
  })

  it('returns false for normal dirs', async () => {
    const { isIgnored } = await import('../src/lib/scanner.js')
    expect(isIgnored('src')).toBe(false)
    expect(isIgnored('docs')).toBe(false)
  })
})
