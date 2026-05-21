import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { AuthError } from './errors.js'

export interface GlobalConfig {
  token?: string
  workspace_id?: string
  api_url?: string
  workspaces?: Record<string, { token: string }>
}

export interface ProjectConfig {
  workspace_name: string
  active_workspace?: string
}

export type SyncState = Record<string, string>

const GLOBAL_DIR = path.join(os.homedir(), '.claude-sync')
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_DIR, 'config.json')
const DEFAULT_API_URL = 'http://192.168.70.40:4000'

export function readGlobalConfig(): GlobalConfig {
  try {
    return JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8')) as GlobalConfig
  } catch {
    return {}
  }
}

export function writeGlobalConfig(updates: Partial<GlobalConfig>): void {
  const existing = readGlobalConfig()
  const merged = { ...existing, ...updates }
  fs.mkdirSync(GLOBAL_DIR, { recursive: true })
  fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8')
}

export function getToken(): string {
  const { token } = readGlobalConfig()
  if (!token) throw new AuthError()
  return token
}

export function getWorkspaceToken(name: string): string | undefined {
  const { workspaces } = readGlobalConfig()
  return workspaces?.[name]?.token
}

export function saveWorkspaceToken(name: string, token: string): void {
  const cfg = readGlobalConfig()
  const workspaces = { ...(cfg.workspaces ?? {}), [name]: { token } }
  writeGlobalConfig({ workspaces })
}

export function getApiUrl(): string {
  const { api_url } = readGlobalConfig()
  return api_url ?? process.env['CLAUDE_SYNC_API_URL'] ?? DEFAULT_API_URL
}

export function readProjectConfig(cwd: string): ProjectConfig | null {
  const filePath = path.join(cwd, '.claude-sync.json')
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ProjectConfig
  } catch {
    return null
  }
}

export function writeProjectConfig(cwd: string, config: ProjectConfig): void {
  const filePath = path.join(cwd, '.claude-sync.json')
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8')
}

export function setActiveWorkspace(root: string, name: string): void {
  const existing = readProjectConfig(root) ?? { workspace_name: '' }
  writeProjectConfig(root, { ...existing, active_workspace: name })
}

export function getActiveWorkspace(root: string): string | undefined {
  return readProjectConfig(root)?.active_workspace
}

export function readSyncState(cwd: string): SyncState {
  const filePath = path.join(cwd, '.claude-sync-state.json')
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as SyncState
  } catch {
    return {}
  }
}

export function writeSyncState(cwd: string, state: SyncState): void {
  const filePath = path.join(cwd, '.claude-sync-state.json')
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8')
}
