import { app } from 'electron'
import { exec as execCallback } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execCallback)

// ── Helpers ──

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getUserSkillsDir(): string {
  return path.join(app.getPath('userData'), 'skills')
}

function getBuiltinSkillsDir(): string {
  return app.isPackaged
    ? path.resolve(process.resourcesPath, 'src/builtin-skills')
    : path.resolve(__dirname, '../src/builtin-skills')
}

interface SkillState {
  version: number
  migrated: boolean
  enabled: string[]
}

function readSkillState(): SkillState {
  const statePath = path.join(getUserSkillsDir(), '.state.json')
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'))
  } catch {
    return { version: 2, migrated: false, enabled: [] }
  }
}

function writeSkillState(state: SkillState): void {
  const dir = getUserSkillsDir()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '.state.json'), JSON.stringify(state, null, 2), 'utf-8')
}

function parseSkillMd(filePath: string): { name: string; description: string; body: string } | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const match = raw.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/)
    if (!match) return null

    const frontmatter: Record<string, string> = {}
    for (const line of match[1].split('\n')) {
      const kv = line.match(/^(\w+):\s*(.+)$/)
      if (kv) frontmatter[kv[1]] = kv[2].replace(/^["']|["']$/g, '')
    }

    return {
      name: frontmatter.name || path.basename(path.dirname(filePath)),
      description: frontmatter.description || '',
      body: match[2].trim(),
    }
  } catch {
    return null
  }
}

/** Ensure a relative path doesn't escape the skill directory. */
function validatePath(skillDir: string, relativePath: string): string {
  const resolved = path.resolve(skillDir, relativePath)
  if (!resolved.startsWith(skillDir + path.sep) && resolved !== skillDir) {
    throw new Error(`Path traversal denied: ${relativePath}`)
  }
  return resolved
}

// ── Migration ──

async function runMigration(): Promise<void> {
  const state = readSkillState()
  if (state.migrated) return

  try {
    const { getDb, queryAll } = await import('./db')
    await getDb()
    const rows = queryAll("SELECT value FROM app_config WHERE key = 'skills'")
    if (rows.length === 0) {
      writeSkillState({ ...state, migrated: true })
      return
    }

    const oldSkills = JSON.parse(rows[0].value as string) as Array<{
      id: string
      name: string
      description: string
      content: string
      builtin: boolean
      enabled: boolean
      created_at: string
    }>

    const userSkillsDir = getUserSkillsDir()
    const enabledNames: string[] = [...state.enabled]

    for (const s of oldSkills.filter((s) => !s.builtin)) {
      const dir = path.join(userSkillsDir, s.name)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        const md = [
          '---',
          `name: ${s.name}`,
          `description: "${s.description}"`,
          '---',
          '',
          s.content || '',
        ].join('\n')
        fs.writeFileSync(path.join(dir, 'SKILL.md'), md, 'utf-8')
      }
      if (s.enabled && !enabledNames.includes(s.name)) {
        enabledNames.push(s.name)
      }
    }

    writeSkillState({ ...state, enabled: enabledNames, migrated: true })
  } catch {
    writeSkillState({ ...state, migrated: true })
  }
}

// ── Scan helpers ──

function scanSkillDir(skillDir: string, builtin: boolean): Array<{
  name: string
  description: string
  content: string
  builtin: boolean
  enabled: boolean
  created_at: string
  hasScripts: boolean
  fileCount: number
}> {
  if (!fs.existsSync(skillDir)) return []

  const state = readSkillState()
  const results: Array<{
    name: string
    description: string
    content: string
    builtin: boolean
    enabled: boolean
    created_at: string
    hasScripts: boolean
    fileCount: number
  }> = []

  for (const entry of fs.readdirSync(skillDir)) {
    if (entry === '.state.json' || entry === '.DS_Store') continue
    const skillPath = path.join(skillDir, entry)
    if (!fs.statSync(skillPath).isDirectory()) continue

    const skillMdPath = path.join(skillPath, 'SKILL.md')
    if (!fs.existsSync(skillMdPath)) continue

    const parsed = parseSkillMd(skillMdPath)
    if (!parsed) continue

    // Count files
    let fileCount = 1 // SKILL.md
    let hasScripts = false
    try {
      const scriptsDir = path.join(skillPath, 'scripts')
      if (fs.existsSync(scriptsDir)) {
        const scripts = fs.readdirSync(scriptsDir)
        hasScripts = scripts.length > 0
        fileCount += scripts.length
      }
      // Count other top-level files
      for (const f of fs.readdirSync(skillPath)) {
        if (f !== 'SKILL.md' && f !== 'scripts' && !f.startsWith('.')) {
          const fp = path.join(skillPath, f)
          if (fs.statSync(fp).isFile()) fileCount++
        }
      }
    } catch {
      // skip file counting errors
    }

    const isEnabled = builtin
      ? state.enabled.length === 0 || state.enabled.includes(parsed.name)
      : state.enabled.includes(parsed.name)

    const stat = fs.statSync(skillMdPath)

    results.push({
      name: parsed.name,
      description: parsed.description,
      content: parsed.body,
      builtin,
      enabled: isEnabled,
      created_at: stat.birthtime.toISOString(),
      hasScripts,
      fileCount,
    })
  }

  return results
}

// ── Exported IPC handlers ──

export async function getSkills(): Promise<
  Array<{
    name: string
    description: string
    content: string
    builtin: boolean
    enabled: boolean
    created_at: string
    hasScripts: boolean
    fileCount: number
  }>
> {
  await runMigration()

  const builtinSkills = scanSkillDir(getBuiltinSkillsDir(), true)
  const userSkills = scanSkillDir(getUserSkillsDir(), false)

  // User skills override builtin with same name
  const userNames = new Set(userSkills.map((s) => s.name))
  const filteredBuiltin = builtinSkills.filter((s) => !userNames.has(s.name))

  return [...filteredBuiltin, ...userSkills]
}

export async function getSkillDetail(
  _event?: Electron.IpcMainInvokeEvent,
  name: string,
): Promise<{
  skill: {
    name: string
    description: string
    content: string
    builtin: boolean
    enabled: boolean
    created_at: string
    hasScripts: boolean
    fileCount: number
  } | null
  files: Array<{ name: string; path: string; isDirectory: boolean; size: number }>
}> {
  const all = await getSkills()
  const skill = all.find((s) => s.name === name) || null

  if (!skill) return { skill: null, files: [] }

  const dir = skill.builtin ? path.join(getBuiltinSkillsDir(), name) : path.join(getUserSkillsDir(), name)
  const files: Array<{ name: string; path: string; isDirectory: boolean; size: number }> = []

  function walkDir(dirPath: string, relPrefix: string): void {
    try {
      for (const entry of fs.readdirSync(dirPath)) {
        if (entry.startsWith('.')) continue
        const fullPath = path.join(dirPath, entry)
        const relPath = relPrefix ? `${relPrefix}/${entry}` : entry
        const stat = fs.statSync(fullPath)
        files.push({ name: entry, path: relPath, isDirectory: stat.isDirectory(), size: stat.size })
        if (stat.isDirectory()) {
          walkDir(fullPath, relPath)
        }
      }
    } catch {
      // skip unreadable entries
    }
  }

  if (fs.existsSync(dir)) {
    walkDir(dir, '')
  }

  return { skill, files }
}

export async function saveSkill(
  _event?: Electron.IpcMainInvokeEvent,
  data: { name: string; description: string; content: string },
): Promise<void> {
  const skillDir = path.join(getUserSkillsDir(), data.name)
  fs.mkdirSync(skillDir, { recursive: true })

  const md = [
    '---',
    `name: ${data.name}`,
    `description: ${data.description}`,
    '---',
    '',
    data.content,
  ].join('\n')

  // Preserve description quotes if already quoted
  const finalMd = md.replace(
    /^description: (.+)$/m,
    (_, desc) => `description: "${desc.replace(/"/g, '\\"')}"`,
  )

  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), finalMd, 'utf-8')

  // Auto-enable new skill
  const state = readSkillState()
  if (!state.enabled.includes(data.name)) {
    state.enabled.push(data.name)
    writeSkillState(state)
  }
}

export async function deleteSkill(
  _event?: Electron.IpcMainInvokeEvent,
  name: string,
): Promise<void> {
  const skillDir = path.join(getUserSkillsDir(), name)
  if (!fs.existsSync(skillDir)) throw new Error(`Skill not found: ${name}`)
  fs.rmSync(skillDir, { recursive: true, force: true })

  // Remove from enabled list
  const state = readSkillState()
  state.enabled = state.enabled.filter((n) => n !== name)
  writeSkillState(state)
}

export async function toggleSkill(
  _event?: Electron.IpcMainInvokeEvent,
  name: string,
  enabled: boolean,
): Promise<void> {
  const state = readSkillState()
  if (enabled) {
    if (!state.enabled.includes(name)) state.enabled.push(name)
  } else {
    state.enabled = state.enabled.filter((n) => n !== name)
  }
  writeSkillState(state)
}

export async function getSkillFiles(
  _event?: Electron.IpcMainInvokeEvent,
  name: string,
): Promise<Array<{ name: string; path: string; isDirectory: boolean; size: number }>> {
  const all = await getSkills()
  const skill = all.find((s) => s.name === name)
  if (!skill) throw new Error(`Skill not found: ${name}`)

  const dir = skill.builtin ? path.join(getBuiltinSkillsDir(), name) : path.join(getUserSkillsDir(), name)
  const files: Array<{ name: string; path: string; isDirectory: boolean; size: number }> = []

  function walkDir(dirPath: string, relPrefix: string): void {
    try {
      for (const entry of fs.readdirSync(dirPath)) {
        if (entry.startsWith('.')) continue
        const fullPath = path.join(dirPath, entry)
        const relPath = relPrefix ? `${relPrefix}/${entry}` : entry
        const stat = fs.statSync(fullPath)
        files.push({ name: entry, path: relPath, isDirectory: stat.isDirectory(), size: stat.size })
        if (stat.isDirectory()) {
          walkDir(fullPath, relPath)
        }
      }
    } catch {
      // skip unreadable entries
    }
  }

  if (fs.existsSync(dir)) walkDir(dir, '')
  return files
}

export async function readSkillFile(
  _event?: Electron.IpcMainInvokeEvent,
  name: string,
  relativePath: string,
): Promise<string> {
  const all = await getSkills()
  const skill = all.find((s) => s.name === name)
  if (!skill) throw new Error(`Skill not found: ${name}`)

  const dir = skill.builtin ? path.join(getBuiltinSkillsDir(), name) : path.join(getUserSkillsDir(), name)
  const filePath = validatePath(dir, relativePath)
  return fs.readFileSync(filePath, 'utf-8')
}

export async function writeSkillFile(
  _event?: Electron.IpcMainInvokeEvent,
  name: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const skillDir = path.join(getUserSkillsDir(), name)
  if (!fs.existsSync(skillDir)) throw new Error(`Skill not found: ${name}`)

  const filePath = validatePath(skillDir, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}

export async function deleteSkillFile(
  _event?: Electron.IpcMainInvokeEvent,
  name: string,
  relativePath: string,
): Promise<void> {
  const skillDir = path.join(getUserSkillsDir(), name)
  if (!fs.existsSync(skillDir)) throw new Error(`Skill not found: ${name}`)

  const filePath = validatePath(skillDir, relativePath)
  if (!fs.statSync(filePath).isFile()) throw new Error(`Not a file: ${relativePath}`)
  fs.unlinkSync(filePath)
}

export async function runScript(
  _event?: Electron.IpcMainInvokeEvent,
  name: string,
  scriptName: string,
  scriptArgs: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const all = await getSkills()
  const skill = all.find((s) => s.name === name)
  if (!skill) throw new Error(`Skill not found: ${name}`)

  const dir = skill.builtin ? path.join(getBuiltinSkillsDir(), name) : path.join(getUserSkillsDir(), name)
  const scriptPath = validatePath(dir, scriptName)
  if (!fs.existsSync(scriptPath)) throw new Error(`Script not found: ${scriptName}`)

  const result = await exec(`${scriptPath} ${scriptArgs}`, {
    cwd: path.dirname(scriptPath),
    timeout: 30000,
  })

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: 0,
  }
}
