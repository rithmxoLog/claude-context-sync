import { AuthError, NetworkError } from './errors.js'

export interface PushFile {
  path: string
  content: string
}

export interface PulledFile {
  path: string
  content: string
  version: number
}

export interface StatusFile {
  path: string
  content_hash: string
  version: number
  updated_at: string
}

export interface ChangelogEntry {
  id: string
  message: string
  author: string
  files_changed: string[]
  created_at: string
}

export interface RepoEntry {
  workspace_id: string
  name: string
  created_at: string
  file_count?: number
}

export interface IApiClient {
  createWorkspace(name: string): Promise<{ workspace_id: string; token: string; name: string }>
  push(files: PushFile[], message: string, author?: string, workspace?: string): Promise<{ pushed: number; unchanged: number; files: string[] }>
  pull(snapshotId?: string, workspace?: string): Promise<{ files: PulledFile[] }>
  status(): Promise<{ files: StatusFile[] }>
  log(limit?: number, workspace?: string): Promise<{ entries: ChangelogEntry[] }>
  listRepos(): Promise<{ workspaces: RepoEntry[] }>
  deleteRepo(workspaceId: string): Promise<void>
}

export class ApiClient implements IApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token?: string,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    auth = true,
  ): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (auth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (res.status === 401) {
      throw new AuthError('Unauthorized — token invalid or expired.')
    }

    if (!res.ok) {
      let message = res.statusText
      let code = 'HTTP_ERROR'
      try {
        const json = (await res.json()) as { error?: string; code?: string }
        if (json.error) message = json.error
        if (json.code) code = json.code
      } catch {
        // ignore parse failure
      }
      throw new NetworkError(`${code}: ${message}`, res.status)
    }

    const json = (await res.json()) as { data: T }
    return json.data
  }

  createWorkspace(name: string) {
    return this.request<{ workspace_id: string; token: string; name: string }>(
      'POST', '/workspace', { name }, false,
    )
  }

  push(files: PushFile[], message: string, author?: string, workspace?: string) {
    return this.request<{ pushed: number; unchanged: number; files: string[] }>(
      'POST', '/push', { files, message, ...(author ? { author } : {}), ...(workspace ? { workspace } : {}) },
    )
  }

  async pull(snapshotId?: string, workspace?: string) {
    const params = new URLSearchParams()
    if (snapshotId) params.set('snapshot', snapshotId)
    if (workspace) params.set('workspace', workspace)
    const qs = params.size > 0 ? `?${params.toString()}` : ''
    const data = await this.request<{ files: PulledFile[] } | PulledFile[]>('GET', `/pull${qs}`)
    return Array.isArray(data) ? { files: data } : data
  }

  async status() {
    const data = await this.request<{ files: StatusFile[] } | StatusFile[]>('GET', '/status')
    return Array.isArray(data) ? { files: data } : data
  }

  async log(limit?: number, workspace?: string) {
    const params = new URLSearchParams()
    if (limit !== undefined) params.set('limit', String(limit))
    if (workspace) params.set('workspace', workspace)
    const qs = params.size > 0 ? `?${params.toString()}` : ''
    const data = await this.request<{ entries: ChangelogEntry[] } | ChangelogEntry[]>('GET', `/log${qs}`)
    return Array.isArray(data) ? { entries: data } : data
  }

  async listRepos() {
    const data = await this.request<{ workspaces: RepoEntry[] } | RepoEntry[]>('GET', '/workspaces')
    return Array.isArray(data) ? { workspaces: data } : data
  }

  async deleteRepo(workspaceId: string): Promise<void> {
    await this.request<{ deleted: boolean }>('DELETE', `/workspaces/${workspaceId}`)
  }
}
