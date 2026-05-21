import { hashContent } from './scanner.js'
import type {
  IApiClient,
  PushFile,
  PulledFile,
  StatusFile,
  ChangelogEntry,
  RepoEntry,
} from './api.js'

interface StoredFile {
  path: string
  content: string
  content_hash: string
  version: number
  updated_at: string
}

export class MockApiClient implements IApiClient {
  private files = new Map<string, StoredFile>()
  private changelog: ChangelogEntry[] = []
  private workspaceCounter = 0

  async createWorkspace(name: string) {
    this.workspaceCounter++
    return {
      workspace_id: `mock-ws-${this.workspaceCounter}`,
      token: `mock-token-${this.workspaceCounter}`,
      name,
    }
  }

  async push(files: PushFile[], message: string, author = 'test') {
    let pushed = 0
    let unchanged = 0
    const pushedPaths: string[] = []

    for (const f of files) {
      const hash = hashContent(f.content)
      const existing = this.files.get(f.path)
      if (existing && existing.content_hash === hash) {
        unchanged++
      } else {
        const version = existing ? existing.version + 1 : 1
        this.files.set(f.path, {
          path: f.path,
          content: f.content,
          content_hash: hash,
          version,
          updated_at: new Date().toISOString(),
        })
        pushed++
        pushedPaths.push(f.path)
      }
    }

    if (pushed > 0) {
      this.changelog.push({
        id: `mock-log-${this.changelog.length + 1}`,
        message,
        author,
        files_changed: pushedPaths,
        created_at: new Date().toISOString(),
      })
    }

    return { pushed, unchanged, files: pushedPaths }
  }

  async pull(): Promise<{ files: PulledFile[] }> {
    const files: PulledFile[] = Array.from(this.files.values()).map(f => ({
      path: f.path,
      content: f.content,
      version: f.version,
    }))
    return { files }
  }

  async status(): Promise<{ files: StatusFile[] }> {
    const files: StatusFile[] = Array.from(this.files.values()).map(f => ({
      path: f.path,
      content_hash: f.content_hash,
      version: f.version,
      updated_at: f.updated_at,
    }))
    return { files }
  }

  async log(limit?: number): Promise<{ entries: ChangelogEntry[] }> {
    const entries = [...this.changelog].reverse()
    return { entries: limit !== undefined ? entries.slice(0, limit) : entries }
  }

  async listRepos(): Promise<{ workspaces: RepoEntry[] }> {
    return { workspaces: [] }
  }
}
