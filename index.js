/**
 * Prompt Manager — Host half.
 *
 * A file-backed prompt library exposed to the Web UI through the Typert
 * Gateway ("Remote"). Two source kinds are supported:
 *
 * - `json` — a `{ version, prompts: [...] }` document holding many prompts;
 * - `text` — one `.md` / `.markdown` / `.txt` file holding exactly one prompt,
 *   whose title comes from its first `# heading`. Its injection flag lives in
 *   this plugin's own state file, so the user's file stays untouched.
 *
 * Prompts marked `inject: true` are rendered into every agent's system prompt
 * through `ctx.systemPrompt.section()`.
 *
 * The service is discovered by the Gateway through its structural
 * `typertRemote` binding and prototype Remote markers (the same shape the
 * generated `@deepseek-ai/dsh-typert-protocol` decorators produce), so this
 * file imports no Harness packages and stays free of dual-instance hazards.
 */
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/** Prototype property the Gateway reads through `remoteMethods(service)`. */
const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods'
const SERVICE_KEY = 'promptManager'
const INTERNAL_SOURCE_ID = 'internal'
const FILE_VERSION = 1
const STATE_VERSION = 1
/** Default lead-in of the injected block; the user may override or clear it. */
const DEFAULT_PREAMBLE = 'The following user-managed prompts are active. Treat them as standing instructions from the user.'
/** Stable id of the single prompt a text source exposes. */
const TEXT_PROMPT_ID = 'file'
const TEXT_EXTENSIONS = ['.md', '.markdown', '.txt']
const SUPPORTED_EXTENSIONS = ['.json', ...TEXT_EXTENSIONS]

export const inject = ['systemPrompt']

/**
 * Record direct Remote markers on a prototype, replicating the exact frozen
 * shape that `@deepseek-ai/dsh-typert-protocol`'s `Remote(...)` decorator
 * stores (string-keyed, so no package import is required).
 */
function markRemoteMethods(prototype, methods) {
  const markers = methods.map((method) => Object.freeze({
    method,
    invocation: Object.freeze({ kind: 'direct' }),
  }))
  Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
    configurable: true,
    value: Object.freeze({ version: 1, methods: Object.freeze(markers) }),
  })
}

function fail(message) {
  throw new Error(`prompt-manager: ${message}`)
}

function asString(value, field, { optional = false, max = 100_000 } = {}) {
  if (value === undefined || value === null) {
    if (optional) return undefined
    fail(`${field} is required`)
  }
  if (typeof value !== 'string') fail(`${field} must be a string`)
  if (value.length > max) fail(`${field} exceeds ${max} characters`)
  return value
}

function asBoolean(value, field, fallback) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'boolean') fail(`${field} must be a boolean`)
  return value
}

/** Stable id for a user-declared source: slug of its absolute path. */
function sourceIdForPath(filePath) {
  const slug = filePath.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(-48)
  return `ext-${slug || randomUUID().slice(0, 8)}`
}

function extensionOf(filePath) {
  return path.extname(filePath).toLowerCase()
}

/** `text` for a markdown/plain source, `json` for a prompt document. */
function kindOfPath(filePath) {
  return TEXT_EXTENSIONS.includes(extensionOf(filePath)) ? 'text' : 'json'
}

function formatOfPath(filePath) {
  const extension = extensionOf(filePath)
  return extension === '' ? 'json' : extension.slice(1)
}

/** A text source's title: its first ATX heading, else its file name. */
function deriveTitle(text, filePath) {
  const match = /^ {0,3}#\s+(.+?)\s*$/m.exec(text)
  if (match && match[1].trim() !== '') return match[1].trim()
  return path.basename(filePath, path.extname(filePath))
}

class PromptManagerService {
  constructor(ctx, config) {
    this.ctx = ctx
    const baseDir = process.env.DSH_PROFILE_DIR ?? path.join(os.homedir(), '.dsh')
    this.dir = path.join(baseDir, 'prompt-manager')
    this.stateFile = path.join(this.dir, 'state.json')
    this.internalPath = path.join(this.dir, 'prompts.json')
    this.configSources = Array.isArray(config?.sources) ? config.sources : []
    /** Serializes every atomic write so concurrent saves cannot interleave. */
    this.writeChain = Promise.resolve()
    /** Last rendered injection text; the system-prompt section reads it synchronously. */
    this.injectedText = ''
    this.injectedRefresh = null
    this.injectedRefreshedAt = 0
    /** Structural binding the Gateway uses for source-mode discovery. */
    this.typertRemote = Object.freeze({
      service: this,
      serviceKey: SERVICE_KEY,
      namespace: SERVICE_KEY,
    })
  }

  // -- sources ---------------------------------------------------------------

  async listSources() {
    const sources = [{
      id: INTERNAL_SOURCE_ID,
      path: this.internalPath,
      readonly: false,
      internal: true,
    }]
    for (const entry of this.configSources) {
      if (!entry || typeof entry.path !== 'string' || entry.path.length === 0) continue
      sources.push({
        id: typeof entry.id === 'string' && entry.id ? entry.id : sourceIdForPath(entry.path),
        path: entry.path,
        readonly: entry.readonly === true,
        internal: false,
      })
    }
    const state = await this.readState()
    for (const entry of state.sources) {
      sources.push({ ...entry, internal: false })
    }
    const seen = new Set()
    return sources
      .filter((source) => {
        if (seen.has(source.id)) return false
        seen.add(source.id)
        return true
      })
      .map((source) => ({
        ...source,
        kind: kindOfPath(source.path),
        format: formatOfPath(source.path),
      }))
  }

  async readState() {
    try {
      const raw = await fsp.readFile(this.stateFile, 'utf8')
      const data = JSON.parse(raw)
      const sources = Array.isArray(data?.sources) ? data.sources : []
      const inject = data?.inject && typeof data.inject === 'object' ? data.inject : {}
      const seededSystemPrompt = data?.seededSystemPrompt === true
      const preamble = typeof data?.preamble === 'string' ? data.preamble : null
      return {
        seededSystemPrompt,
        preamble,
        sources: sources
          .filter((entry) => entry && typeof entry.path === 'string' && entry.path.length > 0)
          .map((entry) => ({
            id: typeof entry.id === 'string' && entry.id ? entry.id : sourceIdForPath(entry.path),
            path: entry.path,
            readonly: entry.readonly === true,
          })),
        inject,
      }
    } catch {
      return { sources: [], inject: {}, seededSystemPrompt: false, preamble: null }
    }
  }

  async writeState(state) {
    await fsp.mkdir(this.dir, { recursive: true })
    await this.writeJsonAtomic(this.stateFile, {
      version: STATE_VERSION,
      sources: state.sources,
      inject: state.inject ?? {},
      seededSystemPrompt: state.seededSystemPrompt === true,
      ...(typeof state.preamble === 'string' ? { preamble: state.preamble } : {}),
    })
  }

  async writeJsonAtomic(file, data) {
    await this.writeTextAtomic(file, `${JSON.stringify(data, null, 2)}\n`)
  }

  async writeTextAtomic(file, text) {
    const task = async () => {
      await fsp.mkdir(path.dirname(file), { recursive: true })
      // A pid+timestamp name collides when two writes land in the same
      // millisecond, so each atomic write gets its own unique temp path.
      const tmp = `${file}.${randomUUID()}.tmp`
      await fsp.writeFile(tmp, text, 'utf8')
      await fsp.rename(tmp, file)
    }
    this.writeChain = this.writeChain.then(task, task)
    return this.writeChain
  }

  /** Injection flag of one text source, kept beside the sources in our state. */
  async injectFlagFor(filePath) {
    const state = await this.readState()
    return state.inject[filePath] === true
  }

  async setInjectFlag(filePath, value) {
    const state = await this.readState()
    if (value) state.inject[filePath] = true
    else delete state.inject[filePath]
    await this.writeState(state)
  }

  // -- prompt files ----------------------------------------------------------

  /** Read one source into `{ exists, prompts, error }`. */
  async readSource(source) {
    if (source.kind === 'text') {
      let raw
      try {
        raw = await fsp.readFile(source.path, 'utf8')
      } catch (error) {
        if (error && error.code === 'ENOENT') return { exists: false, prompts: [] }
        return { exists: false, prompts: [], error: `unreadable: ${error.message}` }
      }
      const stat = await fsp.stat(source.path).catch(() => null)
      return {
        exists: true,
        prompts: [{
          id: TEXT_PROMPT_ID,
          title: deriveTitle(raw, source.path),
          content: raw.endsWith('\n') ? raw.slice(0, -1) : raw,
          inject: await this.injectFlagFor(source.path),
          updatedAt: stat ? stat.mtime.toISOString() : '',
        }],
      }
    }
    let raw
    try {
      raw = await fsp.readFile(source.path, 'utf8')
    } catch (error) {
      if (error && error.code === 'ENOENT') return { exists: false, prompts: [] }
      return { exists: false, prompts: [], error: `unreadable: ${error.message}` }
    }
    try {
      const data = JSON.parse(raw)
      const prompts = Array.isArray(data?.prompts) ? data.prompts : []
      return {
        exists: true,
        prompts: prompts
          .filter((p) => p && typeof p.id === 'string' && typeof p.title === 'string')
          .map((p) => ({
            id: p.id,
            title: p.title,
            content: typeof p.content === 'string' ? p.content : '',
            inject: p.inject === true,
            updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : '',
            origin: typeof p.origin === 'string' ? p.origin : '',
          })),
      }
    } catch (error) {
      return { exists: true, prompts: [], error: `invalid JSON: ${error.message}` }
    }
  }

  async writeSource(source, prompts) {
    if (source.kind === 'text') {
      const content = prompts[0]?.content ?? ''
      await this.writeTextAtomic(source.path, content === '' || content.endsWith('\n') ? content : `${content}\n`)
      return
    }
    await this.writeJsonAtomic(source.path, { version: FILE_VERSION, prompts })
  }

  async resolveSource(sourceId) {
    const sources = await this.listSources()
    const source = sources.find((candidate) => candidate.id === sourceId)
    if (!source) fail(`unknown source "${sourceId}"`)
    return source
  }

  static keyOf(sourceId, promptId) {
    return `${sourceId}/${promptId}`
  }

  static parseKey(key) {
    const text = asString(key, 'key')
    const slash = text.indexOf('/')
    if (slash <= 0 || slash === text.length - 1) fail(`malformed key "${text}"`)
    return { sourceId: text.slice(0, slash), promptId: text.slice(slash + 1) }
  }

  /** Decorate one prompt with the facts the management page needs. */
  static decorate(source, prompt) {
    return {
      key: PromptManagerService.keyOf(source.id, prompt.id),
      sourceId: source.id,
      sourcePath: source.path,
      readonly: source.readonly,
      kind: source.kind,
      format: source.format,
      editableTitle: source.kind === 'json',
      deletable: source.kind === 'json',
      ...prompt,
    }
  }

  // -- injected block preamble -------------------------------------------------

  /** The lead-in actually used: the override when set, otherwise the default. */
  async effectivePreamble() {
    const state = await this.readState()
    return typeof state.preamble === 'string' ? state.preamble : DEFAULT_PREAMBLE
  }

  /**
   * Replace the injected block's lead-in. `text: null` restores the default and
   * `text: ''` removes the lead-in entirely.
   */
  async setPreamble(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const state = await this.readState()
    if (request.text === null || request.text === undefined) delete state.preamble
    else state.preamble = asString(request.text, 'text', { max: 4000 })
    await this.writeState(state)
    this.refreshInjected()
    return { preamble: typeof state.preamble === 'string' ? state.preamble : DEFAULT_PREAMBLE }
  }

  // -- DSH's own prompts -------------------------------------------------------

  /** Marker stored on prompts imported from the assembled system prompt. */
  static get SYSTEM_PROMPT_ORIGIN() {
    return 'dsh-system-prompt'
  }

  /**
   * Snapshot the assembled system prompt as prompt entries: one entry per
   * section, named after it, with injection off (DSH already injects these).
   */
  async captureSystemPrompt() {
    const assembly = await this.ctx.systemPrompt.assemble({})
    const sections = Array.isArray(assembly?.sections) ? assembly.sections : []
    const now = new Date().toISOString()
    return sections
      .filter((section) => section && typeof section.name === 'string'
        && typeof section.text === 'string' && section.text.trim() !== '')
      .map((section) => ({
        id: `dsh-${section.name}`,
        title: `DSH · ${section.name}`,
        content: section.text,
        inject: false,
        origin: PromptManagerService.SYSTEM_PROMPT_ORIGIN,
        updatedAt: now,
      }))
  }

  /**
   * On the first panel open, fill an untouched built-in file with DSH's own
   * prompts so the library is never empty out of the box. Runs on `overview`
   * (not at activation) so every prompt section is already registered.
   */
  async ensureSystemPromptSeed() {
    const state = await this.readState()
    if (state.seededSystemPrompt) return
    const source = await this.resolveSource(INTERNAL_SOURCE_ID)
    const file = await this.readSource(source)
    if (file.error) return
    if (file.exists && file.prompts.length > 0) {
      // The user already put something here: never overwrite it.
      await this.writeState({ ...state, seededSystemPrompt: true })
      return
    }
    let captured = []
    try {
      captured = await this.captureSystemPrompt()
    } catch {
      captured = []
    }
    if (captured.length === 0) {
      // Still materialize the built-in file so its path resolves, and stay
      // unseeded so a later panel open retries the capture.
      if (!file.exists) await this.writeSource(source, [])
      return
    }
    await this.writeSource(source, captured)
    await this.writeState({ ...state, seededSystemPrompt: true })
    this.refreshInjected()
  }

  /** Re-import DSH's current prompts, keeping the user's own entries. */
  async importSystemPrompt() {
    const source = await this.resolveSource(INTERNAL_SOURCE_ID)
    const file = await this.readSource(source)
    if (file.error) fail(`source "${source.id}" is broken: ${file.error}`)
    const captured = await this.captureSystemPrompt()
    const kept = file.prompts.filter((prompt) => prompt.origin !== PromptManagerService.SYSTEM_PROMPT_ORIGIN)
    await this.writeSource(source, [...captured, ...kept])
    const state = await this.readState()
    await this.writeState({ ...state, seededSystemPrompt: true })
    this.refreshInjected()
    return {
      imported: captured.length,
      kept: kept.length,
      sections: captured.map((prompt) => prompt.title),
    }
  }

  // -- Remote methods ----------------------------------------------------------

  /** Snapshot of every source with its prompts, for the management page. */
  async overview() {
    await this.ensureSystemPromptSeed()
    const sources = []
    const prompts = []
    for (const source of await this.listSources()) {
      const file = await this.readSource(source)
      sources.push({
        id: source.id,
        path: source.path,
        readonly: source.readonly,
        internal: source.internal,
        kind: source.kind,
        format: source.format,
        exists: file.exists,
        error: file.error ?? '',
        count: file.prompts.length,
      })
      for (const prompt of file.prompts) {
        prompts.push(PromptManagerService.decorate(source, prompt))
      }
    }
    return { sources, prompts, preamble: await this.effectivePreamble() }
  }

  /** Create one JSON prompt; `request.sourceId` omitted targets the internal file. */
  async create(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const title = asString(request.title, 'title', { max: 500 })
    const content = asString(request.content, 'content')
    const inject = asBoolean(request.inject, 'inject', false)
    const source = await this.resolveSource(asString(request.sourceId, 'sourceId', { optional: true }) ?? INTERNAL_SOURCE_ID)
    if (source.readonly) fail(`source "${source.id}" is read-only`)
    if (source.kind === 'text') fail(`"${source.path}" holds one prompt per file; edit it instead of adding a prompt`)
    const file = await this.readSource(source)
    if (file.error) fail(`source "${source.id}" is broken: ${file.error}`)
    const prompt = {
      id: randomUUID(),
      title,
      content,
      inject,
      updatedAt: new Date().toISOString(),
    }
    await this.writeSource(source, [...file.prompts, prompt])
    this.refreshInjected()
    return PromptManagerService.decorate(source, prompt)
  }

  /** Patch title/content/inject of one prompt identified by its key. */
  async update(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const { sourceId, promptId } = PromptManagerService.parseKey(request.key)
    const source = await this.resolveSource(sourceId)
    if (source.readonly) fail(`source "${source.id}" is read-only`)
    const file = await this.readSource(source)
    if (file.error) fail(`source "${source.id}" is broken: ${file.error}`)

    if (source.kind === 'text') {
      const current = file.prompts[0] ?? {
        id: TEXT_PROMPT_ID, title: deriveTitle('', source.path), content: '', inject: false, updatedAt: '',
      }
      const content = asString(request.content, 'content', { optional: true })
      const inject = asBoolean(request.inject, 'inject', current.inject)
      // Toggling injection must never touch the user's file: only a real
      // content change is written back (read-only archives stay untouched).
      if (content !== undefined && content !== current.content) {
        await this.writeSource(source, [{ ...current, content }])
      }
      if (inject !== current.inject) await this.setInjectFlag(source.path, inject)
      this.refreshInjected()
      const reread = await this.readSource(source)
      return PromptManagerService.decorate(source, { ...(reread.prompts[0] ?? current), inject })
    }

    const index = file.prompts.findIndex((p) => p.id === promptId)
    if (index < 0) fail(`prompt "${promptId}" not found in source "${sourceId}"`)
    const current = file.prompts[index]
    const next = {
      ...current,
      title: asString(request.title, 'title', { optional: true, max: 500 }) ?? current.title,
      content: asString(request.content, 'content', { optional: true }) ?? current.content,
      inject: asBoolean(request.inject, 'inject', current.inject),
      updatedAt: new Date().toISOString(),
    }
    const prompts = [...file.prompts]
    prompts[index] = next
    await this.writeSource(source, prompts)
    this.refreshInjected()
    return PromptManagerService.decorate(source, next)
  }

  /** Delete one JSON prompt identified by its key. */
  async delete(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const { sourceId, promptId } = PromptManagerService.parseKey(request.key)
    const source = await this.resolveSource(sourceId)
    if (source.readonly) fail(`source "${source.id}" is read-only`)
    if (source.kind === 'text') fail(`"${source.path}" holds one prompt per file; remove the source instead`)
    const file = await this.readSource(source)
    if (file.error) fail(`source "${source.id}" is broken: ${file.error}`)
    const prompts = file.prompts.filter((p) => p.id !== promptId)
    if (prompts.length === file.prompts.length) fail(`prompt "${promptId}" not found in source "${sourceId}"`)
    await this.writeSource(source, prompts)
    this.refreshInjected()
    return { removed: true }
  }

  /** Attach an external prompt file; persisted in the plugin state file. */
  async addSource(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const filePath = path.resolve(asString(request.path, 'path'))
    const extension = extensionOf(filePath)
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      fail(`unsupported file type "${extension || '(none)'}"; supported: ${SUPPORTED_EXTENSIONS.join(', ')}`)
    }
    const readonly = asBoolean(request.readonly, 'readonly', false)
    const state = await this.readState()
    const id = sourceIdForPath(filePath)
    const existing = (await this.listSources()).find((s) => s.id === id || s.path === filePath)
    if (existing) fail(`source already attached as "${existing.id}"`)
    state.sources.push({ id, path: filePath, readonly })
    await this.writeState(state)
    const source = { id, path: filePath, readonly, internal: false, kind: kindOfPath(filePath), format: formatOfPath(filePath) }
    const file = await this.readSource(source)
    this.refreshInjected()
    return {
      id,
      path: filePath,
      readonly,
      internal: false,
      kind: source.kind,
      format: source.format,
      exists: file.exists,
      error: file.error ?? '',
      count: file.prompts.length,
    }
  }

  /** Detach a user-added source. The file itself is left untouched. */
  async removeSource(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const id = asString(request.id, 'id')
    if (id === INTERNAL_SOURCE_ID) fail('the internal source cannot be removed')
    const state = await this.readState()
    const sources = state.sources.filter((s) => s.id !== id)
    if (sources.length === state.sources.length) {
      const fromConfig = this.configSources.some((s) => s && (s.id ?? sourceIdForPath(s.path ?? '')) === id)
      if (fromConfig) fail(`source "${id}" comes from the plugin config; remove it there`)
      fail(`source "${id}" not found`)
    }
    // Drop the injection flag of the detached text source: nothing else reads it.
    const detached = state.sources.find((s) => s.id === id)
    if (detached) delete state.inject[detached.path]
    await this.writeState({ sources, inject: state.inject })
    this.refreshInjected()
    return { removed: true }
  }

  /**
   * One directory level for the Add Source browser. Defaults to the home
   * directory and returns only supported prompt files.
   */
  async listDir(request) {
    const requested = request && typeof request.path === 'string' && request.path.trim() !== ''
      ? path.resolve(request.path)
      : os.homedir()
    const result = {
      path: requested,
      parent: path.dirname(requested) === requested ? '' : path.dirname(requested),
      directories: [],
      files: [],
      error: '',
    }
    let entries
    try {
      entries = await fsp.readdir(requested, { withFileTypes: true })
    } catch (error) {
      return { ...result, error: `cannot read directory: ${error.message}` }
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.isDirectory()) result.directories.push(entry.name)
      else if (entry.isFile() && SUPPORTED_EXTENSIONS.includes(extensionOf(entry.name))) result.files.push(entry.name)
    }
    result.directories.sort((a, b) => a.localeCompare(b))
    result.files.sort((a, b) => a.localeCompare(b))
    return result
  }

  // -- system prompt injection -------------------------------------------------

  /**
   * Recompute the injection text from every source. Mutations call this after
   * writing; the system-prompt section triggers a throttled refresh so manual
   * file edits propagate without a restart.
   */
  refreshInjected() {
    if (this.injectedRefresh) return this.injectedRefresh
    this.injectedRefresh = (async () => {
      const parts = []
      for (const source of await this.listSources()) {
        const file = await this.readSource(source)
        for (const prompt of file.prompts) {
          if (!prompt.inject) continue
          parts.push(`## ${prompt.title}\n\n${prompt.content}`)
        }
      }
      const state = await this.readState()
      const preamble = typeof state.preamble === 'string' ? state.preamble : DEFAULT_PREAMBLE
      this.injectedText = parts.length === 0 ? '' : (preamble === ''
        ? parts.join('\n')
        : [preamble, '', ...parts].join('\n'))
      this.injectedRefreshedAt = Date.now()
    })()
      .catch(() => {})
      .finally(() => {
        this.injectedRefresh = null
      })
    return this.injectedRefresh
  }

  /** Synchronous section text for the system-prompt assembly. */
  sectionText() {
    if (Date.now() - this.injectedRefreshedAt > 2000) this.refreshInjected()
    return this.injectedText
  }
}

markRemoteMethods(PromptManagerService.prototype, [
  'overview',
  'create',
  'update',
  'delete',
  'addSource',
  'removeSource',
  'listDir',
  'importSystemPrompt',
  'setPreamble',
])

export function apply(ctx, config) {
  const service = new PromptManagerService(ctx, config ?? {})
  ctx.effect(() => ctx.reflect.provide(SERVICE_KEY, service), 'prompt-manager: service')
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'prompt-manager',
    order: 90,
    text: () => service.sectionText(),
  }), 'prompt-manager: system prompt section')
  service.refreshInjected()
}
