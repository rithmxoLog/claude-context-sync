import fs from 'node:fs'
import path from 'node:path'

export function findProjectRoot(startDir: string): string | null {
  let dir = path.resolve(startDir)
  while (true) {
    if (fs.existsSync(path.join(dir, '.claude-sync.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}
