#!/usr/bin/env node
import {
  log
} from "./chunk-ISJENZ3O.js";

// src/index.ts
import { Command } from "commander";

// src/lib/errors.ts
var AuthError = class extends Error {
  exitCode = 2;
  constructor(message = "No token configured. Run `claude-sync init` first.") {
    super(message);
    this.name = "AuthError";
  }
};
var NetworkError = class extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = "NetworkError";
  }
  statusCode;
  exitCode = 3;
};

// src/lib/api.ts
var ApiClient = class {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }
  baseUrl;
  token;
  async request(method, path6, body, auth = true) {
    const headers = { "Content-Type": "application/json" };
    if (auth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    const res = await fetch(`${this.baseUrl}${path6}`, {
      method,
      headers,
      body: body !== void 0 ? JSON.stringify(body) : void 0
    });
    if (res.status === 401) {
      throw new AuthError("Unauthorized \u2014 token invalid or expired.");
    }
    if (!res.ok) {
      let message = res.statusText;
      let code = "HTTP_ERROR";
      try {
        const json2 = await res.json();
        if (json2.error) message = json2.error;
        if (json2.code) code = json2.code;
      } catch {
      }
      throw new NetworkError(`${code}: ${message}`, res.status);
    }
    const json = await res.json();
    return json.data;
  }
  createWorkspace(name) {
    return this.request(
      "POST",
      "/workspace",
      { name },
      false
    );
  }
  push(files, message, author, workspace) {
    return this.request(
      "POST",
      "/push",
      { files, message, ...author ? { author } : {}, ...workspace ? { workspace } : {} }
    );
  }
  async pull(snapshotId, workspace) {
    const params = new URLSearchParams();
    if (snapshotId) params.set("snapshot", snapshotId);
    if (workspace) params.set("workspace", workspace);
    const qs = params.size > 0 ? `?${params.toString()}` : "";
    const data = await this.request("GET", `/pull${qs}`);
    return Array.isArray(data) ? { files: data } : data;
  }
  async status() {
    const data = await this.request("GET", "/status");
    return Array.isArray(data) ? { files: data } : data;
  }
  async log(limit, workspace) {
    const params = new URLSearchParams();
    if (limit !== void 0) params.set("limit", String(limit));
    if (workspace) params.set("workspace", workspace);
    const qs = params.size > 0 ? `?${params.toString()}` : "";
    const data = await this.request("GET", `/log${qs}`);
    return Array.isArray(data) ? { entries: data } : data;
  }
  async listRepos() {
    const data = await this.request("GET", "/workspaces");
    return Array.isArray(data) ? { workspaces: data } : data;
  }
};

// src/lib/config.ts
import fs from "fs";
import os from "os";
import path from "path";
var GLOBAL_DIR = path.join(os.homedir(), ".claude-sync");
var GLOBAL_CONFIG_PATH = path.join(GLOBAL_DIR, "config.json");
var DEFAULT_API_URL = "http://192.168.70.40:4000";
function readGlobalConfig() {
  try {
    return JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}
function writeGlobalConfig(updates) {
  const existing = readGlobalConfig();
  const merged = { ...existing, ...updates };
  fs.mkdirSync(GLOBAL_DIR, { recursive: true });
  fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(merged, null, 2), "utf8");
}
function getToken() {
  const { token } = readGlobalConfig();
  if (!token) throw new AuthError();
  return token;
}
function getApiUrl() {
  const { api_url } = readGlobalConfig();
  return api_url ?? process.env["CLAUDE_SYNC_API_URL"] ?? DEFAULT_API_URL;
}
function readProjectConfig(cwd) {
  const filePath = path.join(cwd, ".claude-sync.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}
function writeProjectConfig(cwd, config) {
  const filePath = path.join(cwd, ".claude-sync.json");
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
}
function setActiveWorkspace(root, name) {
  const existing = readProjectConfig(root) ?? { workspace_name: "" };
  writeProjectConfig(root, { ...existing, active_workspace: name });
}
function getActiveWorkspace(root) {
  return readProjectConfig(root)?.active_workspace;
}
function readSyncState(cwd) {
  const filePath = path.join(cwd, ".claude-sync-state.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}
function writeSyncState(cwd, state) {
  const filePath = path.join(cwd, ".claude-sync-state.json");
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
}

// src/commands/init.ts
import fs2 from "fs";
import path2 from "path";
import { input } from "@inquirer/prompts";
async function runInit(cwd, opts, client) {
  if (readProjectConfig(cwd) !== null) {
    log.warn("Project already initialized (.claude-sync.json exists). Nothing to do.");
    return 0;
  }
  const name = opts.name?.trim() || (await input({ message: "Workspace name:" })).trim();
  if (!name) {
    log.error("Workspace name is required.");
    return 1;
  }
  const workspace = await client.createWorkspace(name);
  const cfg = readGlobalConfig();
  const workspaces = { ...cfg.workspaces ?? {}, [workspace.name]: { token: workspace.token } };
  writeGlobalConfig({ token: workspace.token, workspace_id: workspace.workspace_id, workspaces, api_url: getApiUrl() });
  writeProjectConfig(cwd, { workspace_name: workspace.name });
  updateGitignore(cwd);
  log.success(`Workspace "${workspace.name}" created.`);
  log.info(`Token saved to ~/.claude-sync/config.json`);
  log.info(`Backend: ${getApiUrl()}`);
  return 0;
}
function updateGitignore(cwd) {
  const gitignorePath = path2.join(cwd, ".gitignore");
  const entries = [".claude-sync.json", ".claude-sync-state.json"];
  let content = "";
  try {
    content = fs2.readFileSync(gitignorePath, "utf8");
  } catch {
  }
  const lines = content.split("\n");
  const toAdd = entries.filter((e) => !lines.some((l) => l.trim() === e));
  if (toAdd.length === 0) return;
  const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
  fs2.writeFileSync(gitignorePath, content + separator + toAdd.join("\n") + "\n", "utf8");
}
function registerInit(program2, clientFactory) {
  program2.command("init").description("Create a new workspace and initialize this project").option("-n, --name <name>", "workspace name (skip prompt)").action(async (opts) => {
    const cwd = process.cwd();
    const exitCode = await runInit(cwd, opts, clientFactory());
    if (exitCode !== 0) process.exit(exitCode);
  });
}

// src/commands/link.ts
async function runLink(token, cwd, clientFactory) {
  const client = clientFactory(token);
  try {
    await client.status();
  } catch (err) {
    if (err instanceof AuthError) {
      log.error("Invalid token.");
      return 2;
    }
    throw err;
  }
  const cfg = readGlobalConfig();
  const projectCfg = readProjectConfig(cwd);
  const workspaces = { ...cfg.workspaces ?? {} };
  if (projectCfg) {
    workspaces[projectCfg.workspace_name] = { token };
  }
  writeGlobalConfig({ token, workspaces });
  log.success("Token saved. Workspace linked successfully.");
  return 0;
}
function registerLink(program2) {
  program2.command("link <token>").description("Link this machine to an existing workspace using a token").action(async (token) => {
    const exitCode = await runLink(token, process.cwd(), (t) => new ApiClient(getApiUrl(), t));
    if (exitCode !== 0) process.exit(exitCode);
  });
}

// src/commands/push.ts
import os2 from "os";
import { input as input2, select } from "@inquirer/prompts";
import ora from "ora";

// src/lib/findRoot.ts
import fs3 from "fs";
import path3 from "path";
function findProjectRoot(startDir) {
  let dir = path3.resolve(startDir);
  while (true) {
    if (fs3.existsSync(path3.join(dir, ".claude-sync.json"))) return dir;
    const parent = path3.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// src/lib/scanner.ts
import crypto from "crypto";
import fs4 from "fs";
import path4 from "path";
var IGNORED_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".claude-sync-cache"
]);
function isIgnored(dirName) {
  return IGNORED_DIRS.has(dirName);
}
function hashContent(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}
function normalizePath(absPath, rootDir) {
  return path4.relative(rootDir, absPath).split(path4.sep).join("/");
}
function scanMdFiles(rootDir) {
  const results = [];
  function walk(dir) {
    const entries = fs4.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!isIgnored(entry.name)) {
          walk(path4.join(dir, entry.name));
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const absPath = path4.join(dir, entry.name);
        const content = fs4.readFileSync(absPath, "utf8");
        results.push({
          path: normalizePath(absPath, rootDir),
          content,
          hash: hashContent(content)
        });
      }
    }
  }
  walk(rootDir);
  return results;
}

// src/commands/push.ts
async function pickPushWorkspace(client, root) {
  const spinner = ora("Loading workspaces\u2026").start();
  let workspaces;
  try {
    const result = await client.listRepos();
    workspaces = result.workspaces;
    spinner.stop();
  } catch (err) {
    spinner.stop();
    throw err;
  }
  if (workspaces.length === 0) return null;
  if (workspaces.length === 1) return workspaces[0]?.name ?? null;
  const active = getActiveWorkspace(root);
  const choices = workspaces.map((ws) => ({
    name: `${ws.name}${ws.name === active ? "  [active]" : ""}  ${ws.file_count !== void 0 ? `(${ws.file_count} files)` : ""}`,
    value: ws.name
  }));
  return select({
    message: "Select workspace to push to:",
    choices,
    default: active ?? choices[0]?.value,
    pageSize: 12
  });
}
async function runPush(cwd, opts, client) {
  const root = findProjectRoot(cwd);
  if (!root) {
    log.error("No .claude-sync.json found. Run `claude-sync init` first.");
    return 1;
  }
  const files = scanMdFiles(root);
  if (files.length === 0) {
    log.warn("No .md files found. Nothing to push.");
    return 0;
  }
  let toWorkspace = opts.workspace ?? null;
  if (!opts.workspace) {
    try {
      toWorkspace = await pickPushWorkspace(client, root);
    } catch (err) {
      if (err instanceof Error && err.message.includes("force closed")) return 0;
      throw err;
    }
  }
  let message;
  if (opts.message !== void 0) {
    message = opts.message.trim();
    if (!message) {
      log.error("A changelog message is required.");
      return 1;
    }
  } else {
    message = (await input2({ message: "Changelog message:" })).trim();
    if (!message) {
      log.error("A changelog message is required.");
      return 1;
    }
  }
  const author = opts.author ?? os2.userInfo().username;
  const wsLabel = toWorkspace ? ` to "${toWorkspace}"` : "";
  const spinner = ora(`Pushing files${wsLabel}\u2026`).start();
  try {
    const result = await client.push(
      files.map((f) => ({ path: f.path, content: f.content })),
      message,
      author,
      toWorkspace ?? void 0
    );
    spinner.stop();
    if (toWorkspace) setActiveWorkspace(root, toWorkspace);
    log.success(`Pushed ${result.pushed} files${wsLabel} (${result.unchanged} unchanged)`);
    return 0;
  } catch (err) {
    spinner.stop();
    throw err;
  }
}
function registerPush(program2) {
  program2.command("push").description("Push all .md files to the workspace \u2014 select destination with arrow keys").option("-m, --message <message>", "changelog message (skip prompt)").option("-a, --author <author>", "author name (defaults to OS username)").option("--to <name>", "push to a named workspace (skips workspace picker)").option("-q, --quiet", "suppress non-error output").action(async (opts) => {
    const { setQuiet } = await import("./logger-BUOQAS7A.js");
    if (opts.quiet) setQuiet(true);
    const token = getToken();
    const client = new ApiClient(getApiUrl(), token);
    const exitCode = await runPush(process.cwd(), { ...opts, workspace: opts.to }, client);
    if (exitCode !== 0) process.exit(exitCode);
  });
}

// src/commands/pull.ts
import fs5 from "fs";
import path5 from "path";
import { select as select2 } from "@inquirer/prompts";
import ora2 from "ora";
function writePulledFile(rootDir, filePath, content) {
  const normalizedPath = filePath.split("/").join(path5.sep);
  const absPath = path5.join(rootDir, normalizedPath);
  const tmpPath = absPath + ".tmp";
  fs5.mkdirSync(path5.dirname(absPath), { recursive: true });
  fs5.writeFileSync(tmpPath, content, "utf8");
  fs5.renameSync(tmpPath, absPath);
}
function formatEntryLabel(entry) {
  const date = new Date(entry.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const fileList = entry.files_changed.slice(0, 3).join(", ");
  const overflow = entry.files_changed.length > 3 ? ` +${entry.files_changed.length - 3} more` : "";
  return `[${date}]  ${entry.author}: ${entry.message}  (${fileList}${overflow})`;
}
async function pickWorkspace(client, root, verb) {
  const spinner = ora2("Loading workspaces\u2026").start();
  let workspaces;
  try {
    const result = await client.listRepos();
    workspaces = result.workspaces;
    spinner.stop();
  } catch (err) {
    spinner.stop();
    throw err;
  }
  if (workspaces.length === 0) return null;
  const active = getActiveWorkspace(root);
  const choices = workspaces.map((ws) => ({
    name: `${ws.name}${ws.name === active ? "  [active]" : ""}  ${ws.file_count !== void 0 ? `(${ws.file_count} files)` : ""}`,
    value: ws.name
  }));
  return select2({
    message: `Select workspace to ${verb}:`,
    choices,
    default: active ?? choices[0]?.value,
    pageSize: 12
  });
}
async function pickSnapshot(client, workspace) {
  const spinner = ora2("Loading version history\u2026").start();
  let entries;
  try {
    const result = await client.log(50, workspace ?? void 0);
    entries = result.entries;
    spinner.stop();
  } catch (err) {
    spinner.stop();
    throw err;
  }
  if (entries.length === 0) {
    log.info("No push history yet \u2014 pulling latest.");
    return null;
  }
  const choices = [
    { name: "Latest  \u2014  all current files", value: null },
    ...entries.map((e) => ({ name: formatEntryLabel(e), value: e.id }))
  ];
  const snapshotId = await select2({
    message: "Select a version to pull:",
    choices,
    pageSize: 12
  });
  return snapshotId;
}
async function runPull(cwd, opts, client) {
  const root = findProjectRoot(cwd);
  if (!root) {
    log.error("No .claude-sync.json found. Run `claude-sync init` first.");
    return 1;
  }
  let fromWorkspace = opts.from ?? null;
  let interactive = false;
  if (!opts.all && !opts.from) {
    try {
      fromWorkspace = await pickWorkspace(client, root, "pull from");
      interactive = true;
    } catch (err) {
      if (err instanceof Error && err.message.includes("force closed")) return 0;
      throw err;
    }
  }
  const force = opts.force || interactive;
  let snapshotId = opts.snapshot ?? null;
  if (!opts.all && !opts.snapshot) {
    try {
      snapshotId = await pickSnapshot(client, fromWorkspace ?? void 0);
    } catch (err) {
      if (err instanceof Error && err.message.includes("force closed")) return 0;
      throw err;
    }
  }
  const wsLabel = fromWorkspace ? `${fromWorkspace} ` : "";
  const label = snapshotId ? `${wsLabel}snapshot ${snapshotId.slice(0, 8)}\u2026` : `${wsLabel}latest`;
  const spinner = ora2(`Pulling ${label}\u2026`).start();
  let pulled;
  try {
    pulled = await client.pull(snapshotId ?? void 0, fromWorkspace ?? void 0);
    spinner.stop();
  } catch (err) {
    spinner.stop();
    throw err;
  }
  const syncState = readSyncState(root);
  let written = 0;
  let skipped = 0;
  for (const file of pulled.files) {
    const absPath = path5.join(root, file.path.split("/").join(path5.sep));
    const localExists = fs5.existsSync(absPath);
    if (localExists && !force) {
      const localContent = fs5.readFileSync(absPath, "utf8");
      const localHash = hashContent(localContent);
      const lastKnownHash = syncState[file.path];
      if (lastKnownHash !== void 0 && localHash !== lastKnownHash) {
        log.warn(`Skipping ${file.path} \u2014 local changes detected (use --force to overwrite)`);
        skipped++;
        continue;
      }
    }
    writePulledFile(root, file.path, file.content);
    syncState[file.path] = hashContent(file.content);
    written++;
  }
  writeSyncState(root, syncState);
  if (fromWorkspace) {
    setActiveWorkspace(root, fromWorkspace);
    log.success(`Pulled ${written} files \u2014 active workspace set to "${fromWorkspace}"`);
  } else {
    const skipMsg = skipped > 0 ? `, skipped ${skipped} (local changes \u2014 use --force to overwrite)` : "";
    log.success(`Pulled ${written} files${skipMsg}`);
  }
  return 0;
}
function registerPull(program2) {
  program2.command("pull").description("Pull files from the workspace \u2014 select workspace and version with arrow keys").option("-a, --all", "skip all pickers and pull latest from current workspace").option("-f, --force", "overwrite local changes without prompting").option("-s, --snapshot <id>", "pull a specific snapshot by changelog ID (skips picker)").option("--from <name>", "pull from a named workspace (skips workspace picker)").option("-q, --quiet", "suppress non-error output").action(async (opts) => {
    const { setQuiet } = await import("./logger-BUOQAS7A.js");
    if (opts.quiet) setQuiet(true);
    const token = getToken();
    const client = new ApiClient(getApiUrl(), token);
    const exitCode = await runPull(process.cwd(), opts, client);
    if (exitCode !== 0) process.exit(exitCode);
  });
}

// src/commands/status.ts
import chalk from "chalk";
async function runStatus(cwd, client) {
  const root = findProjectRoot(cwd);
  if (!root) {
    log.error("No .claude-sync.json found. Run `claude-sync init` first.");
    return { exitCode: 1, result: { inSync: [], modifiedLocally: [], localOnly: [], remoteOnly: [] } };
  }
  const [localFiles, remoteStatus] = await Promise.all([
    Promise.resolve(scanMdFiles(root)),
    client.status()
  ]);
  const localMap = new Map(localFiles.map((f) => [f.path, f.hash]));
  const remoteMap = new Map((remoteStatus.files ?? []).map((f) => [f.path, f.content_hash]));
  const result = { inSync: [], modifiedLocally: [], localOnly: [], remoteOnly: [] };
  for (const [filePath, localHash] of localMap) {
    const remoteHash = remoteMap.get(filePath);
    if (remoteHash === void 0) {
      result.localOnly.push(filePath);
    } else if (localHash === remoteHash) {
      result.inSync.push(filePath);
    } else {
      result.modifiedLocally.push(filePath);
    }
  }
  for (const filePath of remoteMap.keys()) {
    if (!localMap.has(filePath)) {
      result.remoteOnly.push(filePath);
    }
  }
  if (result.inSync.length > 0) {
    console.log(chalk.green("\nIn sync:"));
    for (const p of result.inSync) console.log(chalk.green(`  \u2714 ${p}`));
  }
  if (result.modifiedLocally.length > 0) {
    console.log(chalk.yellow("\nModified locally:"));
    for (const p of result.modifiedLocally) console.log(chalk.yellow(`  ~ ${p}`));
  }
  if (result.localOnly.length > 0) {
    console.log(chalk.blue("\nLocal only (not pushed):"));
    for (const p of result.localOnly) console.log(chalk.blue(`  + ${p}`));
  }
  if (result.remoteOnly.length > 0) {
    console.log(chalk.red("\nRemote only (not pulled):"));
    for (const p of result.remoteOnly) console.log(chalk.red(`  - ${p}`));
  }
  const total = localMap.size + result.remoteOnly.length;
  if (total === 0) {
    log.info("No .md files found locally or remotely.");
  }
  return { exitCode: 0, result };
}
function registerStatus(program2) {
  program2.command("status").description("Show sync status of .md files").option("-q, --quiet", "suppress non-error output").action(async (opts) => {
    const { setQuiet } = await import("./logger-BUOQAS7A.js");
    if (opts.quiet) setQuiet(true);
    const token = getToken();
    const client = new ApiClient(getApiUrl(), token);
    const { exitCode } = await runStatus(process.cwd(), client);
    if (exitCode !== 0) process.exit(exitCode);
  });
}

// src/commands/log.ts
async function runLog(opts, client) {
  const limit = opts.limit ?? 10;
  const { entries } = await client.log(limit);
  const safeEntries = entries ?? [];
  if (safeEntries.length === 0) {
    log.info("No entries yet.");
    return 0;
  }
  for (const entry of safeEntries) {
    const date = new Date(entry.created_at).toLocaleDateString();
    const files = entry.files_changed.join(", ");
    console.log(`[${date}] ${entry.author}: ${entry.message}  (files: ${files})`);
  }
  return 0;
}
function registerLog(program2) {
  program2.command("log").description("Show push history for this workspace").option("-l, --limit <n>", "number of entries to show", "10").option("-q, --quiet", "suppress non-error output").action(async (opts) => {
    const { setQuiet } = await import("./logger-BUOQAS7A.js");
    if (opts.quiet) setQuiet(true);
    const token = getToken();
    const client = new ApiClient(getApiUrl(), token);
    const limit = opts.limit !== void 0 ? parseInt(opts.limit, 10) : 10;
    const exitCode = await runLog({ limit }, client);
    if (exitCode !== 0) process.exit(exitCode);
  });
}

// src/commands/repos.ts
import chalk2 from "chalk";
async function runRepos(client) {
  const { workspaces } = await client.listRepos();
  if (workspaces.length === 0) {
    log.info("No repos found in the backend.");
    return 0;
  }
  console.log(chalk2.bold(`
Repos in backend (${workspaces.length}):
`));
  for (const ws of workspaces) {
    const date = new Date(ws.created_at).toLocaleDateString();
    const fileCount = ws.file_count !== void 0 ? chalk2.dim(` \u2014 ${ws.file_count} files`) : "";
    console.log(`  ${chalk2.cyan(ws.name)}${fileCount}  ${chalk2.dim(`[${ws.workspace_id}]  created ${date}`)}`);
  }
  return 0;
}
function registerRepos(program2) {
  program2.command("repos").description("List all repos (workspaces) stored in the backend").option("-q, --quiet", "suppress non-error output").action(async (opts) => {
    const { setQuiet } = await import("./logger-BUOQAS7A.js");
    if (opts.quiet) setQuiet(true);
    const token = getToken();
    const client = new ApiClient(getApiUrl(), token);
    const exitCode = await runRepos(client);
    if (exitCode !== 0) process.exit(exitCode);
  });
}

// src/index.ts
var program = new Command();
program.name("claude-sync").description("Sync CLAUDE.md and convention docs across machines").version("0.1.0");
registerInit(program, () => new ApiClient(getApiUrl()));
registerLink(program);
registerPush(program);
registerPull(program);
registerStatus(program);
registerLog(program);
registerRepos(program);
program.parse();
//# sourceMappingURL=index.js.map