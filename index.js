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

/** Optional agent-preset id; `''` is the global (preset-less) view. */
function asPresetId(value) {
  if (value === undefined || value === null || value === '') return ''
  return asString(value, 'preset', { max: 100 })
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

/**
 * Normalize the per-preset injection overrides kept in our state file:
 * `{ "<presetId>": { "<sourceId>/<promptId>": true | false } }`. Empty
 * preset maps and non-boolean values are dropped so a stale key never
 * resurrects a dead override.
 */
function cleanPresets(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const [preset, overrides] of Object.entries(value)) {
    if (preset === '' || !overrides || typeof overrides !== 'object' || Array.isArray(overrides)) continue
    const clean = {}
    for (const [key, inject] of Object.entries(overrides)) {
      if (key !== '' && typeof inject === 'boolean') clean[key] = inject
    }
    if (Object.keys(clean).length > 0) out[preset] = clean
  }
  return out
}

/**
 * Normalize the muted DSH section names kept in our state file:
 * `{ "<section name>": true }`. `false` entries are dropped because unmuting
 * a section is the same as never having muted it.
 */
function cleanMuted(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const [name, muted] of Object.entries(value)) {
    if (name !== '' && muted === true) out[name] = true
  }
  return out
}

/**
 * Normalize the manual ordering kept in our state file: a list of
 * `sourceId/promptId` keys. Duplicates and non-string entries are dropped.
 */
function cleanOrder(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const order = []
  for (const entry of value) {
    if (typeof entry !== 'string' || entry === '' || seen.has(entry)) continue
    seen.add(entry)
    order.push(entry)
  }
  return order
}

// -- translation --------------------------------------------------------------

/** Target language used until the user picks another one. */
const DEFAULT_TRANSLATION_LANGUAGE = 'zh-CN'

/** Languages offered by the panel; any other tag can still be typed by hand. */
const TRANSLATION_LANGUAGES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru']

const TRANSLATION_PROMPT = [
  'You translate one text into the target language listed below.',
  'Fidelity rules:',
  '1. Keep the document structure byte-for-byte comparable: same number of headings at the same levels,',
  '   same list items in the same order, same table rows and columns, same blockquote boundaries,',
  '   same fenced code block count and info strings, same blank-line separation.',
  '2. Never add, drop, merge or reorder sections, sentences or list items. Translate sentence by sentence.',
  '3. Leave code, commands, file paths, URLs, inline code, fenced code blocks, YAML/JSON keys,',
  '   front-matter keys, HTML tags, and placeholder tokens (such as {name}, ${var}, %s, {{name}}) unchanged.',
  '4. Keep numbers, units, dates, version strings and punctuation style of the source where possible.',
  '5. Translate terminology consistently: a technical term keeps one rendering across the whole text;',
  '   product names and acronyms stay in their original form unless a well-established translation exists.',
  '6. Preserve markdown emphasis markers, links (translate link text, never the URL) and alignment/table pipes.',
  '7. Output only the translated document. No preamble, commentary, quotes, or wrapping code fence.',
].join(' ')

/** Normalize `state.translation`: target language plus optional model route. */
function normalizeTranslation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { targetLanguage: DEFAULT_TRANSLATION_LANGUAGE, provider: '', model: '' }
  }
  const targetLanguage = typeof value.targetLanguage === 'string' && value.targetLanguage.trim() !== ''
    ? value.targetLanguage.trim().slice(0, 40)
    : DEFAULT_TRANSLATION_LANGUAGE
  const provider = typeof value.provider === 'string' ? value.provider.trim().slice(0, 80) : ''
  const model = typeof value.model === 'string' ? value.model.trim().slice(0, 120) : ''
  return { targetLanguage, provider, model }
}

/**
 * Normalize `state.translations`: `{ "<sourceId>/<promptId>": { lang, text,
 * updatedAt } }`. Entries without text are dropped.
 */
function cleanTranslations(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const [key, entry] of Object.entries(value)) {
    if (key === '' || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    if (typeof entry.text !== 'string' || entry.text === '') continue
    out[key] = {
      lang: typeof entry.lang === 'string' ? entry.lang : '',
      text: entry.text,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
      ...(Array.isArray(entry.warnings) && entry.warnings.length > 0
        ? { warnings: entry.warnings.filter((line) => typeof line === 'string').slice(0, 8) }
        : {}),
    }
  }
  return out
}

/** Normalize `state.injectTranslations`: keys whose injection uses the translation. */
function cleanInjectTranslations(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const [key, enabled] of Object.entries(value)) {
    if (key === '' || typeof enabled !== 'boolean' || enabled !== true) continue
    out[key] = true
  }
  return out
}

/** Count the structural markers a faithful translation must preserve. */
function markdownShape(text) {
  const source = typeof text === 'string' ? text : ''
  return {
    fences: (source.match(/^```/gm) ?? []).length,
    headings: (source.match(/^#{1,6}\s+/gm) ?? []).length,
    tables: (source.match(/^\s*\|.*\|\s*$/gm) ?? []).length,
  }
}

/** Compare source and translation structure; empty when they still match. */
function shapeWarnings(source, translation) {
  const before = markdownShape(source)
  const after = markdownShape(translation)
  const warnings = []
  if (before.fences !== after.fences) warnings.push(`code fences ${before.fences} -> ${after.fences}`)
  if (before.headings !== after.headings) warnings.push(`headings ${before.headings} -> ${after.headings}`)
  if (before.tables !== after.tables) warnings.push(`table rows ${before.tables} -> ${after.tables}`)
  return warnings
}

/** Coarse script-based language guess, enough to skip same-language text. */
function detectLanguage(text) {
  const sample = typeof text === 'string' ? text.slice(0, 4000) : ''
  if (sample === '') return ''
  let cjk = 0
  let kana = 0
  let hangul = 0
  let cyrillic = 0
  let latin = 0
  for (const ch of sample) {
    const code = ch.codePointAt(0)
    if (code >= 0x4e00 && code <= 0x9fff) cjk += 1
    else if (code >= 0x3040 && code <= 0x30ff) kana += 1
    else if (code >= 0xac00 && code <= 0xd7af) hangul += 1
    else if (code >= 0x0400 && code <= 0x04ff) cyrillic += 1
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) latin += 1
  }
  if (kana > 0) return 'ja'
  if (hangul > 0) return 'ko'
  if (cjk > latin * 0.2) return 'zh'
  if (cyrillic > latin * 0.2) return 'ru'
  if (latin > 0) return 'en'
  return ''
}

/** Whether two BCP-47-ish tags share their primary subtag. */
function sameLanguage(left, right) {
  const head = (tag) => String(tag || '').toLowerCase().split('-')[0]
  return head(left) !== '' && head(left) === head(right)
}

// -- plugin attribution -------------------------------------------------------

/**
 * Section names of DSH's own (first-party) prompt segments. The assembly API
 * does not expose a section's owner, so attribution relies on DSH's naming
 * convention `<plugin>:<section>` plus these known first-party names.
 */
const BUILTIN_SECTION_NAMES = new Set([
  'HARNESS_IDENTITY',
  'DEPLOYMENT_PERSONA_PREFIX',
  'DEPLOYMENT_PERSONA_SUFFIX',
])
const BUILTIN_SECTION_PREFIXES = new Set(['harness', 'deployment', 'app', 'ui'])
/** Our own section, which wraps every managed prompt: never import it. */
const SELF_SECTION_NAME = 'prompt-manager'
/** Plugin id used for DSH's own first-party sections. */
const BUILTIN_PLUGIN_ID = 'dsh'

/**
 * Config keys that carry human-readable prompt text inside a preset's plugin
 * rows. `agentPresets.readDocument()` renders the declaration as YAML; these
 * are the keys worth showing (a row's `maxBytes` or `disabled` is not text).
 */
const PRESET_TEXT_KEYS = new Set([
  'prefix',
  'suffix',
  'section',
  'prompt',
  'instructions',
  'content',
  'text',
  'rules',
  'template',
  'message',
])

/** Strip the quoting YAML adds around a scalar without inventing escapes. */
function unquoteYamlScalar(value) {
  const trimmed = String(value ?? '').trim()
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

/**
 * Pull the prompt-bearing plugin rows out of one preset declaration's YAML.
 * The document is generated by the registry (`dump` with `lineWidth: -1`), so
 * the shape is predictable: `- id/name` rows, `config:` below them, and block
 * scalars for multi-line text. A hand-written parser keeps this plugin free of
 * a YAML dependency of its own.
 */
function parsePresetEntries(text) {
  if (typeof text !== 'string' || text === '') return []
  const entries = []
  let current = null
  let block = null
  const flushBlock = () => {
    if (block && current && block.lines.length > 0) {
      const value = block.lines.join('\n').replace(/\s+$/, '')
      if (value !== '' && PRESET_TEXT_KEYS.has(block.key)) current.texts.push({ key: block.key, value })
    }
    block = null
  }
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\t/g, '    ')
    const trimmed = line.trim()
    const indent = line.length - line.trimStart().length
    if (block) {
      if (trimmed === '' || indent > block.indent) {
        block.lines.push(trimmed === '' ? '' : line.slice(block.indent + 2))
        continue
      }
      flushBlock()
    }
    if (trimmed === '') continue
    if (trimmed.startsWith('- ')) {
      flushBlock()
      current = { entryId: '', moduleName: '', texts: [] }
      entries.push(current)
      const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(trimmed.slice(2))
      if (match) {
        if (match[1] === 'id') current.entryId = unquoteYamlScalar(match[2])
        else if (match[1] === 'name') current.moduleName = unquoteYamlScalar(match[2])
      }
      continue
    }
    if (!current) continue
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(trimmed)
    if (!match) continue
    const key = match[1]
    const rest = match[2]
    if (rest === '|' || rest === '|-' || rest === '|+' || rest === '>' || rest === '>-' || rest === '>+') {
      block = { key, indent, lines: [] }
      continue
    }
    if (indent <= 2 && key === 'id') current.entryId = unquoteYamlScalar(rest)
    else if (indent <= 2 && key === 'name') current.moduleName = unquoteYamlScalar(rest)
    else if (indent >= 4 && PRESET_TEXT_KEYS.has(key) && rest !== '') {
      current.texts.push({ key, value: unquoteYamlScalar(rest) })
    }
  }
  flushBlock()
  return entries.filter((entry) => entry.texts.length > 0)
}

/**
 * Attribute one assembled section to the plugin that registered it.
 * Returns `null` for this plugin's own section (importing it would duplicate
 * every managed prompt inside the managed prompt list).
 */
function sectionOrigin(name) {
  if (name === SELF_SECTION_NAME) return null
  const colon = name.indexOf(':')
  if (colon > 0) {
    const prefix = name.slice(0, colon)
    const section = name.slice(colon + 1)
    if (BUILTIN_SECTION_PREFIXES.has(prefix)) {
      return { plugin: BUILTIN_PLUGIN_ID, pluginLabel: 'DSH', section, builtin: true }
    }
    return { plugin: prefix, pluginLabel: prefix, section, builtin: false }
  }
  if (BUILTIN_SECTION_NAMES.has(name)) {
    return { plugin: BUILTIN_PLUGIN_ID, pluginLabel: 'DSH', section: name, builtin: true }
  }
  // A bare lower-case section name is a plugin that named its section after
  // itself (for example `jaz-mode`).
  return { plugin: name, pluginLabel: name, section: name, builtin: false }
}

/**
 * Resolve a stored imported prompt's plugin attribution. Files written before
 * plugin attribution existed only carry `id` / `origin`, so the section name is
 * recovered from `id` (`dsh-<section name>`) and parsed again.
 */
function promptOrigin(prompt) {
  if (!prompt || prompt.origin !== PromptManagerService.SYSTEM_PROMPT_ORIGIN) return null
  if (typeof prompt.plugin === 'string' && prompt.plugin !== '') {
    const label = typeof prompt.pluginLabel === 'string' && prompt.pluginLabel !== ''
      ? prompt.pluginLabel
      : prompt.plugin
    return {
      plugin: prompt.plugin,
      pluginLabel: label,
      section: typeof prompt.sectionName === 'string' ? prompt.sectionName : '',
      builtin: prompt.builtin === true || prompt.plugin === BUILTIN_PLUGIN_ID,
    }
  }
  const name = typeof prompt.sectionName === 'string' && prompt.sectionName !== ''
    ? prompt.sectionName
    : (typeof prompt.id === 'string' && prompt.id.startsWith('dsh-') ? prompt.id.slice(4) : '')
  if (name === '') return null
  const origin = sectionOrigin(name)
  return origin ? { ...origin, section: name } : null
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
    /**
     * Injection text per agent preset ('' = no preset / plain agents).
     * `sectionText(context)` looks the caller's preset up here.
     */
    this.presetTexts = new Map()
    /**
     * Last raw assembly seen per agent preset ('' = no preset). Each entry is
     * `{ at, sections: [{ name, text, order, plugin, builtin }] }` captured
     * before our own section is added, so the panel can show the prompt each
     * preset actually composes — including sections registered inside the
     * preset scope that `assemble({})` from the host can never see.
     */
    this.presetViews = new Map()
    this.managedCache = null
    this.injectedRefresh = null
    this.injectedRefreshedAt = 0
    /** Structural binding the Gateway uses for source-mode discovery. */
    this.typertRemote = Object.freeze({
      service: this,
      serviceKey: SERVICE_KEY,
      namespace: SERVICE_KEY,
    })
  }

  // -- agent presets ---------------------------------------------------------

  /** The DSH preset registry, when this profile runs one (headless has none). */
  agentPresetRegistry() {
    try {
      return this.ctx?.get?.('agentPresets') ?? null
    } catch {
      return null
    }
  }

  /** Every DSH agent preset as a small plain row for the management page. */
  async listPresets() {
    const registry = this.agentPresetRegistry()
    if (!registry || typeof registry.list !== 'function') return []
    try {
      const rows = await registry.list()
      if (!Array.isArray(rows)) return []
      const defaults = new Set()
      if (typeof registry.remoteExportList === 'function') {
        const exported = await registry.remoteExportList().catch(() => null)
        for (const row of exported?.presets ?? []) {
          if (row && row.isDefault === true && typeof row.id === 'string') defaults.add(row.id)
        }
      }
      return rows
        .filter((row) => row && typeof row.id === 'string' && row.id !== '')
        .map((row) => ({
          id: row.id,
          name: typeof row.name === 'string' ? row.name : '',
          description: typeof row.description === 'string' ? row.description : '',
          order: typeof row.order === 'number' ? row.order : 0,
          broken: row.broken === true,
          default: defaults.has(row.id),
        }))
    } catch {
      return []
    }
  }

  /**
   * Prompt-bearing rows each preset declares, read from the registry itself.
   * `readDocument()` renders one declaration's plugin list as YAML, so this
   * works without an Agent ever running under the preset — unlike the
   * per-request `presetViews` snapshot.
   */
  async presetDefinitions() {
    const registry = this.agentPresetRegistry()
    if (!registry || typeof registry.readDocument !== 'function') return []
    let rows = []
    try {
      rows = await this.listPresets()
    } catch {
      return []
    }
    const out = []
    for (const row of rows) {
      let document = ''
      try {
        const read = await registry.readDocument(row.id)
        if (typeof read?.content === 'string') document = read.content
      } catch {
        document = ''
      }
      out.push({
        preset: row.id,
        presetName: row.name || row.id,
        entries: parsePresetEntries(document),
        document,
      })
    }
    return out
  }

  /** Preset bound to the agent that asked for a system prompt, `''` when none. */
  presetIdFor(context) {
    const registry = this.agentPresetRegistry()
    const agentCtx = context?.agent?.ctx
    if (!registry || typeof registry.composedPreset !== 'function' || !agentCtx) return ''
    try {
      const id = registry.composedPreset(agentCtx)
      return typeof id === 'string' ? id : ''
    } catch {
      return ''
    }
  }

  /** Injection value of one prompt under one preset view. */
  static effectiveInject(prompt, key, presetId, presets) {
    const overrides = presetId ? presets[presetId] : undefined
    if (overrides && typeof overrides[key] === 'boolean') return overrides[key]
    return prompt.inject === true
  }

  /** True for sections that still belong to a third-party plugin. */
  static isShowcaseOnly(prompt) {
    return prompt.origin === PromptManagerService.SYSTEM_PROMPT_ORIGIN && prompt.builtin !== true
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
      const titles = data?.titles && typeof data.titles === 'object' && !Array.isArray(data.titles)
        ? data.titles
        : {}
      return {
        seededSystemPrompt,
        preamble,
        enabled: data?.enabled !== false,
        presets: cleanPresets(data?.presets),
        translation: normalizeTranslation(data?.translation),
        translations: cleanTranslations(data?.translations),
        injectTranslations: cleanInjectTranslations(data?.injectTranslations),
        muted: cleanMuted(data?.muted),
        order: cleanOrder(data?.order),
        sectionFlagsMigrated: data?.sectionFlagsMigrated === true,
        titles: Object.fromEntries(
          Object.entries(titles).filter(([, value]) => typeof value === 'string' && value !== ''),
        ),
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
      return {
        sources: [],
        inject: {},
        titles: {},
        presets: {},
        muted: {},
        order: [],
        sectionFlagsMigrated: false,
        enabled: true,
        translation: normalizeTranslation(null),
        translations: {},
        injectTranslations: {},
        seededSystemPrompt: false,
        preamble: null,
      }
    }
  }

  async writeState(state) {
    await fsp.mkdir(this.dir, { recursive: true })
    const titles = state.titles && typeof state.titles === 'object' ? state.titles : {}
    const cleanTitles = Object.fromEntries(
      Object.entries(titles).filter(([, value]) => typeof value === 'string' && value !== ''),
    )
    const presets = cleanPresets(state.presets)
    const translations = cleanTranslations(state.translations)
    const injectTranslations = cleanInjectTranslations(state.injectTranslations)
    const muted = cleanMuted(state.muted)
    const order = cleanOrder(state.order)
    const translation = normalizeTranslation(state.translation)
    const translationStored = translation.targetLanguage !== DEFAULT_TRANSLATION_LANGUAGE
      || translation.provider !== ''
      || translation.model !== ''
    await this.writeJsonAtomic(this.stateFile, {
      version: STATE_VERSION,
      sources: state.sources,
      inject: state.inject ?? {},
      seededSystemPrompt: state.seededSystemPrompt === true,
      ...(state.enabled === false ? { enabled: false } : {}),
      ...(typeof state.preamble === 'string' ? { preamble: state.preamble } : {}),
      ...(Object.keys(cleanTitles).length > 0 ? { titles: cleanTitles } : {}),
      ...(Object.keys(presets).length > 0 ? { presets } : {}),
      ...(translationStored ? { translation } : {}),
      ...(Object.keys(translations).length > 0 ? { translations } : {}),
      ...(Object.keys(injectTranslations).length > 0 ? { injectTranslations } : {}),
      ...(Object.keys(muted).length > 0 ? { muted } : {}),
      ...(order.length > 0 ? { order } : {}),
      ...(state.sectionFlagsMigrated === true ? { sectionFlagsMigrated: true } : {}),
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
      const state = await this.readState()
      const defaultTitle = deriveTitle(raw, source.path)
      const override = state.titles[source.id]
      const title = typeof override === 'string' && override !== '' ? override : defaultTitle
      return {
        exists: true,
        prompts: [{
          id: TEXT_PROMPT_ID,
          title,
          defaultTitle,
          titleCustom: typeof override === 'string' && override !== '',
          content: raw.endsWith('\n') ? raw.slice(0, -1) : raw,
          // The injection flag lives in our own state: toggling it never
          // rewrites the user's file.
          inject: state.inject[source.path] === true,
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
            ...p,
            content: typeof p.content === 'string' ? p.content : '',
            inject: p.inject === true,
            updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : '',
            origin: typeof p.origin === 'string' ? p.origin : '',
            titleCustom: p.titleCustom === true,
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
    const origin = promptOrigin(prompt)
    return {
      key: PromptManagerService.keyOf(source.id, prompt.id),
      sourceId: source.id,
      sourcePath: source.path,
      readonly: source.readonly,
      kind: source.kind,
      format: source.format,
      // Text sources rewrite their file on save, but their displayed title is
      // an override kept in our state file, so it is editable as well.
      editableTitle: source.readonly !== true,
      deletable: source.kind === 'json',
      ...prompt,
      ...(origin ? {
        plugin: origin.plugin,
        pluginLabel: origin.pluginLabel,
        sectionName: origin.section,
        builtin: origin.builtin,
      } : {}),
      // DSH sections are injected by the plugin that registered them. This
      // panel only shows and translates them, so their own switch never
      // applies here.
      injectable: prompt.origin !== PromptManagerService.SYSTEM_PROMPT_ORIGIN,
      titleCustom: prompt.titleCustom === true,
    }
  }

  /**
   * Group imported prompts by the plugin that registered their section, so the
   * page can show one row per plugin instead of one anonymous DSH block.
   */
  static summarizePlugins(prompts) {
    const groups = new Map()
    for (const prompt of prompts) {
      if (!prompt.plugin) continue
      let group = groups.get(prompt.plugin)
      if (!group) {
        group = {
          id: prompt.plugin,
          label: prompt.pluginLabel ?? prompt.plugin,
          builtin: prompt.builtin === true,
          count: 0,
          injected: 0,
        }
        groups.set(prompt.plugin, group)
      }
      group.count += 1
      if (prompt.inject) group.injected += 1
    }
    // DSH's own first-party sections come last; everything else alphabetically.
    return [...groups.values()].sort((a, b) => {
      if (a.builtin !== b.builtin) return a.builtin ? 1 : -1
      return a.label.localeCompare(b.label)
    })
  }

  /**
   * Apply the user's manual order to `[{ key, ... }]` entries. Keys that were
   * never reordered keep their original position at the end, so adding a
   * prompt never disturbs the list the user already arranged.
   */
  static sortByOrder(entries, order) {
    if (!Array.isArray(order) || order.length === 0) return entries
    const rank = new Map()
    order.forEach((key, index) => {
      if (!rank.has(key)) rank.set(key, index)
    })
    return entries
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => {
        const a = rank.has(left.entry.key) ? rank.get(left.entry.key) : Number.MAX_SAFE_INTEGER
        const b = rank.has(right.entry.key) ? rank.get(right.entry.key) : Number.MAX_SAFE_INTEGER
        return a === b ? left.index - right.index : a - b
      })
      .map((item) => item.entry)
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

  /**
   * Turn this plugin's system-prompt injection on or off. Management keeps
   * working while injection is off; the section simply renders nothing.
   */
  async setEnabled(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const state = await this.readState()
    state.enabled = request.enabled !== false
    await this.writeState(state)
    await this.refreshInjected()
    // Force the next assembly to recompute even if a stale refresh was reused.
    this.injectedRefreshedAt = 0
    return { enabled: state.enabled }
  }

  /**
   * Muted DSH section names, cached for the assembly waterfall. The set only
   * changes from the panel, so a two-second cache keeps a filesystem read off
   * the per-request path.
   */
  /**
   * Names of first-party Harness sections that prompt-manager owns: their
   * registration stays with the original plugin, but this plugin takes over
   * the actual injection so one switch and one order govern every managed
   * prompt. Third-party sections are never touched.
   */
  async managedSectionNames() {
    const now = Date.now()
    if (this.managedCache && now - this.managedCache.at < 2000) return this.managedCache.set
    const names = new Set()
    for (const source of await this.listSources()) {
      const file = await this.readSource(source)
      for (const prompt of file.prompts) {
        if (prompt.origin !== PromptManagerService.SYSTEM_PROMPT_ORIGIN || prompt.builtin !== true) continue
        const name = typeof prompt.sectionName === 'string' && prompt.sectionName !== ''
          ? prompt.sectionName
          : (promptOrigin(prompt)?.section ?? '')
        if (name !== '') names.add(name)
      }
    }
    this.managedCache = { at: now, set: names }
    return names
  }

  /**
   * Drop every first-party section from the assembled prompt: prompt-manager
   * re-adds the enabled ones through its own `systemPrompt.section`, so
   * enabling/disabling and ordering work exactly like local prompts.
   *
   * The raw sections are snapshotted first, keyed by the caller's agent
   * preset: only assemblies that run inside a preset scope contain that
   * preset's own sections (its persona, plan-mode text, ...), and this is the
   * one place where they are visible to the host.
   */
  async filterAssembly(assembly, context) {
    if (!assembly || !Array.isArray(assembly.sections)) return assembly
    try {
      this.capturePresetView(assembly, context)
    } catch {
      // A broken diagnostic must never break prompt assembly.
    }
    if (assembly.sections.length === 0) return assembly
    const managed = await this.managedSectionNames()
    if (managed.size === 0) return assembly
    return { ...assembly, sections: assembly.sections.filter((section) => !managed.has(section.name)) }
  }

  /**
   * Remember the raw prompt sections one preset's agent actually assembled.
   * The host context cannot ask for them directly: preset plugins register
   * their sections in the agent scope, so only this per-request waterfall
   * sees them.
   */
  capturePresetView(assembly, context) {
    const agentCtx = context?.agent?.ctx
    let presetId = ''
    try {
      const registry = agentCtx ? agentCtx.get?.('agentPresets') : null
      const composed = registry?.composedPreset?.(agentCtx)
      if (typeof composed === 'string') presetId = composed
    } catch {
      presetId = ''
    }
    const sections = []
    for (const section of assembly.sections) {
      if (!section || typeof section.name !== 'string' || typeof section.text !== 'string') continue
      const origin = sectionOrigin(section.name)
      if (origin === null) continue
      sections.push({
        name: section.name,
        text: section.text,
        order: this.sectionOrder(section.name),
        plugin: origin.plugin,
        pluginLabel: origin.pluginLabel,
        builtin: origin.builtin,
      })
    }
    this.presetViews.set(presetId, { at: Date.now(), sections })
  }

  /**
   * Convert the old mute list into the shared `inject` flag. Before this
   * release first-party sections were always captured with `inject: false`
   * and muted through `state.muted`; afterwards both kinds of prompts use the
   * same switch, so an unmuted section must start enabled.
   */
  async migrateSectionFlags() {
    const state = await this.readState()
    if (state.sectionFlagsMigrated) return
    const source = await this.resolveSource(INTERNAL_SOURCE_ID)
    const file = await this.readSource(source)
    if (file.error) return
    const muted = state.muted ?? {}
    let changed = false
    const prompts = file.prompts.map((prompt) => {
      if (prompt.origin !== PromptManagerService.SYSTEM_PROMPT_ORIGIN || prompt.builtin !== true) return prompt
      const name = typeof prompt.sectionName === 'string' && prompt.sectionName !== ''
        ? prompt.sectionName
        : (promptOrigin(prompt)?.section ?? '')
      const inject = name !== '' && muted[name] === true ? false : true
      if (prompt.inject === inject) return prompt
      changed = true
      return { ...prompt, inject }
    })
    if (changed) await this.writeSource(source, prompts)
    const next = { ...state, sectionFlagsMigrated: true }
    delete next.muted
    await this.writeState(next)
    this.managedCache = null
  }

  // -- translation -----------------------------------------------------------

  /** The profile's LLM runtime, when this profile runs one. */
  llmService() {
    try {
      return this.ctx?.get?.('llm') ?? null
    } catch {
      return null
    }
  }

  /** Provider row used for translation: the configured one, else the first. */
  pickLlmProvider(llm, preferred) {
    const providers = typeof llm?.listProviders === 'function' ? llm.listProviders() : []
    if (!Array.isArray(providers)) return null
    const usable = providers.filter((provider) => provider && typeof provider.id === 'string'
      && provider.id !== '' && provider.id !== 'lingshu-whitebox')
    if (preferred !== '') {
      const wanted = usable.find((provider) => provider.id === preferred)
      if (wanted) return wanted
    }
    return usable[0] ?? null
  }

  /**
   * Resolve the model id for one translation call. A configured model wins;
   * otherwise ask the adapter for its catalog (provider metadata from
   * `listProviders()` carries no model) and fall back to its first entry.
   */
  async pickLlmModel(llm, provider, preferred) {
    const wanted = typeof preferred === 'string' ? preferred.trim() : ''
    if (wanted !== '') return wanted
    if (typeof provider?.model === 'string' && provider.model !== '') return provider.model
    try {
      const models = await llm?.listModels?.(provider.id)
      if (Array.isArray(models)) {
        const first = models.find((entry) => entry && typeof (entry.id ?? entry.model) === 'string')
        if (first) return first.id ?? first.model
      }
    } catch {
      // The adapter may not expose a catalog; the caller reports the miss.
    }
    return ''
  }

  /** Run one translation call and return the plain translated text. */
  async runTranslation(llm, provider, model, content, targetLanguage) {
    const messages = [
      {
        role: 'system',
        content: [{
          type: 'text',
          text: `${TRANSLATION_PROMPT}\n\nTarget language: ${targetLanguage}`,
        }],
      },
      { role: 'user', content: [{ type: 'text', text: content }] },
    ]
    let text = ''
    try {
      const stream = llm.stream({
        provider: provider.id,
        model,
        messages,
        maxTokens: Math.min(16_000, Math.max(1024, Math.ceil(content.length * 1.4))),
      })
      // `llm.stream()` runs the `llm/stream` waterfall, so it may hand back a
      // promise that resolves to the chunk stream.
      const chunks = typeof stream?.[Symbol.asyncIterator] === 'function' ? stream : await stream
      for await (const chunk of chunks) {
        // Adapter failures arrive as a terminal `finish` chunk instead of a
        // throw; surfacing them here is what turns "no text returned" into the
        // real provider error.
        if (chunk?.type === 'finish') {
          const reason = chunk.reason
          if (reason?.kind === 'error') {
            const failure = reason.failure ?? {}
            const code = typeof failure.code === 'string' && failure.code !== '' ? `[${failure.code}] ` : ''
            throw new Error(`${code}${failure.message ?? 'adapter error'}`)
          }
          if (reason?.kind === 'aborted') throw new Error('[ABORTED] translation call aborted')
        }
        if (typeof chunk?.text === 'string' && chunk.type !== 'reasoning-delta') text += chunk.text
      }
    } catch (error) {
      const message = error?.message ?? String(error)
      const code = error && typeof error.code === 'string' && !message.startsWith('[') ? `[${error.code}] ` : ''
      fail(`translation call failed: ${code}${message}`)
    }
    const translated = text.trim()
    if (translated === '') fail('translation call returned no text')
    return translated
  }

  /**
   * Translate one prompt into the target language and remember the result
   * beside our state; the source file itself is never touched.
   */
  async translatePrompt(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const key = asString(request.key, 'key')
    const { sourceId, promptId } = PromptManagerService.parseKey(key)
    const source = await this.resolveSource(sourceId)
    const file = await this.readSource(source)
    if (file.error) fail(`source "${source.id}" is broken: ${file.error}`)
    const prompt = file.prompts.find((entry) => entry.id === promptId)
    if (!prompt) fail(`prompt "${key}" not found`)
    const state = await this.readState()
    const targetLanguage = typeof request.language === 'string' && request.language.trim() !== ''
      ? request.language.trim().slice(0, 40)
      : state.translation.targetLanguage
    const sourceLanguage = detectLanguage(prompt.content)
    if (sameLanguage(sourceLanguage, targetLanguage)) {
      return { skipped: true, sourceLanguage, targetLanguage, lang: '', text: '', updatedAt: '' }
    }
    const llm = this.llmService()
    const provider = this.pickLlmProvider(llm, state.translation.provider)
    if (!llm || !provider) fail('LLM service is not available in this profile')
    const model = await this.pickLlmModel(llm, provider, state.translation.model)
    if (model === '') fail('no model available for translation; set one in translation settings')
    let text = ''
    try {
      text = await this.runTranslation(llm, provider, model, prompt.content, targetLanguage)
    } catch (error) {
      await this.recordTranslateError(error)
      throw error
    }
    const warnings = shapeWarnings(prompt.content, text)
    const entry = {
      lang: targetLanguage,
      text,
      updatedAt: new Date().toISOString(),
      ...(warnings.length > 0 ? { warnings } : {}),
    }
    await this.writeState({ ...state, translations: { ...state.translations, [key]: entry } })
    return { ...entry, skipped: false, sourceLanguage, targetLanguage }
  }

  /** Best-effort record of the last translation failure, for local diagnosis. */
  async recordTranslateError(error) {
    try {
      await this.writeJsonAtomic(path.join(this.dir, 'last-translate-error.json'), {
        at: new Date().toISOString(),
        message: error?.message ?? String(error),
        code: typeof error?.code === 'string' ? error.code : null,
        stack: typeof error?.stack === 'string' ? error.stack : null,
      })
    } catch {
      // Diagnostics must never mask the original failure.
    }
  }

  /** Forget one stored translation. */
  async clearTranslation(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const key = asString(request.key, 'key')
    const state = await this.readState()
    if (!state.translations[key]) return { removed: false }
    delete state.translations[key]
    const injectTranslations = { ...state.injectTranslations }
    delete injectTranslations[key]
    await this.writeState({ ...state, translations: state.translations, injectTranslations })
    await this.refreshInjected()
    return { removed: true }
  }

  /**
   * Choose whether one prompt injects its stored translation instead of the
   * source text. Needs a translation; turning it off falls back to the source.
   */
  async setInjectTranslation(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const key = asString(request.key, 'key', { max: 500 })
    const enabled = asBoolean(request.enabled, 'enabled', false)
    const { sourceId, promptId } = PromptManagerService.parseKey(key)
    const source = await this.resolveSource(sourceId)
    const file = await this.readSource(source)
    if (file.error) fail(`source "${source.id}" is broken: ${file.error}`)
    if (!file.prompts.some((entry) => entry.id === promptId)) fail(`prompt "${key}" not found`)
    const state = await this.readState()
    if (enabled && !state.translations[key]) fail('translate this prompt before injecting its translation')
    if (enabled === (state.injectTranslations[key] === true)) return { injectTranslation: enabled }
    const injectTranslations = { ...state.injectTranslations }
    if (enabled) injectTranslations[key] = true
    else delete injectTranslations[key]
    await this.writeState({ ...state, injectTranslations })
    await this.refreshInjected()
    return { injectTranslation: enabled }
  }

  /** Change the target language and/or the model route used for translation. */
  async setTranslationSettings(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const state = await this.readState()
    const next = { ...state.translation }
    if (request.targetLanguage !== undefined) {
      next.targetLanguage = asString(request.targetLanguage, 'targetLanguage', { max: 40 }).trim()
        || DEFAULT_TRANSLATION_LANGUAGE
    }
    if (request.provider !== undefined) {
      next.provider = asString(request.provider, 'provider', { max: 80, optional: true }) ?? ''
    }
    if (request.model !== undefined) {
      next.model = asString(request.model, 'model', { max: 120, optional: true }) ?? ''
    }
    const translation = normalizeTranslation(next)
    await this.writeState({ ...state, translation })
    return { translation }
  }

  // -- DSH's own prompts -------------------------------------------------------

  /** Marker stored on prompts imported from the assembled system prompt. */
  static get SYSTEM_PROMPT_ORIGIN() {
    return 'dsh-system-prompt'
  }

  /**
   * Registered order of one system-prompt section, or null when the registry
   * cannot answer (other profile, plugin uninstalled, older Host).
   */
  sectionOrder(name) {
    if (typeof name !== 'string' || name === '') return null
    try {
      const order = this.ctx?.systemPrompt?.getSectionOrder?.(name)
      return typeof order === 'number' && Number.isFinite(order) ? order : null
    } catch {
      return null
    }
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
      .map((section) => {
        const origin = sectionOrigin(section.name)
        // Skip our own section: it wraps every managed prompt, so importing it
        // would nest the managed library inside itself.
        if (!origin) return null
        const title = `DSH · ${section.name}`
        return {
          id: `dsh-${section.name}`,
          title,
          defaultTitle: title,
          content: section.text,
          inject: true,
          origin: PromptManagerService.SYSTEM_PROMPT_ORIGIN,
          plugin: origin.plugin,
          pluginLabel: origin.pluginLabel,
          sectionName: section.name,
          // The assembly result carries no order, but the registry can tell us
          // where the section sits; that is the "injection condition" shown to
          // the user for sections we never inject ourselves.
          sectionOrder: this.sectionOrder(section.name),
          builtin: origin.builtin,
          titleCustom: false,
          updatedAt: now,
        }
      })
      .filter(Boolean)
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
    const previous = new Map(file.prompts.map((prompt) => [prompt.id, prompt]))
    const merged = captured.map((fresh) => {
      const old = previous.get(fresh.id)
      if (!old) return fresh
      // Re-importing refreshes the snapshot but must not discard the one
      // choice the user made on it: a custom title.
      const keepCustomTitle = old.titleCustom === true
      return {
        ...fresh,
        title: keepCustomTitle ? old.title : fresh.title,
        titleCustom: keepCustomTitle,
        // First-party sections follow the shared inject switch now, so a
        // re-import must preserve the user's choice rather than reset it.
        inject: typeof old.inject === 'boolean' ? old.inject : fresh.inject,
      }
    })
    const kept = file.prompts.filter((prompt) => prompt.origin !== PromptManagerService.SYSTEM_PROMPT_ORIGIN)
    await this.writeSource(source, [...merged, ...kept])
    const state = await this.readState()
    await this.writeState({ ...state, seededSystemPrompt: true })
    this.refreshInjected()
    return {
      imported: merged.length,
      kept: kept.length,
      sections: merged.map((prompt) => prompt.title),
    }
  }

  /**
   * Sections registered by a plugin inject themselves. This panel only shows,
   * translates and explains them, so there is nothing to toggle here. The
   * method stays a Remote endpoint for older client pages.
   */
  /**
   * Persist the manual order of every known prompt. `keys` may be a partial
   * list: unknown or duplicated keys are dropped, and prompts missing from it
   * simply keep their file order at the end.
   */
  async reorder(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    if (!Array.isArray(request.keys)) fail('keys must be an array')
    const known = new Set()
    for (const source of await this.listSources()) {
      const file = await this.readSource(source)
      for (const prompt of file.prompts) {
        known.add(PromptManagerService.keyOf(source.id, prompt.id))
      }
    }
    const order = cleanOrder(request.keys).filter((key) => known.has(key))
    const state = await this.readState()
    await this.writeState({ ...state, order })
    await this.refreshInjected()
    return { order }
  }

  async setPluginInject(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    return { changed: 0 }
  }

  /**
   * Override one prompt's injection flag for one agent preset. `inject` null
   * drops the override so the prompt inherits the global flag again.
   */
  async setPresetInject(request) {
    if (!request || typeof request !== 'object') fail('request must be an object')
    const presetId = asString(request.preset, 'preset', { max: 100 })
    const key = asString(request.key, 'key', { max: 500 })
    const inject = asBoolean(request.inject, 'inject', undefined)
    const { sourceId, promptId } = PromptManagerService.parseKey(key)
    const source = await this.resolveSource(sourceId)
    const file = await this.readSource(source)
    if (file.error) fail(`source "${source.id}" is broken: ${file.error}`)
    const prompt = file.prompts.find((entry) => entry.id === promptId)
    if (!prompt) fail(`prompt "${promptId}" not found in source "${sourceId}"`)
    if (PromptManagerService.isShowcaseOnly(prompt)) {
      fail('this prompt belongs to a third-party plugin and is injected by it')
    }
    const state = await this.readState()
    const overrides = { ...(state.presets[presetId] ?? {}) }
    if (inject === undefined) {
      if (!(key in overrides)) return { changed: false }
      delete overrides[key]
    } else if (overrides[key] === inject) {
      return { changed: false }
    } else {
      overrides[key] = inject
    }
    if (Object.keys(overrides).length > 0) state.presets[presetId] = overrides
    else delete state.presets[presetId]
    await this.writeState(state)
    await this.refreshInjected()
    return { changed: true }
  }

  /**
   * Write (or drop) one preset override. Dropping happens when the requested
   * value equals the global flag — inheriting it is the same result and keeps
   * the state file small.
   */
  async setPresetOverride(presetId, key, inject, baseInject) {
    const state = await this.readState()
    const overrides = { ...(state.presets[presetId] ?? {}) }
    if (inject === baseInject) delete overrides[key]
    else overrides[key] = inject
    if (Object.keys(overrides).length > 0) state.presets[presetId] = overrides
    else delete state.presets[presetId]
    await this.writeState(state)
  }

  /**
   * Drop preset overrides whose prompt key matches `predicate`, then prune
   * preset maps that became empty. Removing a prompt must not leave a dead
   * override behind that a future prompt with the same id would inherit.
   */
  async dropPresetOverrides(predicate) {
    const state = await this.readState()
    let touched = false
    for (const overrides of Object.values(state.presets)) {
      for (const key of Object.keys(overrides)) {
        if (predicate(key)) {
          delete overrides[key]
          touched = true
        }
      }
    }
    for (const [presetId, overrides] of Object.entries(state.presets)) {
      if (Object.keys(overrides).length === 0) delete state.presets[presetId]
    }
    if (touched) await this.writeState(state)
    return touched
  }

  // -- Remote methods ----------------------------------------------------------

  /** Snapshot of every source with its prompts, for the management page. */
  async overview(request) {
    await this.ensureSystemPromptSeed()
    await this.migrateSectionFlags()
    const state = await this.readState()
    const presetId = asPresetId(request?.preset)
    const presets = await this.listPresets()
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
        const key = PromptManagerService.keyOf(source.id, prompt.id)
        // DSH sections are injected by their own plugin: this panel never
        // carries a switch or a preset override for them, only the facts that
        // explain when they land in the system prompt.
        const external = prompt.origin === PromptManagerService.SYSTEM_PROMPT_ORIGIN
        // Third-party sections keep their owning plugin; everything else
        // (local prompts and first-party Harness sections) shares one switch.
        const showcase = PromptManagerService.isShowcaseOnly(prompt)
        const baseInject = showcase ? false : prompt.inject === true
        const override = !showcase && presetId && state.presets[presetId]
          && typeof state.presets[presetId][key] === 'boolean'
          ? state.presets[presetId][key]
          : null
        const sectionName = typeof prompt.sectionName === 'string' && prompt.sectionName !== ''
          ? prompt.sectionName
          : ''
        const order = external ? this.sectionOrder(sectionName) : null
        prompts.push({
          ...PromptManagerService.decorate(source, prompt),
          baseInject,
          presetOverride: override,
          inject: showcase
            ? false
            : (presetId
              ? PromptManagerService.effectiveInject(prompt, key, presetId, state.presets)
              : baseInject),
          injectable: !showcase,
          translation: state.translations[key] ?? null,
          injectTranslation: state.injectTranslations[key] === true && Boolean(state.translations[key]),
          injectContent: (state.injectTranslations[key] === true && state.translations[key]?.text !== undefined)
            ? state.translations[key].text
            : prompt.content,
          ...(external
            ? {
                condition: {
                  order,
                  registered: order !== null,
                  builtin: prompt.builtin === true,
                  managed: prompt.builtin === true,
                  section: sectionName,
                },
              }
            : {}),
        })
      }
    }
    const presetRows = presets.map((preset) => ({
      ...preset,
      overridden: Object.keys(state.presets[preset.id] ?? {}).length,
    }))
    for (const presetIdKey of Object.keys(state.presets)) {
      // A preset that left the registry keeps its overrides visible so the
      // user can see (and clear) them instead of silently losing edits.
      if (!presetRows.some((row) => row.id === presetIdKey)) {
        presetRows.push({
          id: presetIdKey,
          name: '',
          description: '',
          order: 0,
          broken: true,
          default: false,
          overridden: Object.keys(state.presets[presetIdKey]).length,
        })
      }
    }
    const orderedPrompts = PromptManagerService.sortByOrder(prompts, state.order)
    // Preset-scoped prompt sections only exist while that preset's agent is
    // assembling; hand the panel the last snapshot of each one it has seen.
    const views = []
    for (const [viewPreset, view] of this.presetViews) {
      const row = presetRows.find((entry) => entry.id === viewPreset)
      views.push({
        preset: viewPreset,
        presetName: row?.name || viewPreset,
        at: view.at,
        sections: view.sections,
      })
    }
    views.sort((left, right) => {
      if (left.preset === right.preset) return 0
      if (left.preset === presetId) return -1
      if (right.preset === presetId) return 1
      return left.preset.localeCompare(right.preset)
    })
    // Surface whether translation can work at all: without a registered llm
    // service every translate call fails, and the panel should say so instead
    // of letting the button look broken.
    const llm = this.llmService()
    const providers = llm && typeof llm.listProviders === 'function'
      ? [...new Set(llm.listProviders()
          .map((entry) => entry?.id)
          .filter((id) => typeof id === 'string' && id !== '' && id !== 'lingshu-whitebox'))]
      : []
    return {
      sources,
      prompts: orderedPrompts,
      preamble: await this.effectivePreamble(),
      enabled: state.enabled !== false,
      translation: state.translation,
      languages: TRANSLATION_LANGUAGES,
      plugins: PromptManagerService.summarizePlugins(orderedPrompts),
      presets: presetRows,
      activePreset: presetId === '' ? null : presetId,
      presetViews: views,
      presetDefinitions: await this.presetDefinitions(),
      llm: { available: providers.length > 0, providers },
    }
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
      const fallbackTitle = deriveTitle('', source.path)
      const current = file.prompts[0] ?? {
        id: TEXT_PROMPT_ID,
        title: fallbackTitle,
        defaultTitle: fallbackTitle,
        titleCustom: false,
        content: '',
        inject: false,
        updatedAt: '',
      }
      const presetId = asPresetId(request.preset)
      const content = asString(request.content, 'content', { optional: true })
      const inject = asBoolean(request.inject, 'inject', current.inject)
      const requestedTitle = asString(request.title, 'title', { optional: true, max: 500 })
      // A text source's displayed title is an override of the file's own
      // heading. It lives in our state file, so renaming a prompt never
      // rewrites the user's document.
      if (requestedTitle !== undefined) {
        const state = await this.readState()
        const trimmed = requestedTitle.trim()
        const defaultTitle = typeof current.defaultTitle === 'string' ? current.defaultTitle : fallbackTitle
        if (trimmed === '' || trimmed === defaultTitle) delete state.titles[source.id]
        else state.titles[source.id] = trimmed
        await this.writeState(state)
      }
      // Toggling injection must never touch the user's file: only a real
      // content change is written back (read-only archives stay untouched).
      if (content !== undefined && content !== current.content) {
        await this.writeSource(source, [{ ...current, content }])
      }
      if (presetId) {
        if (request.inject !== undefined) {
          await this.setPresetOverride(
            presetId,
            PromptManagerService.keyOf(source.id, TEXT_PROMPT_ID),
            inject,
            current.inject,
          )
        }
      } else if (inject !== current.inject) {
        await this.setInjectFlag(source.path, inject)
      }
      this.refreshInjected()
      const reread = await this.readSource(source)
      const merged = { ...(reread.prompts[0] ?? current), inject }
      if (presetId) {
        const state = await this.readState()
        const key = PromptManagerService.keyOf(source.id, TEXT_PROMPT_ID)
        merged.inject = PromptManagerService.effectiveInject({ inject: current.inject }, key, presetId, state.presets)
      }
      return PromptManagerService.decorate(source, merged)
    }

    const index = file.prompts.findIndex((p) => p.id === promptId)
    if (index < 0) fail(`prompt "${promptId}" not found in source "${sourceId}"`)
    const current = file.prompts[index]
    const presetId = asPresetId(request.preset)
    const requestedTitle = asString(request.title, 'title', { optional: true, max: 500 })
    const requestedInject = asBoolean(request.inject, 'inject', undefined)
    // Third-party sections stay owned by their plugin; first-party Harness
    // sections use the same switch as local prompts.
    const showcase = PromptManagerService.isShowcaseOnly(current)
    const next = {
      ...current,
      title: requestedTitle ?? current.title,
      content: asString(request.content, 'content', { optional: true }) ?? current.content,
      // A preset view only records an override: the global flag stays as it
      // is, so other presets keep the default.
      inject: showcase ? false : (presetId ? current.inject : (requestedInject ?? current.inject ?? false)),
      updatedAt: new Date().toISOString(),
    }
    if (requestedTitle !== undefined) {
      // Imported DSH sections remember whether their title still matches the
      // snapshot's original, so a re-import can preserve a custom one.
      const originSection = typeof current.sectionName === 'string' && current.sectionName !== ''
        ? current.sectionName
        : (promptOrigin(current)?.section ?? '')
      const fallbackDefault = originSection === '' ? undefined : `DSH · ${originSection}`
      const defaultTitle = typeof current.defaultTitle === 'string' ? current.defaultTitle : fallbackDefault
      next.titleCustom = defaultTitle !== undefined && requestedTitle !== defaultTitle
    }
    const prompts = [...file.prompts]
    prompts[index] = next
    await this.writeSource(source, prompts)
    if (presetId && requestedInject !== undefined && !showcase) {
      await this.setPresetOverride(
        presetId,
        PromptManagerService.keyOf(source.id, promptId),
        requestedInject,
        current.inject === true,
      )
    }
    this.refreshInjected()
    if (presetId) {
      const state = await this.readState()
      const key = PromptManagerService.keyOf(source.id, promptId)
      return PromptManagerService.decorate(source, {
        ...next,
        inject: PromptManagerService.effectiveInject(next, key, presetId, state.presets),
      })
    }
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
    const removedKey = PromptManagerService.keyOf(source.id, promptId)
    await this.dropPresetOverrides((key) => key === removedKey)
    const state = await this.readState()
    const order = state.order.includes(removedKey)
      ? state.order.filter((key) => key !== removedKey)
      : state.order
    const injectTranslations = { ...state.injectTranslations }
    const hadTranslationInject = injectTranslations[removedKey] === true
    delete injectTranslations[removedKey]
    if (order !== state.order || hadTranslationInject) {
      await this.writeState({ ...state, order, injectTranslations })
    }
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
    // Drop the injection flag and title override of the detached text source:
    // nothing else reads them. Preset overrides of its prompts go too.
    const detached = state.sources.find((s) => s.id === id)
    if (detached) {
      delete state.inject[detached.path]
      delete state.titles[detached.id]
      for (const overrides of Object.values(state.presets)) {
        for (const key of Object.keys(overrides)) {
          if (key.startsWith(`${detached.id}/`)) delete overrides[key]
        }
      }
      for (const [presetId, overrides] of Object.entries(state.presets)) {
        if (Object.keys(overrides).length === 0) delete state.presets[presetId]
      }
    }
    await this.writeState({ ...state, sources })
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
   * Recompute the injection text from every source, once per agent preset
   * view. Mutations call this after writing; the system-prompt section
   * triggers a throttled refresh so manual file edits propagate without a
   * restart.
   */
  refreshInjected() {
    if (this.injectedRefresh) return this.injectedRefresh
    this.injectedRefresh = (async () => {
      const entries = []
      for (const source of await this.listSources()) {
        const file = await this.readSource(source)
        for (const prompt of file.prompts) {
          entries.push({ source, prompt, key: PromptManagerService.keyOf(source.id, prompt.id) })
        }
      }
      const state = await this.readState()
      const ordered = PromptManagerService.sortByOrder(entries, state.order)
      const enabled = state.enabled !== false
      const preamble = typeof state.preamble === 'string' ? state.preamble : DEFAULT_PREAMBLE
      const presets = state.presets
      const injectTranslations = state.injectTranslations ?? {}
      const presetIds = new Set(['', ...Object.keys(presets)])
      for (const preset of await this.listPresets()) presetIds.add(preset.id)
      const texts = new Map()
      for (const presetId of presetIds) {
        if (!enabled) {
          texts.set(presetId, '')
          continue
        }
        const parts = []
        for (const { prompt, key } of ordered) {
          // Third-party sections are injected by their own plugin.
          if (PromptManagerService.isShowcaseOnly(prompt)) continue
          if (!PromptManagerService.effectiveInject(prompt, key, presetId, presets)) continue
          // A prompt may opt into injecting its translation; without a stored
          // translation it falls back to the source text.
          const translated = injectTranslations[key] === true ? state.translations[key] : undefined
          const body = translated && typeof translated.text === 'string' && translated.text !== ''
            ? translated.text
            : prompt.content
          parts.push(`## ${prompt.title}\n\n${body}`)
        }
        texts.set(presetId, parts.length === 0 ? '' : (preamble === ''
          ? parts.join('\n')
          : [preamble, '', ...parts].join('\n')))
      }
      this.presetTexts = texts
      this.injectedText = texts.get('') ?? ''
      this.injectedRefreshedAt = Date.now()
    })()
      .catch(() => {})
      .finally(() => {
        this.injectedRefresh = null
      })
    return this.injectedRefresh
  }

  /** Synchronous section text for the system-prompt assembly. */
  sectionText(context) {
    if (Date.now() - this.injectedRefreshedAt > 2000) this.refreshInjected()
    const presetId = this.presetIdFor(context)
    if (this.presetTexts.has(presetId)) return this.presetTexts.get(presetId)
    return this.presetTexts.get('') ?? ''
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
  'setPluginInject',
  'setPresetInject',
  'setPreamble',
  'setEnabled',
  'reorder',
  'translatePrompt',
  'clearTranslation',
  'setInjectTranslation',
  'setTranslationSettings',
])

export function apply(ctx, config) {
  const service = new PromptManagerService(ctx, config ?? {})
  ctx.effect(() => ctx.reflect.provide(SERVICE_KEY, service), 'prompt-manager: service')
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'prompt-manager',
    order: 90,
    // The section is assembled per agent, so its preset decides which
    // prompts are injected for that agent.
    text: (context) => service.sectionText(context),
  }), 'prompt-manager: system prompt section')
  // The assembly waterfall is the supported seam for dropping a DSH section
  // from one assembly: the section keeps its registration (and its plugin's
  // ownership), and only the text handed to the model is filtered.
  ctx.effect(() => ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const assembled = await next()
    try {
      return await service.filterAssembly(assembled, context)
    } catch {
      return assembled
    }
  }), 'prompt-manager: assembly filter')
  service.refreshInjected()
}
