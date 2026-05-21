import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export interface ScannedFile {
  path: string
  content: string
  hash: string
}

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.claude-sync-cache',
])

export function isIgnored(dirName: string): boolean {
  return IGNORED_DIRS.has(dirName)
}

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex')
}

export function normalizePath(absPath: string, rootDir: string): string {
  return path.relative(rootDir, absPath).split(path.sep).join('/')
}

export function scanMdFiles(rootDir: string): ScannedFile[] {
  const results: ScannedFile[] = []

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!isIgnored(entry.name)) {
          walk(path.join(dir, entry.name))
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const absPath = path.join(dir, entry.name)
        const content = fs.readFileSync(absPath, 'utf8')
        results.push({
          path: normalizePath(absPath, rootDir),
          content,
          hash: hashContent(content),
        })
      }
    }
  }

  walk(rootDir)
  return results
}
