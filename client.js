/**
 * Prompt Manager — Client half (browser module).
 *
 * Mounts the hand-written Typert Remote contribution for the Host
 * `promptManager` service, then registers a sidebar panel (`sidebar.panellist`
 * + `main`) rendering the management page. Styling follows the host Button,
 * Input and Modal conventions and uses only host theme tokens, so the page
 * follows light/dark themes.
 */
window.__ModuleLoader__.load({
  id: '@local/prompt-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useMemo } = React

    const NS = 'prompt-manager'
    const PANEL_ID = 'prompt-manager'

    // -- locale ---------------------------------------------------------------

    const zh = {
      'panel.title': '提示词',
      'header.subtitle': '管理注入到 DSH 的提示词，每条提示词都保存在它所属的来源文件里。',
      'action.new': '新建提示词',
      'action.addSource': '添加来源文件',
      'action.refresh': '刷新',
      'action.importDsh': '导入 DSH 提示词',
      'action.importDshHint': '抓取当前拼装出的系统提示词各段，写入内置文件（不覆盖你自己的提示词）',
      'action.imported': '已导入 {count} 段',
      'prompt.originDsh': 'DSH',
      'prompt.injectedBy': '由 {plugin} 注入',
      'prompt.condition': '注入条件：来自 {plugin} 的段「{section}」，order {order}。它由原插件自己注入，本插件只展示和翻译，不会重复注入。',
      'prompt.conditionManaged': '注入条件：来自 {plugin} 的段「{section}」，原 order {order}。现在由本插件接管：开关打开即由本插件注入，关闭则从系统提示词中移除。',
      'prompt.conditionMissing': '注入条件：{plugin} 的段「{section}」当前不在 DSH 注册表里（可能来自其它 profile，或插件已卸载），因此不会注入。',
      'prompt.dragHint': '拖动卡片可调整提示词顺序，注入时按这个顺序拼接。',
      'prompt.titleCustom': '自定义',
      'plugin.title': '插件提示词',
      'plugin.hint': '按注册系统提示词段的插件分组。这些段由各自的插件在组装时注入，本插件只负责展示和翻译，不提供注入开关；点插件名可筛选下方列表。',
      'plugin.count': '{count} 段',
      'plugin.injected': '已注入 {injected}/{count}',
      'plugin.filterOff': '显示全部',
      'plugin.empty': '还没有导入任何插件的提示词。点右上角「导入 DSH 提示词」抓取当前系统提示词各段。',
      'plugin.builtin': 'DSH 内置',
      'plugin.untitled': '未归属插件',
      'plugin.emptyFilter': '该插件目前没有提示词。',
      'preset.title': '注入预设',
      'preset.hint': 'DSH 的 agent 预设可以分别管理注入：选中一个预设后，下面的开关只改这个预设的覆盖值，其它预设仍按全局设置。会话运行时按它所用的预设取对应的一份。',
      'preset.global': '默认（全局）',
      'preset.overridden': '{count} 个覆盖',
      'preset.default': '默认预设',
      'preset.broken': '已移除',
      'preset.inherit': '继承',
      'preset.overrideOn': '本预设已开启',
      'preset.overrideOff': '本预设已关闭',
      'preset.empty': '当前 profile 没有可用的 agent 预设；所有会话按「默认（全局）」注入。',
      'preset.active': '正在按「{name}」管理注入',
      'editor.fieldInjectPreset': '注入到系统提示词（只对「{name}」预设生效）',
      'sources.title': '来源文件',
      'sources.empty': '暂无来源文件。',
      'source.internal': '内置',
      'source.missing': '文件尚未创建',
      'source.exists': '文件已存在',
      'source.readonly': '只读',
      'source.count': '{count} 条',
      'source.remove': '移除',
      'source.removeConfirm': '确认移除？',
      'prompts.title': '提示词列表',
      'prompts.empty': '还没有提示词。点右上角「新建提示词」创建第一条。',
      'prompts.emptyPath': '内置文件：{path}',
      'preview.sources': '已注入的来源：',
      'prompts.injectHint': '点卡片标题旁的「未注入 / 已注入」胶囊即可切换是否把该提示词拼进所有会话的系统提示词。',
      'prompt.inject.on': '已注入',
      'prompt.editHint': '点击标题或内容即可编辑',
      'preview.title': '注入预览',
      'preview.count': '已注入 {count} 条',
      'preview.show': '展开',
      'preview.hide': '收起',
      'preview.copy': '复制',
      'preview.copied': '已复制',
      'preview.refresh': '重新计算',
      'preview.hint': '以下内容会作为一段加入所有会话的系统提示词，下一次组装生效。',
      'preview.empty': '当前没有注入任何提示词。开启某条提示词的「未注入」胶囊后，这里会显示最终内容。',
      'preview.preambleLabel': '注入前言（清空则不再输出前言；恢复默认可还原英文原文）',
      'preview.preamblePlaceholder': '例如：以下是我的常驻要求，请始终遵守。',
      'preview.preambleSave': '保存前言',
      'preview.preambleReset': '恢复默认',
      'preview.preambleSaved': '前言已保存',
      'preview.preambleDirty': '有未保存的修改',
      'prompt.inject.off': '未注入',
      'prompt.inject.hint': '注入到系统提示词',
      'prompt.edit': '编辑',
      'prompt.delete': '删除',
      'prompt.deleteConfirm': '确认删除？',
      'prompt.readonly': '来源只读',
      'prompt.updated': '更新于 {time}',
      'editor.create': '新建提示词',
      'editor.edit': '编辑提示词',
      'editor.source': '来源文件',
      'editor.fieldTitle': '标题',
      'editor.fieldContent': '内容',
      'editor.fieldInject': '注入到系统提示词（对所有会话生效）',
      'editor.save': '保存',
      'editor.cancel': '取消',
      'editor.titleRequired': '标题不能为空',
      'editor.titleHint': '标题只影响列表显示和注入时的「## 标题」，不会写回来源文件。',
      'editor.textTitleHint': '文本来源的标题默认取自文件里的第一个「# 标题」；可改成任意显示名，留空则恢复文件里的标题。',
      'editor.resetTitle': '恢复默认',
      'sourceDialog.title': '添加来源文件',
      'sourceDialog.path': '文件绝对路径（JSON 格式，不存在时会创建）',
      'sourceDialog.readonly': '只读（仅展示，不允许修改）',
      'sourceDialog.add': '添加',
      'sourceDialog.browse': '浏览…',
      'sourceDialog.browseHint': '可点目录进入、点文件选中；也支持 .md / .markdown / .txt',
      'sourceDialog.up': '上级目录',
      'sourceDialog.filename': '文件名（可直接新建，如 my-prompt.md）',
      'sourceDialog.useFile': '使用该文件名',
      'sourceDialog.noFiles': '该目录下没有 .json / .md / .txt 文件',
      'sourceDialog.loading': '读取目录中…',
      'sourceDialog.restartHint': '（Host 端没有这个接口，通常是插件更新后还没重启 DSH：请重启 DSH 再刷新页面）',
      'tabs.mine': '我的提示词',
      'tabs.system': '系统提示词',
      'tabs.plugin': '插件提示词',
      'tabs.settings': '设置',
      'status.injectOn': '注入 {count} 条',
      'status.injectOff': '已停用注入',
      'inject.title': '注入状态',
      'inject.hint': '本插件的提示词在每次组装系统提示词时读取，修改后从下一次请求开始生效；关闭后不再向系统提示词注入任何内容，管理功能仍然可用。',
      'inject.on': '已启用',
      'inject.off': '已停用',
      'inject.enable': '启用注入',
      'inject.disable': '停用注入',
      'inject.rules': '每次请求前由 DSH 组装系统提示词时读取本插件缓存的文本（约 2 秒内自动刷新）；只有你自己的提示词会按「## 标题 + 内容」依次拼在「注入前言」之后。DSH 系统段和其它插件的段由它们各自注入，这里只展示和翻译。',
      'inject.count': '当前视角注入 {count} 条',
      'inject.disabledHint': '注入已停用：以下提示词不会进入系统提示词。',
      'section.mine': '我的提示词',
      'section.mineDesc': '内置文件与你自己添加的来源文件；新建提示词和添加来源都在这里。',
      'section.system': '系统提示词',
      'section.systemDesc': 'DSH 第一方固定段（身份、来源、Web 界面等）。它们本来就会由 DSH 注入，这里开启会重复拼一次。',
      'section.plugin': '插件提示词',
      'section.pluginDesc': '第三方插件注册的提示词段；按插件分组，可批量开关。',
      'section.systemEmpty': '还没有导入系统提示词段。',
      'section.pluginEmpty': '还没有导入插件提示词段。',
      'presetDefs.title': '预设声明的提示词',
      'presetDefs.hint': '直接读 DSH agent preset 的声明（agentPresets.readDocument），比如 persona 的 prefix；不需要该预设跑过。下面另外列出该预设实际运行时注册过的段（如果有）。全部只读。',
      'presetView.runtimeHead': '运行时实际注册的段（{time}）',
      'presetDefs.empty': '当前 profile 读不到预设声明（headless，或没有启用 agentPresets）。',
      'presetDefs.count': '{count} 条',
      'presetDefs.none': '没有提示词声明',
      'translate.title': '翻译',
      'translate.target': '目标语言',
      'translate.provider': '模型 provider（留空用第一个可用）',
      'translate.model': '模型（留空用 provider 默认）',
      'translate.save': '保存翻译设置',
      'translate.saved': '翻译设置已保存',
      'translate.run': '翻译',
      'translate.running': '翻译中…',
      'translate.done': '已翻译为 {lang}',
      'translate.skipped': '内容已经是 {lang}，无需翻译',
      'translate.failed': '翻译失败：{message}',
      'translate.clear': '清除译文',
      'translate.showTranslation': '看译文',
      'translate.showOriginal': '看原文',
      'translate.badge': '译文',
      'translate.batch': '翻译全部（{count}）',
      'translate.batchDone': '已翻译 {count} 条',
      'translate.batchFailed': '翻译完成 {done} 条，失败 {failed} 条：{message}',
      'translate.hint': '译文保存在 state.json，不改来源文件；默认只用于阅读，开启「注入译文」后注入时使用译文。',
      'translate.warning': '格式可能不一致：{detail}',
      'prompt.injectSource': '注入原文',
      'prompt.injectTranslation': '注入译文',
      'prompt.injectTranslationHint': '注入时使用这段译文；关闭则注入原文',
      'translate.empty': '没有需要翻译的提示词。',
      'translate.llmHint': '调用当前 profile 的 LLM 服务（优先使用设置的 provider）。',
      'translate.llmAvailable': '可用模型服务：{providers}',
      'translate.llmUnavailable': '当前 profile 没有可用的 LLM 服务，翻译会失败。',
      'state.loading': '加载中…',
      'state.saving': '保存中…',
    }
    const en = {
      'panel.title': 'Prompts',
      'header.subtitle': 'Manage prompts injected into DSH. Every prompt lives in its source file.',
      'action.new': 'New Prompt',
      'action.addSource': 'Add Source File',
      'action.refresh': 'Refresh',
      'action.importDsh': 'Import DSH prompts',
      'action.importDshHint': 'Snapshot the assembled system-prompt sections into the built-in file (your own prompts are kept)',
      'action.imported': 'Imported {count}',
      'prompt.originDsh': 'DSH',
      'prompt.injectedBy': 'Injected by {plugin}',
      'prompt.condition': 'Injection: section "{section}" from {plugin} at order {order}. Its own plugin injects it; this panel only shows and translates it and never injects it again.',
      'prompt.conditionManaged': 'Injection: section "{section}" from {plugin} at order {order}. prompt-manager now owns this one: on, it is injected here; off, it is removed from the system prompt.',
      'prompt.conditionMissing': 'Injection: section "{section}" from {plugin} is not in the DSH registry right now (other profile, or the plugin was uninstalled), so it is not injected.',
      'prompt.dragHint': 'Drag cards to reorder the prompts; the injected text follows this order.',
      'prompt.titleCustom': 'Custom',
      'plugin.title': 'Plugin prompts',
      'plugin.hint': 'Grouped by the plugin that registered each system-prompt section. Those plugins inject their own sections; this panel only shows and translates them and offers no injection switch. Click a plugin name to filter the list below.',
      'plugin.count': '{count} sections',
      'plugin.injected': '{injected}/{count} injected',
      'plugin.filterOff': 'Show all',
      'plugin.empty': 'No plugin prompts imported yet. Click "Import DSH prompts" to snapshot the current sections.',
      'plugin.builtin': 'DSH built-in',
      'plugin.untitled': 'Unattributed',
      'plugin.emptyFilter': 'No prompts from this plugin yet.',
      'preset.title': 'Injection presets',
      'preset.hint': 'DSH agent presets can manage injection separately: pick a preset and the switches below only change that preset\'s overrides, while every other preset keeps the global flag. A running session reads the copy for its own preset.',
      'preset.global': 'Default (global)',
      'preset.overridden': '{count} overrides',
      'preset.default': 'Default preset',
      'preset.broken': 'Removed',
      'preset.inherit': 'Inherit',
      'preset.overrideOn': 'On in this preset',
      'preset.overrideOff': 'Off in this preset',
      'preset.empty': 'This profile has no agent presets; every session injects from "Default (global)".',
      'preset.active': 'Managing injection for "{name}"',
      'editor.fieldInjectPreset': 'Inject into the system prompt (only for the "{name}" preset)',
      'sources.title': 'Source Files',
      'sources.empty': 'No source files yet.',
      'source.internal': 'Built-in',
      'source.missing': 'File not created yet',
      'source.exists': 'File exists',
      'source.readonly': 'Read-only',
      'source.count': '{count} prompts',
      'source.remove': 'Remove',
      'source.removeConfirm': 'Confirm removal?',
      'prompts.title': 'Prompts',
      'prompts.empty': 'No prompts yet. Click "New Prompt" in the top-right corner.',
      'prompts.emptyPath': 'Built-in file: {path}',
      'preview.sources': 'Injected from:',
      'prompts.injectHint': 'Click the Not injected / Injected chip beside a title to add or remove it from every session\u2019s system prompt.',
      'prompt.inject.on': 'Injected',
      'prompt.editHint': 'Click the title or content to edit',
      'preview.title': 'Injection preview',
      'preview.count': '{count} injected',
      'preview.show': 'Show',
      'preview.hide': 'Hide',
      'preview.copy': 'Copy',
      'preview.copied': 'Copied',
      'preview.refresh': 'Recompute',
      'preview.hint': 'This text is added to every session\u2019s system prompt as one section, effective at the next assembly.',
      'preview.empty': 'Nothing is injected yet. Turn a prompt\u2019s chip to "Injected" to see the final text here.',
      'preview.preambleLabel': 'Injection lead-in (empty = no lead-in; reset restores the shipped wording)',
      'preview.preamblePlaceholder': 'e.g. These are my standing requirements; always follow them.',
      'preview.preambleSave': 'Save lead-in',
      'preview.preambleReset': 'Reset to default',
      'preview.preambleSaved': 'Lead-in saved',
      'preview.preambleDirty': 'Unsaved changes',
      'prompt.inject.off': 'Not injected',
      'prompt.inject.hint': 'Inject into the system prompt',
      'prompt.edit': 'Edit',
      'prompt.delete': 'Delete',
      'prompt.deleteConfirm': 'Confirm delete?',
      'prompt.readonly': 'Source is read-only',
      'prompt.updated': 'Updated {time}',
      'editor.create': 'New Prompt',
      'editor.edit': 'Edit Prompt',
      'editor.source': 'Source file',
      'editor.fieldTitle': 'Title',
      'editor.fieldContent': 'Content',
      'editor.fieldInject': 'Inject into the system prompt (applies to every session)',
      'editor.save': 'Save',
      'editor.cancel': 'Cancel',
      'editor.titleRequired': 'Title is required',
      'editor.titleHint': 'The title only affects the list and the “## title” line when injected; it is never written back to the source file.',
      'editor.textTitleHint': 'Defaults to the file’s first “# heading”. You can rename it for display only; clearing it restores the heading.',
      'editor.resetTitle': 'Reset',
      'sourceDialog.title': 'Add Source File',
      'sourceDialog.path': 'Absolute file path (JSON; created when missing)',
      'sourceDialog.readonly': 'Read-only (display only)',
      'sourceDialog.add': 'Add',
      'sourceDialog.browse': 'Browse…',
      'sourceDialog.browseHint': 'Click a directory to enter, a file to select; .md / .markdown / .txt are supported',
      'sourceDialog.up': 'Parent directory',
      'sourceDialog.filename': 'File name (type a new one, e.g. my-prompt.md)',
      'sourceDialog.useFile': 'Use this file name',
      'sourceDialog.noFiles': 'No .json / .md / .txt file in this directory',
      'sourceDialog.loading': 'Reading directory…',
      'sourceDialog.restartHint': ' (the Host does not expose this endpoint yet — usually a plugin update without a DSH restart: restart DSH, then refresh)',
      'tabs.mine': 'My prompts',
      'tabs.system': 'System prompts',
      'tabs.plugin': 'Plugin prompts',
      'tabs.settings': 'Settings',
      'status.injectOn': '{count} injected',
      'status.injectOff': 'Injection off',
      'inject.title': 'Injection status',
      'inject.hint': 'This plugin reads its prompts whenever DSH assembles the system prompt; changes apply from the next request. Turning it off stops all injection while management keeps working.',
      'inject.on': 'Enabled',
      'inject.off': 'Disabled',
      'inject.enable': 'Enable injection',
      'inject.disable': 'Disable injection',
      'inject.rules': 'DSH reads this plugin\'s cached text while assembling the system prompt before every request (auto-refreshed within ~2s). Only your own prompts are appended as "## title + content" after the preamble; DSH sections and other plugins\' sections are injected by their owners and only shown and translated here.',
      'inject.count': '{count} injected in this view',
      'inject.disabledHint': 'Injection is disabled: none of these prompts reach the system prompt.',
      'section.mine': 'My prompts',
      'section.mineDesc': 'The built-in file and source files you added; create and add sources here.',
      'section.system': 'System prompts',
      'section.systemDesc': 'DSH first-party sections (identity, sources, web surface...). DSH already injects them; enabling one duplicates it.',
      'section.plugin': 'Plugin prompts',
      'section.pluginDesc': 'Prompt sections registered by third-party plugins; grouped by plugin with bulk switches.',
      'section.systemEmpty': 'No system prompt section imported yet.',
      'section.pluginEmpty': 'No plugin prompt section imported yet.',
      'presetDefs.title': 'Prompt declarations inside each preset',
      'presetDefs.hint': 'Read straight from the DSH agent preset declaration (agentPresets.readDocument), e.g. persona.prefix; no run required. Sections that preset actually registered at runtime are listed below, when captured. Read-only.',
      'presetView.runtimeHead': 'Registered at runtime ({time})',
      'presetDefs.empty': 'No preset declarations available in this profile (headless, or agentPresets disabled).',
      'presetDefs.count': '{count} entries',
      'presetDefs.none': 'no prompt declarations',
      'translate.title': 'Translation',
      'translate.target': 'Target language',
      'translate.provider': 'Model provider (empty = first available)',
      'translate.model': 'Model (empty = provider default)',
      'translate.save': 'Save translation settings',
      'translate.saved': 'Translation settings saved',
      'translate.run': 'Translate',
      'translate.running': 'Translating...',
      'translate.done': 'Translated to {lang}',
      'translate.skipped': 'Already in {lang}, nothing to translate',
      'translate.failed': 'Translation failed: {message}',
      'translate.clear': 'Clear translation',
      'translate.showTranslation': 'Show translation',
      'translate.showOriginal': 'Show original',
      'translate.badge': 'Translation',
      'translate.batch': 'Translate all ({count})',
      'translate.batchDone': 'Translated {count}',
      'translate.batchFailed': 'Translated {done}, failed {failed}: {message}',
      'translate.hint': 'Translations live in state.json and never touch the source file. Turn on "inject translation" to send the translation instead of the source text.',
      'translate.warning': 'Structure may differ: {detail}',
      'prompt.injectSource': 'Inject source',
      'prompt.injectTranslation': 'Inject translation',
      'prompt.injectTranslationHint': 'Send this translation when injecting; turn off to inject the source text',
      'translate.empty': 'Nothing to translate.',
      'translate.llmHint': 'Calls the profile LLM service (prefers the configured provider).',
      'translate.llmAvailable': 'Available model services: {providers}',
      'translate.llmUnavailable': 'This profile has no LLM service; translation will fail.',
      'state.loading': 'Loading…',
      'state.saving': 'Saving…',
    }

    // -- Remote contribution ----------------------------------------------------

    /** Strict codecs with a pass-through schema; the Host validates inputs. */
    const strict = (symbol) => ({
      mode: 'strict',
      typeSymbol: symbol,
      create: () => ({ parse: (value) => value }),
    })
    const requestParam = (method) => ({
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: strict(`@local/prompt-manager#${method}:request`),
    })
    const descriptor = (method, parameters) => ({
      id: `@local/prompt-manager#promptManager/${method}`,
      service: 'promptManager',
      namespace: 'promptManager',
      method,
      invocation: { kind: 'direct' },
      parameters,
      result: { mode: 'src-json' },
    })
    const TYPERT_REMOTE = {
      package: '@local/prompt-manager',
      descriptors: [
        // `overview` takes the optional `{ preset }` view selector, so it must
        // declare one request parameter even when the page calls it with `{}`.
        descriptor('overview', [requestParam('overview')]),
        descriptor('create', [requestParam('create')]),
        descriptor('update', [requestParam('update')]),
        // `remove` collides with the Client namespace service's own member.
        descriptor('delete', [requestParam('delete')]),
        descriptor('addSource', [requestParam('addSource')]),
        descriptor('removeSource', [requestParam('removeSource')]),
        descriptor('listDir', [requestParam('listDir')]),
        descriptor('importSystemPrompt', []),
        descriptor('setPluginInject', [requestParam('setPluginInject')]),
        descriptor('setPresetInject', [requestParam('setPresetInject')]),
        descriptor('setPreamble', [requestParam('setPreamble')]),
        descriptor('setEnabled', [requestParam('setEnabled')]),
        descriptor('reorder', [requestParam('reorder')]),
        descriptor('translatePrompt', [requestParam('translatePrompt')]),
        descriptor('clearTranslation', [requestParam('clearTranslation')]),
        descriptor('setInjectTranslation', [requestParam('setInjectTranslation')]),
        descriptor('setTranslationSettings', [requestParam('setTranslationSettings')]),
      ],
    }

    /**
     * Append an actionable hint when the running Host predates the endpoint
     * being called (its module was loaded before this plugin build).
     */
    function withRestartHint(message, t) {
      return /HTTP 404|invocation-unavailable|no active Remote method/.test(message)
        ? `${message} ${t('sourceDialog.restartHint')}`
        : message
    }

    /** Unwrap a RemoteResult, turning failures into thrown Errors. */
    async function unwrap(promise) {
      const result = await promise
      if (result && typeof result === 'object' && result.ok === false) {
        throw new Error(result.error?.message ?? 'remote call failed')
      }
      return result?.value !== undefined ? result.value : result
    }

    // -- styles -----------------------------------------------------------------

    const css = `
.dshpm-page { height: 100%; overflow-y: auto; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); padding: 24px 28px 64px; box-sizing: border-box; font-size: 14px; line-height: 22px; }
.dshpm-inner { max-width: 880px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
.dshpm-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dshpm-title { font-size: 20px; font-weight: 600; margin: 0; line-height: 28px; }
.dshpm-subtitle { color: var(--dsw-alias-label-secondary); margin: 6px 0 0; }
.dshpm-actions { display: flex; gap: 8px; flex-shrink: 0; }

/* Buttons follow the host Button primitive: ghost by default, outlined or filled on demand. */
.dshpm-btn { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border: none; border-radius: var(--dsw-radius-sm); cursor: pointer; font-size: 12px; line-height: 18px; height: 28px; padding: 0 10px; white-space: nowrap; color: var(--dsw-alias-label-primary); background: transparent; }
.dshpm-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dshpm-btn:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active); }
.dshpm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.dshpm-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dshpm-btn--outline { border: 0.5px solid var(--dsw-alias-border-l3); }
.dshpm-btn--primary { background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
.dshpm-btn--primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.dshpm-btn--danger { color: var(--dsw-alias-state-error-primary); }

.dshpm-section-title { font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 8px; }
.dshpm-source { border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); padding: 10px 14px; display: flex; align-items: center; gap: 10px; }
.dshpm-source + .dshpm-source { margin-top: 8px; }
.dshpm-source-path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; word-break: break-all; flex: 1; }
.dshpm-badge { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; line-height: 18px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); border: 0.5px solid var(--dsw-alias-border-l3); white-space: nowrap; }
.dshpm-badge--inject { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); background: transparent; }

/* The inject state is the control itself: clicking the chip toggles it. */
.dshpm-toggle { display: inline-flex; align-items: center; gap: 4px; padding: 1px 9px; border-radius: 999px; font-size: 11px; line-height: 18px; white-space: nowrap; font-family: inherit; cursor: pointer; color: var(--dsw-alias-label-secondary); background: transparent; border: 0.5px solid var(--dsw-alias-border-l3); }
.dshpm-toggle:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dshpm-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
.dshpm-toggle:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dshpm-toggle--on { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.dshpm-badge--error { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); background: transparent; }
.dshpm-badge--warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); background: transparent; }
.dshpm-inject-list { margin: 8px 0 0; padding-left: 18px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.dshpm-inject-list li { word-break: break-all; }
.dshpm-card { border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); padding: 12px 14px; }
.dshpm-card + .dshpm-card { margin-top: 8px; }
.dshpm-card[draggable="true"] { cursor: grab; }
.dshpm-card[draggable="true"]:active { cursor: grabbing; }
.dshpm-card--dragging { opacity: 0.45; }
.dshpm-card--dragover { border-color: var(--dsw-alias-state-business-primary); }
.dshpm-card-head { display: flex; align-items: center; gap: 8px; }
.dshpm-card-title { font-weight: 600; flex: 1; word-break: break-all; }
.dshpm-card-preview { color: var(--dsw-alias-label-secondary); margin: 6px 0 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; word-break: break-word; }
.dshpm-card-foot { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.dshpm-card-meta { color: var(--dsw-alias-label-secondary); font-size: 12px; flex: 1; }
.dshpm-group { margin-bottom: 16px; }
.dshpm-group-title { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--dsw-alias-label-secondary); margin: 0 0 8px; word-break: break-all; }
/* Prompts imported from DSH are grouped again by the plugin that owns them. */
.dshpm-subgroup { margin: 4px 0 12px 0; padding-left: 12px; border-left: 2px solid var(--dsw-alias-border-l3); }
.dshpm-subgroup-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary); margin: 0 0 8px; }
.dshpm-plugin-list { display: flex; flex-direction: column; gap: 8px; }
.dshpm-plugin { display: flex; align-items: center; gap: 8px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); padding: 8px 14px; }
.dshpm-plugin--active { border-color: var(--dsw-alias-brand-primary); }
.dshpm-plugin-name { font: inherit; font-weight: 600; color: inherit; background: none; border: none; padding: 0; cursor: pointer; }
.dshpm-plugin-name:hover { text-decoration: underline; }
.dshpm-plugin-meta { flex: 1; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dshpm-plugin-actions { display: flex; gap: 6px; flex-shrink: 0; }
.dshpm-notice { border: 0.5px solid var(--dsw-alias-state-success-primary); color: var(--dsw-alias-state-success-primary); border-radius: var(--dsw-radius-md); padding: 8px 14px; font-size: 13px; }
.dshpm-error { border: 0.5px solid var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); border-radius: var(--dsw-radius-md); padding: 10px 14px; word-break: break-word; font-size: 13px; white-space: pre-wrap; }
.dshpm-empty { color: var(--dsw-alias-label-secondary); border: 0.5px dashed var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); padding: 24px; text-align: center; }

/* Dialogs follow the host Modal: mask + prominent secondary-layer card. */
.dshpm-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; background: var(--dsw-alias-bg-mask-1); backdrop-filter: var(--dsw-mask-blur); }
.dshpm-dialog { background: var(--dsw-alias-bg-layer-2); border-radius: var(--dsw-radius-panel); box-shadow: var(--dsw-elevation-prominent); width: 660px; max-width: 100%; max-height: 100%; overflow-y: auto; padding: 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; }
.dshpm-dialog-title { font-size: 16px; font-weight: 600; margin: 0; line-height: 24px; }
.dshpm-field { display: flex; flex-direction: column; gap: 6px; }
.dshpm-field-label { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dshpm-input, .dshpm-textarea { appearance: none; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); padding: 6px 10px; font-size: 14px; line-height: 22px; width: 100%; box-sizing: border-box; font-family: inherit; }
.dshpm-textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; min-height: 220px; resize: vertical; }
.dshpm-input:focus, .dshpm-textarea:focus { outline: none; border-color: var(--dsw-alias-state-business-primary); }
.dshpm-input::placeholder { color: var(--dsw-alias-label-dimmed); }
.dshpm-check { display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 20px; cursor: pointer; user-select: none; }
.dshpm-check input { accent-color: var(--dsw-alias-brand-primary); }
.dshpm-row { display: flex; align-items: center; gap: 8px; }
.dshpm-dialog-foot { display: flex; justify-content: flex-end; gap: 8px; }
.dshpm-dialog-error { color: var(--dsw-alias-state-error-primary); font-size: 12.5px; line-height: 18px; word-break: break-word; }
.dshpm-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }

/* Final injected text, exactly as the system-prompt section renders it. */
.dshpm-preview-dock { margin-top: 10px; padding: 10px 12px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); }
.dshpm-preview-head { display: flex; align-items: center; gap: 8px; }
.dshpm-preview-head .dshpm-section-title { margin: 0; }
.dshpm-preview-spacer { flex: 1; }
.dshpm-preview { margin: 8px 0 0; padding: 10px 12px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 18px; white-space: pre-wrap; word-break: break-word; max-height: 280px; overflow-y: auto; }
.dshpm-clickable { cursor: pointer; }
.dshpm-preamble { min-height: 64px; font-family: inherit; font-size: 13px; line-height: 20px; }

/* In-dialog file browser, served by the plugin's own listDir Remote method. */
.dshpm-browser { border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); max-height: 240px; overflow-y: auto; }
.dshpm-browser-head { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 0.5px solid var(--dsw-alias-border-l3); position: sticky; top: 0; background: var(--dsw-alias-bg-layer-1); }
.dshpm-browser-path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: var(--dsw-alias-label-secondary); flex: 1; word-break: break-all; }
.dshpm-browser-row { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; border: none; background: transparent; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; padding: 5px 12px; cursor: pointer; font-family: inherit; }
.dshpm-browser-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshpm-browser-row--file { color: var(--dsw-alias-label-secondary); }
.dshpm-browser-empty { padding: 10px 12px; color: var(--dsw-alias-label-secondary); font-size: 12.5px; }
.dshpm-browser-error { padding: 10px 12px; color: var(--dsw-alias-state-error-primary); font-size: 12.5px; line-height: 18px; word-break: break-word; }
.dshpm-browser-block { display: flex; flex-direction: column; gap: 6px; }

/* Tabs: one panel at a time keeps the page from growing without bound. */
.dshpm-tabs { display: flex; gap: 2px; border-bottom: 0.5px solid var(--dsw-alias-border-l3); margin: 12px 0 4px; flex-wrap: wrap; }
.dshpm-tab { appearance: none; font: inherit; font-size: 13px; line-height: 20px; padding: 6px 12px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.dshpm-tab:hover { color: var(--dsw-alias-label-primary); }
.dshpm-tab--active { color: var(--dsw-alias-label-primary); border-bottom-color: var(--dsw-alias-brand-primary); font-weight: 600; }
.dshpm-tab-count { font-size: 11px; line-height: 16px; padding: 0 6px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
.dshpm-status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 10px 0 0; padding: 8px 12px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dshpm-status-label { flex: 1; }
.dshpm-card-error { margin-top: 6px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); word-break: break-word; }
.dshpm-tab-panel { margin-top: 10px; }
.dshpm-preset-view { border-top: 1px solid var(--dsw-alias-border-l3); padding: 8px 0; }
.dshpm-preset-view:first-of-type { border-top: 0; }
.dshpm-preset-view > summary { cursor: pointer; display: flex; align-items: center; gap: 8px; list-style: none; }
.dshpm-preset-view > summary::-webkit-details-marker { display: none; }
.dshpm-preset-view > summary::before { content: '▸'; color: var(--dsw-alias-label-secondary); font-size: 11px; width: 10px; }
.dshpm-preset-view[open] > summary::before { content: '▾'; }
.dshpm-preset-name { font-size: 13px; font-weight: 600; }
.dshpm-preset-section { margin-top: 12px; }
.dshpm-preset-section-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.dshpm-preset-section-head code { font-size: 12px; color: var(--dsw-alias-label-primary); }

/* Zones: the three places a prompt can come from (mine / DSH / plugins). */
.dshpm-zone { display: flex; flex-direction: column; }
.dshpm-zone-head { display: flex; align-items: center; gap: 8px; }
.dshpm-zone-head .dshpm-section-title { margin: 0; }
.dshpm-zone .dshpm-group { margin-top: 6px; }
/* A translated preview is shown in a different tone so it never reads like
   the source text that actually goes into the system prompt. */
.dshpm-card-translation { border-left: 2px solid var(--dsw-alias-state-business-primary); padding-left: 8px; color: var(--dsw-alias-label-secondary); }
.dshpm-card-condition { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; margin-top: 6px; }

`

    // -- small controls -----------------------------------------------------------

    function Button(props) {
      const className = [
        'dshpm-btn',
        props.primary ? 'dshpm-btn--primary' : '',
        props.outline ? 'dshpm-btn--outline' : '',
        props.danger ? 'dshpm-btn--danger' : '',
      ].filter(Boolean).join(' ')
      return h('button', {
        type: 'button',
        className,
        disabled: props.disabled,
        title: props.title,
        onClick: props.onClick,
      }, props.children)
    }

    function Badge(props) {
      const className = ['dshpm-badge', props.kind ? `dshpm-badge--${props.kind}` : ''].filter(Boolean).join(' ')
      return h('span', { className }, props.children)
    }

    function useEscape(onEscape, active) {
      useEffect(() => {
        if (!active) return undefined
        const listener = (event) => {
          if (event.key === 'Escape') onEscape()
        }
        window.addEventListener('keydown', listener)
        return () => window.removeEventListener('keydown', listener)
      }, [onEscape, active])
    }

    /** Shipped lead-in, used only when the Host predates the setting. */
    const FALLBACK_PREAMBLE = 'The following user-managed prompts are active. Treat them as standing instructions from the user.'

    /**
     * The exact text the Host system-prompt section renders for injected
     * prompts, including its configurable lead-in. Kept byte-identical to
     * `PromptManagerService.refreshInjected` in index.js; the fidelity test
     * compares both sides.
     */
    function composeInjected(prompts, preamble) {
      // DSH sections are injected by their own plugin, so the preview must
      // never count them even if an older state file still says inject: true.
      const active = prompts.filter((prompt) => prompt.inject && prompt.injectable !== false)
      if (active.length === 0) return ''
      const body = active.map((prompt) => `## ${prompt.title}\n\n${prompt.injectContent ?? prompt.content}`)
      const lead = preamble === undefined || preamble === null ? FALLBACK_PREAMBLE : preamble
      return lead === '' ? body.join('\n') : [lead, '', ...body].join('\n')
    }

    /** Join a directory and a child name with the platform-free POSIX separator. */
    function joinPath(directory, name) {
      if (!directory) return name
      return directory.endsWith('/') ? `${directory}${name}` : `${directory}/${name}`
    }

    // -- dialogs ------------------------------------------------------------------

    function EditorDialog(props) {
      const { t, sources } = props
      const [title, setTitle] = useState(props.initial?.title ?? '')
      const [content, setContent] = useState(props.initial?.content ?? '')
      const [inject, setInject] = useState(props.initial?.inject ?? false)
      const [sourceId, setSourceId] = useState(props.initial?.sourceId ?? 'internal')
      const [localError, setLocalError] = useState('')
      useEscape(props.onCancel, true)
      // A text source holds exactly one prompt and cannot host new ones, but
      // its displayed title is an override kept by the Host (never written to
      // the file), so it is editable like any other title.
      const isText = props.initial?.kind === 'text'
      const defaultTitle = props.initial?.defaultTitle ?? ''
      const writable = sources.filter((s) => !s.readonly && s.kind !== 'text')
      const save = () => {
        const trimmed = title.trim()
        // Clearing a text source's title restores the file's heading; a JSON
        // prompt has no fallback, so an empty title there is an error.
        if (!isText && !trimmed) {
          setLocalError(t('editor.titleRequired'))
          return
        }
        props.onSave({ title: trimmed, content, inject, sourceId })
      }
      return h('div', { className: 'dshpm-overlay', onMouseDown: (e) => { if (e.target === e.currentTarget) props.onCancel() } },
        h('div', { className: 'dshpm-dialog', role: 'dialog', 'aria-modal': 'true' },
          h('h3', { className: 'dshpm-dialog-title' }, props.initial?.key ? t('editor.edit') : t('editor.create')),
          !props.initial?.key && h('label', { className: 'dshpm-field' },
            h('span', { className: 'dshpm-field-label' }, t('editor.source')),
            h('select', {
              className: 'dshpm-input',
              value: sourceId,
              onChange: (e) => setSourceId(e.target.value),
            }, writable.map((s) => h('option', { key: s.id, value: s.id }, s.path)))),
          h('label', { className: 'dshpm-field' },
            h('span', { className: 'dshpm-field-label' }, t('editor.fieldTitle')),
            h('div', { className: 'dshpm-row' },
              h('input', {
                className: 'dshpm-input',
                value: title,
                autoFocus: true,
                placeholder: defaultTitle,
                onChange: (e) => setTitle(e.target.value),
              }),
              defaultTitle !== '' && h(Button, {
                outline: true,
                onClick: () => setTitle(defaultTitle),
              }, t('editor.resetTitle')))),
          h('p', { className: 'dshpm-hint' }, isText ? t('editor.textTitleHint') : t('editor.titleHint')),
          h('label', { className: 'dshpm-field' },
            h('span', { className: 'dshpm-field-label' }, t('editor.fieldContent')),
            h('textarea', {
              className: 'dshpm-textarea',
              value: content,
              onChange: (e) => setContent(e.target.value),
            })),
          h('label', { className: 'dshpm-check' },
            h('input', {
              type: 'checkbox',
              checked: inject,
              onChange: (e) => setInject(e.target.checked),
            }),
            props.presetName
              ? t('editor.fieldInjectPreset', { name: props.presetName })
              : t('editor.fieldInject')),
          (localError || props.error) && h('div', { className: 'dshpm-dialog-error' }, localError || props.error),
          h('div', { className: 'dshpm-dialog-foot' },
            h(Button, { onClick: props.onCancel, disabled: props.saving }, t('editor.cancel')),
            h(Button, { primary: true, onClick: save, disabled: props.saving }, props.saving ? t('state.saving') : t('editor.save')))))
    }

    function AddSourceDialog(props) {
      const { t, api } = props
      const [path, setPath] = useState('')
      const [filename, setFilename] = useState('prompts.json')
      const [readonly, setReadonly] = useState(false)
      const [browser, setBrowser] = useState(null)
      useEscape(props.onCancel, true)

      const load = useCallback(async (target) => {
        setBrowser((prev) => ({ listing: prev?.listing ?? null, loading: true, error: '' }))
        try {
          const listing = await unwrap(api().listDir({ path: target }))
          setBrowser({ listing, loading: false, error: '' })
        } catch (error) {
          console.error('[prompt-manager] directory listing failed', error)
          setBrowser((prev) => ({
            listing: prev?.listing ?? null,
            loading: false,
            error: withRestartHint(error?.message ?? String(error), t),
          }))
        }
      }, [api])

      const listing = browser?.listing
      const directories = listing?.directories ?? []
      const files = listing?.files ?? []
      const selectFile = (name) => {
        setFilename(name)
        setPath(joinPath(listing.path, name))
      }

      return h('div', { className: 'dshpm-overlay', onMouseDown: (e) => { if (e.target === e.currentTarget) props.onCancel() } },
        h('div', { className: 'dshpm-dialog', role: 'dialog', 'aria-modal': 'true' },
          h('h3', { className: 'dshpm-dialog-title' }, t('sourceDialog.title')),
          h('label', { className: 'dshpm-field' },
            h('span', { className: 'dshpm-field-label' }, t('sourceDialog.path')),
            h('div', { className: 'dshpm-row' },
              h('input', {
                className: 'dshpm-input',
                value: path,
                autoFocus: true,
                placeholder: '/absolute/path/to/prompt.md',
                onChange: (e) => setPath(e.target.value),
              }),
              h(Button, { outline: true, onClick: () => load('') }, t('sourceDialog.browse')))),
          browser && h('div', { className: 'dshpm-browser-block' },
            h('p', { className: 'dshpm-hint' }, t('sourceDialog.browseHint')),
            h('div', { className: 'dshpm-browser' },
              h('div', { className: 'dshpm-browser-head' },
                h(Button, {
                  disabled: !listing?.parent || browser.loading,
                  title: t('sourceDialog.up'),
                  onClick: () => load(listing.parent),
                }, '\u2191'),
                h('span', { className: 'dshpm-browser-path' }, listing?.path ?? (browser.loading ? t('sourceDialog.loading') : ''))),
              browser.error && h('div', { className: 'dshpm-browser-error' }, browser.error),
              !browser.error && directories.map((name) => h('button', {
                key: `d:${name}`,
                type: 'button',
                className: 'dshpm-browser-row',
                onClick: () => load(joinPath(listing.path, name)),
              }, `${name}/`)),
              !browser.error && files.map((name) => h('button', {
                key: `f:${name}`,
                type: 'button',
                className: 'dshpm-browser-row dshpm-browser-row--file',
                onClick: () => selectFile(name),
              }, name)),
              !browser.loading && !browser.error && listing && directories.length === 0 && files.length === 0
                && h('div', { className: 'dshpm-browser-empty' }, t('sourceDialog.noFiles'))),
            h('div', { className: 'dshpm-row', style: { marginTop: '8px' } },
              h('input', {
                className: 'dshpm-input',
                value: filename,
                onChange: (e) => setFilename(e.target.value),
              }),
              h(Button, {
                outline: true,
                disabled: !listing || !filename.trim(),
                onClick: () => setPath(joinPath(listing.path, filename.trim())),
              }, t('sourceDialog.useFile')))),
          h('label', { className: 'dshpm-check' },
            h('input', {
              type: 'checkbox',
              checked: readonly,
              onChange: (e) => setReadonly(e.target.checked),
            }),
            t('sourceDialog.readonly')),
          props.error && h('div', { className: 'dshpm-dialog-error' }, props.error),
          h('div', { className: 'dshpm-dialog-foot' },
            h(Button, { onClick: props.onCancel, disabled: props.saving }, t('editor.cancel')),
            h(Button, { primary: true, disabled: props.saving || !path.trim(), onClick: () => props.onSave({ path: path.trim(), readonly }) }, props.saving ? t('state.saving') : t('sourceDialog.add')))))
    }

    // -- cards --------------------------------------------------------------------

    function PromptCard(props) {
      const { t, prompt } = props
      const [confirming, setConfirming] = useState(false)
      const [showTranslation, setShowTranslation] = useState(false)
      useEffect(() => {
        if (!confirming) return undefined
        const timer = setTimeout(() => setConfirming(false), 3000)
        return () => clearTimeout(timer)
      }, [confirming])
      const translation = prompt.translation
      const shownContent = showTranslation && translation ? translation.text : prompt.content
      const updated = prompt.updatedAt ? new Date(prompt.updatedAt).toLocaleString() : ''
      // Sections imported from DSH are injected by the plugin that registered
      // them; this panel shows and translates them but never offers a switch.
      const injectable = prompt.injectable !== false
      const injectChip = injectable && h('button', {
        type: 'button',
        className: `dshpm-toggle${prompt.inject ? ' dshpm-toggle--on' : ''}`,
        disabled: props.busy || prompt.readonly,
        title: t('prompt.inject.hint'),
        onClick: () => props.onToggleInject(prompt),
      }, prompt.inject ? t('prompt.inject.on') : t('prompt.inject.off'))
      // A preset view marks prompts whose flag was decided for this preset;
      // "inherit" drops the override and follows the global flag again.
      const overridden = injectable && props.presetView !== null && prompt.presetOverride !== null
      const overrideChip = overridden && h('button', {
        type: 'button',
        className: `dshpm-toggle${prompt.inject ? ' dshpm-toggle--on' : ''}`,
        disabled: props.busy || prompt.readonly,
        title: prompt.inject ? t('preset.overrideOn') : t('preset.overrideOff'),
        onClick: () => props.onClearOverride(prompt),
      }, t('preset.inherit'))
      const translationChip = translation
        ? h(Button, {
            outline: true,
            disabled: props.busy,
            onClick: () => setShowTranslation((value) => !value),
          }, showTranslation ? t('translate.showOriginal') : t('translate.showTranslation'))
        : null
      const translationInjectChip = translation && injectable && h('button', {
        type: 'button',
        className: `dshpm-toggle${prompt.injectTranslation ? ' dshpm-toggle--on' : ''}`,
        disabled: props.busy,
        title: t('prompt.injectTranslationHint'),
        onClick: () => props.onToggleTranslation(prompt),
      }, prompt.injectTranslation ? t('prompt.injectTranslation') : t('prompt.injectSource'))
      const openEditor = prompt.readonly ? undefined : () => props.onEdit(prompt)
      const originLabel = prompt.pluginLabel ?? prompt.plugin ?? 'DSH'
      const showcase = prompt.injectable === false
      const conditionArgs = {
        plugin: originLabel,
        section: prompt.sectionName ?? prompt.title,
        order: prompt.condition?.order ?? '?',
      }
      const conditionText = !prompt.condition
        ? ''
        : (showcase
          ? (prompt.condition.registered
            ? t('prompt.condition', conditionArgs)
            : t('prompt.conditionMissing', conditionArgs))
          : t('prompt.conditionManaged', conditionArgs))
      const dragClass = `${props.dragging ? ' dshpm-card--dragging' : ''}${props.dragover ? ' dshpm-card--dragover' : ''}`
      return h('div', {
        className: `dshpm-card${dragClass}`,
        draggable: props.reorderable === true,
        title: props.reorderable === true ? t('prompt.dragHint') : undefined,
        onDragStart: props.reorderable === true ? (event) => props.onDragStart(prompt, event) : undefined,
        onDragOver: props.reorderable === true ? (event) => props.onDragOver(prompt, event) : undefined,
        onDrop: props.reorderable === true ? (event) => props.onDrop(prompt, event) : undefined,
        onDragEnd: props.reorderable === true ? () => props.onDragEnd() : undefined,
      },
        h('div', { className: 'dshpm-card-head' },
          h('span', {
            className: `dshpm-card-title${openEditor ? ' dshpm-clickable' : ''}`,
            title: openEditor ? t('prompt.editHint') : undefined,
            onClick: openEditor,
          }, prompt.title),
          prompt.plugin && h(Badge, null, prompt.pluginLabel ?? prompt.plugin),
          prompt.titleCustom && h(Badge, null, t('prompt.titleCustom')),
          translation && h(Badge, null, t('translate.badge')),
          prompt.origin === 'dsh-system-prompt' && !prompt.plugin && h(Badge, null, t('prompt.originDsh')),
          injectable
            ? [injectChip, overrideChip]
            : h(Badge, null, t('prompt.injectedBy', { plugin: originLabel }))),
        shownContent && h('p', {
          className: `dshpm-card-preview${openEditor ? ' dshpm-clickable' : ''}${showTranslation ? ' dshpm-card-translation' : ''}`,
          title: openEditor ? t('prompt.editHint') : undefined,
          onClick: openEditor,
        }, shownContent),
        conditionText && h('div', { className: 'dshpm-card-condition' }, conditionText),
        translation && Array.isArray(translation.warnings) && translation.warnings.length > 0
          && h('div', { className: 'dshpm-card-condition' }, t('translate.warning', { detail: translation.warnings.join('; ') })),
        props.translateError && h('div', { className: 'dshpm-card-error' }, t('translate.failed', { message: props.translateError })),
        h('div', { className: 'dshpm-card-foot' },
          h('span', { className: 'dshpm-card-meta' }, updated ? t('prompt.updated', { time: updated }) : ''),
          // Translation never writes the source, so it stays available even
          // for read-only entries; only editing and deleting follow `readonly`.
          translationChip,
          translationInjectChip,
          h(Button, {
            key: 'translate',
            outline: true,
            disabled: props.busy || props.translating || !prompt.content,
            onClick: async () => {
              // A successful translation switches to the translated view, so
              // the click visibly changes the card instead of only adding a badge.
              const visible = await props.onTranslate(prompt)
              if (visible) setShowTranslation(true)
            },
          }, props.translating ? t('translate.running') : t('translate.run')),
          translation && h(Button, {
            key: 'clearTranslation',
            outline: true,
            disabled: props.busy,
            onClick: () => props.onClearTranslation(prompt),
          }, t('translate.clear')),
          prompt.readonly
            ? h(Badge, null, t('prompt.readonly'))
            : [
                h(Button, { key: 'edit', outline: true, disabled: props.busy, onClick: () => props.onEdit(prompt) }, t('prompt.edit')),
                prompt.deletable === false ? null : h(Button, {
                  key: 'delete',
                  danger: true,
                  disabled: props.busy,
                  onClick: () => {
                    if (confirming) props.onDelete(prompt)
                    else setConfirming(true)
                  },
                }, confirming ? t('prompt.deleteConfirm') : t('prompt.delete')),
              ].filter(Boolean)))
    }

    function SourceRow(props) {
      const { t, source } = props
      const [confirming, setConfirming] = useState(false)
      useEffect(() => {
        if (!confirming) return undefined
        const timer = setTimeout(() => setConfirming(false), 3000)
        return () => clearTimeout(timer)
      }, [confirming])
      return h('div', { className: 'dshpm-source' },
        h('span', { className: 'dshpm-source-path' }, source.path),
        h(Badge, null, (source.format ?? 'json').toUpperCase()),
        source.internal && h(Badge, null, t('source.internal')),
        source.readonly && h(Badge, null, t('source.readonly')),
        source.error
          ? h(Badge, { kind: 'error' }, source.error)
          : h(Badge, source.exists ? null : { kind: 'warn' }, source.exists
              ? t('source.count', { count: String(source.count) })
              : t('source.missing')),
        !source.internal && h(Button, {
          danger: true,
          disabled: props.busy,
          onClick: () => {
            if (confirming) props.onRemove(source)
            else setConfirming(true)
          },
        }, confirming ? t('source.removeConfirm') : t('source.remove')))
    }

    // -- page ---------------------------------------------------------------------

    function PromptManagerPage(props) {
      const { t, api } = props
      const [state, setState] = useState({
        loading: true,
        error: '',
        sources: [],
        prompts: [],
        plugins: [],
        presets: [],
        enabled: true,
        translation: { targetLanguage: 'zh-CN', provider: '', model: '' },
        languages: [],
        llm: { available: false, providers: [] },
        presetViews: [],
        presetDefinitions: [],
      })
      const [editor, setEditor] = useState(null)
      const [sourceDialog, setSourceDialog] = useState(null)
      const [busy, setBusy] = useState(false)
      const [actionError, setActionError] = useState('')
      const [notice, setNotice] = useState('')
      const [preambleDraft, setPreambleDraft] = useState(null)
      const [previewOpen, setPreviewOpen] = useState(true)
      const [copied, setCopied] = useState(false)
      const [pluginFilter, setPluginFilter] = useState(null)
      const [dragKey, setDragKey] = useState('')
      const [dragOverKey, setDragOverKey] = useState('')
      // `null` is the global view; any other value manages that preset's
      // overrides. The Host answers with the flags seen from this view.
      const [presetView, setPresetView] = useState(null)
      const [translationDraft, setTranslationDraft] = useState(null)
      const [translatingKey, setTranslatingKey] = useState('')
      const [batchTranslating, setBatchTranslating] = useState(false)
      // The panel keeps one tab visible; `settings` holds the rarer knobs.
      const [tab, setTab] = useState('mine')
      // `{ key, message }` for the last failed translation so the card itself
      // can say why nothing changed.
      const [translateError, setTranslateError] = useState(null)

      const refresh = useCallback(async () => {
        try {
          const data = await unwrap(api().overview(presetView === null ? {} : { preset: presetView }))
          setState({
            loading: false,
            error: '',
            sources: data.sources ?? [],
            prompts: data.prompts ?? [],
            preamble: data.preamble ?? '',
            plugins: data.plugins ?? [],
            presets: data.presets ?? [],
            enabled: data.enabled !== false,
            translation: data.translation ?? { targetLanguage: 'zh-CN', provider: '', model: '' },
            languages: data.languages ?? [],
            llm: data.llm ?? { available: false, providers: [] },
            presetViews: data.presetViews ?? [],
            presetDefinitions: data.presetDefinitions ?? [],
          })
          setPreambleDraft((previous) => (previous === null ? (data.preamble ?? '') : previous))
          setTranslationDraft((previous) => (previous === null
            ? (data.translation ?? { targetLanguage: 'zh-CN', provider: '', model: '' })
            : previous))
        } catch (error) {
          console.error('[prompt-manager] overview failed', error)
          setState((prev) => ({ ...prev, loading: false, error: error?.message ?? String(error) }))
        }
      }, [api, presetView])

      useEffect(() => {
        refresh()
      }, [refresh])

      const run = useCallback(async (operation) => {
        setBusy(true)
        setActionError('')
        try {
          const value = await operation()
          await refresh()
          return value === undefined ? true : value
        } catch (error) {
          console.error('[prompt-manager] operation failed', error)
          // Never fail silently: a swallowed error looks like an unresponsive UI.
          setActionError(error?.message ?? String(error))
          return error
        } finally {
          setBusy(false)
        }
      }, [refresh])

      // A disabled plugin injects nothing, so the preview must show nothing
      // rather than the flags that would apply once it is enabled again.
      const injected = useMemo(
        () => (state.enabled === false
          ? []
          : state.prompts.filter((prompt) => prompt.injectable !== false && prompt.inject)),
        [state.prompts, state.enabled],
      )
      const injectedText = useMemo(
        () => (state.enabled === false ? '' : composeInjected(state.prompts, state.preamble)),
        [state.prompts, state.preamble, state.enabled],
      )

      const savePreamble = useCallback(async (text) => {
        setBusy(true)
        setActionError('')
        try {
          const value = await unwrap(api().setPreamble({ text }))
          await refresh()
          setPreambleDraft(value?.preamble ?? '')
          setNotice(t('preview.preambleSaved'))
          setTimeout(() => setNotice(''), 3000)
        } catch (error) {
          console.error('[prompt-manager] saving the lead-in failed', error)
          setActionError(withRestartHint(error?.message ?? String(error), t))
        } finally {
          setBusy(false)
        }
      }, [api, refresh, t])

      const toggleInjection = useCallback(async () => {
        await run(() => unwrap(api().setEnabled({ enabled: !state.enabled })))
        setNotice(t(state.enabled ? 'inject.off' : 'inject.on'))
        setTimeout(() => setNotice(''), 3000)
      }, [api, run, state.enabled, t])

      const saveTranslationSettings = useCallback(async (values) => {
        await run(() => unwrap(api().setTranslationSettings(values)))
        setNotice(t('translate.saved'))
        setTimeout(() => setNotice(''), 3000)
      }, [api, run, t])

      const untranslatedCount = useMemo(
        () => state.prompts.filter((prompt) => !prompt.translation && prompt.content).length,
        [state.prompts],
      )

      // Batch translation runs one request per prompt so a single failure keeps
      // the rest and the page can report how many made it.
      const translateAll = useCallback(async () => {
        setBatchTranslating(true)
        setActionError('')
        let done = 0
        let failed = 0
        let firstError = ''
        try {
          for (const prompt of state.prompts) {
            if (prompt.translation || !prompt.content) continue
            try {
              await unwrap(api().translatePrompt({ key: prompt.key }))
              done += 1
            } catch (error) {
              failed += 1
              if (!firstError) firstError = error?.message ?? String(error)
              console.error('[prompt-manager] batch translation failed for', prompt.key, error)
            }
          }
          await refresh()
          if (failed > 0) {
            setActionError(t('translate.batchFailed', { done: String(done), failed: String(failed), message: firstError }))
          } else {
            setNotice(t('translate.batchDone', { count: String(done) }))
            setTimeout(() => setNotice(''), 4000)
          }
        } finally {
          setBatchTranslating(false)
        }
      }, [api, refresh, state.prompts, t])

      const importDsh = useCallback(async () => {
        setBusy(true)
        setActionError('')
        try {
          const value = await unwrap(api().importSystemPrompt())
          await refresh()
          setNotice(t('action.imported', { count: String(value?.imported ?? 0) }))
          setTimeout(() => setNotice(''), 4000)
        } catch (error) {
          console.error('[prompt-manager] import failed', error)
          setActionError(withRestartHint(error?.message ?? String(error), t))
        } finally {
          setBusy(false)
        }
      }, [api, refresh, t])

      // Filtering by plugin (chosen in the plugin panel) narrows the list. The
      // prompts are then split into the three zones a prompt can come from:
      // your own files, DSH first-party sections, and third-party plugin
      // sections; inside a zone they group by source and then by plugin.
      const visiblePrompts = useMemo(
        () => (pluginFilter ? state.prompts.filter((prompt) => prompt.plugin === pluginFilter) : state.prompts),
        [state.prompts, pluginFilter],
      )
      const zones = useMemo(() => {
        const result = { mine: [], system: [], plugin: [] }
        for (const prompt of visiblePrompts) {
          const zone = !prompt.plugin ? 'mine' : (prompt.builtin === true ? 'system' : 'plugin')
          result[zone].push(prompt)
        }
        return result
      }, [visiblePrompts])
      const buildGroups = useCallback((prompts) => {
        const bySource = new Map()
        for (const prompt of prompts) {
          const list = bySource.get(prompt.sourceId) ?? []
          list.push(prompt)
          bySource.set(prompt.sourceId, list)
        }
        return state.sources
          .map((source) => {
            const byPlugin = new Map()
            for (const prompt of bySource.get(source.id) ?? []) {
              const id = prompt.plugin ?? ''
              const bucket = byPlugin.get(id) ?? {
                id,
                label: id === '' ? t('plugin.untitled') : (prompt.pluginLabel ?? id),
                builtin: prompt.builtin === true,
                prompts: [],
              }
              bucket.prompts.push(prompt)
              byPlugin.set(id, bucket)
            }
            return { source, buckets: [...byPlugin.values()] }
          })
          .filter((group) => group.buckets.length > 0)
      }, [state.sources, t])
      const groups = useMemo(() => ({
        mine: buildGroups(zones.mine),
        system: buildGroups(zones.system),
        plugin: buildGroups(zones.plugin),
      }), [buildGroups, zones])

      const movePrompt = useCallback(async (fromKey, toKey) => {
        const keys = state.prompts.map((entry) => entry.key)
        const from = keys.indexOf(fromKey)
        const to = keys.indexOf(toKey)
        if (from < 0 || to < 0 || from === to) return
        const next = keys.slice()
        next.splice(from, 1)
        next.splice(to, 0, fromKey)
        await run(() => unwrap(api().reorder({ keys: next })))
      }, [api, run, state.prompts])

      const renderCard = (prompt) => h(PromptCard, {
        key: prompt.key,
        t,
        prompt,
        busy,
        presetView,
        translating: translatingKey === prompt.key,
        translateError: translateError?.key === prompt.key ? translateError.message : '',
        reorderable: true,
        dragging: dragKey === prompt.key,
        dragover: dragOverKey === prompt.key,
        onDragStart: (target, event) => {
          if (event?.dataTransfer?.setData) event.dataTransfer.setData('text/plain', target.key)
          setDragKey(target.key)
        },
        onDragOver: (target, event) => {
          if (event?.preventDefault) event.preventDefault()
          if (dragOverKey !== target.key) setDragOverKey(target.key)
        },
        onDrop: (target, event) => {
          if (event?.preventDefault) event.preventDefault()
          const from = dragKey
          setDragKey('')
          setDragOverKey('')
          if (from && from !== target.key) movePrompt(from, target.key)
        },
        onDragEnd: () => {
          setDragKey('')
          setDragOverKey('')
        },
        onEdit: (target) => setEditor({ initial: target }),
        onToggleInject: async (target) => {
          if (presetView === null) {
            await run(() => unwrap(api().update({ key: target.key, inject: !target.inject })))
          } else {
            await run(() => unwrap(api().setPresetInject({
              preset: presetView,
              key: target.key,
              inject: !target.inject,
            })))
          }
        },
        onClearOverride: async (target) => {
          await run(() => unwrap(api().setPresetInject({
            preset: presetView,
            key: target.key,
            inject: null,
          })))
        },
        onTranslate: async (target) => {
          setTranslatingKey(target.key)
          setTranslateError(null)
          try {
            const value = await run(() => unwrap(api().translatePrompt({ key: target.key })))
            if (value instanceof Error) {
              setTranslateError({ key: target.key, message: value.message ?? String(value) })
              return false
            }
            const skipped = value && value.skipped === true
            setNotice(skipped
              ? t('translate.skipped', { lang: state.translation?.targetLanguage ?? '' })
              : t('translate.done', { lang: state.translation?.targetLanguage ?? '' }))
            setTimeout(() => setNotice(''), 3000)
            return !skipped
          } finally {
            setTranslatingKey('')
          }
        },
        onClearTranslation: async (target) => {
          await run(() => unwrap(api().clearTranslation({ key: target.key })))
        },
        onToggleTranslation: async (target) => {
          await run(() => unwrap(api().setInjectTranslation({ key: target.key, enabled: target.injectTranslation !== true })))
        },
        onDelete: async (target) => {
          await run(() => unwrap(api().delete({ key: target.key })))
        },
      })

      const tabs = [
        { id: 'mine', label: t('tabs.mine'), count: zones.mine.length },
        { id: 'system', label: t('tabs.system'), count: zones.system.length },
        { id: 'plugin', label: t('tabs.plugin'), count: zones.plugin.length },
        { id: 'settings', label: t('tabs.settings'), count: null },
      ]

      // One zone = a heading, its explanation, its optional actions, then the
      // source→plugin groups. Zones stay visible even when empty so the user
      // can tell "nothing imported yet" from "filtered out".
      const renderZone = (title, description, zone, actions, emptyText) => h('div', { className: 'dshpm-zone' },
        h('div', { className: 'dshpm-zone-head' },
          h('h4', { className: 'dshpm-section-title' }, title),
          h('span', { className: 'dshpm-preview-spacer' }),
          actions),
        h('p', { className: 'dshpm-hint', style: { margin: '0 0 8px' } }, description),
        zone.length === 0
          ? h('div', { className: 'dshpm-empty' }, emptyText)
          : zone.map((group) => h('div', { key: group.source.id, className: 'dshpm-group' },
              h('p', { className: 'dshpm-group-title' }, group.source.path),
              group.buckets.map((bucket) => h('div', {
                key: bucket.id || 'own',
                className: 'dshpm-subgroup',
              },
                h('p', { className: 'dshpm-subgroup-title' },
                  h('span', null, bucket.label),
                  bucket.builtin && h(Badge, null, t('plugin.builtin')),
                  h(Badge, null, t('plugin.injected', {
                    injected: String(bucket.prompts.filter((prompt) => prompt.inject).length),
                    count: String(bucket.prompts.length),
                  }))),
                bucket.prompts.map(renderCard))))))

      return h('div', { className: 'dshpm-page' },
        h('style', null, css),
        h('div', { className: 'dshpm-inner' },
          h('div', { className: 'dshpm-header' },
            h('div', null,
              h('h2', { className: 'dshpm-title' }, t('panel.title')),
              h('p', { className: 'dshpm-subtitle' }, t('header.subtitle'))),
            h('div', { className: 'dshpm-actions' },
              h(Button, { outline: true, onClick: refresh, disabled: busy }, t('action.refresh')))),
          (actionError || state.error) && h('div', { className: 'dshpm-error' }, actionError || state.error),
          notice && h('div', { className: 'dshpm-notice' }, notice),
          h('div', { className: 'dshpm-status' },
            h(Badge, { kind: state.enabled ? 'inject' : undefined }, state.enabled ? t('inject.on') : t('inject.off')),
            h('span', { className: 'dshpm-status-label' },
              state.enabled ? t('status.injectOn', { count: String(injected.length) }) : t('status.injectOff')),
            h(Button, {
              outline: true,
              danger: state.enabled,
              primary: state.enabled === false,
              disabled: busy,
              onClick: toggleInjection,
            }, state.enabled ? t('inject.disable') : t('inject.enable'))),
          h('section', { className: 'dshpm-preview-dock' },
            h('div', { className: 'dshpm-preview-head' },
              h('h4', { className: 'dshpm-section-title' }, t('preview.title')),
              h(Badge, { kind: injected.length > 0 ? 'inject' : undefined }, t('preview.count', { count: String(injected.length) })),
              h('span', { className: 'dshpm-preview-spacer' }),
              previewOpen && injectedText !== '' && h(Button, {
                outline: true,
                onClick: async () => {
                  try {
                    await navigator.clipboard.writeText(injectedText)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch (error) {
                    setActionError(error?.message ?? String(error))
                  }
                },
              }, copied ? t('preview.copied') : t('preview.copy')),
              h(Button, { outline: true, onClick: () => setPreviewOpen((open) => !open) }, previewOpen ? t('preview.hide') : t('preview.show'))),
            previewOpen && h('div', null,
              h('div', { className: 'dshpm-field', style: { marginTop: '10px' } },
                h('span', { className: 'dshpm-field-label' }, t('preview.preambleLabel')),
                h('textarea', {
                  className: 'dshpm-textarea dshpm-preamble',
                  value: preambleDraft ?? '',
                  rows: 3,
                  placeholder: t('preview.preamblePlaceholder'),
                  onChange: (event) => setPreambleDraft(event.target.value),
                }),
                h('div', { className: 'dshpm-row', style: { marginTop: '6px' } },
                  h(Button, {
                    primary: true,
                    disabled: busy || preambleDraft === null || preambleDraft === (state.preamble ?? ''),
                    onClick: () => savePreamble(preambleDraft),
                  }, t('preview.preambleSave')),
                  h(Button, { outline: true, disabled: busy, onClick: () => savePreamble(null) }, t('preview.preambleReset')),
                  preambleDraft !== null && preambleDraft !== (state.preamble ?? '')
                    && h('span', { className: 'dshpm-hint' }, t('preview.preambleDirty')))),
              h('p', { className: 'dshpm-hint', style: { margin: '6px 0 0' } }, t('preview.hint')),
              h('pre', { className: 'dshpm-preview' }, injectedText === '' ? t('preview.empty') : injectedText),
              injected.length > 0 && h('div', null,
                h('p', { className: 'dshpm-hint', style: { margin: '8px 0 0' } }, t('preview.sources')),
                h('ul', { className: 'dshpm-inject-list' },
                  injected.map((prompt) => h('li', { key: prompt.key }, `${prompt.title} — ${prompt.sourcePath}`)))))),
          h('div', { className: 'dshpm-tabs' },
            tabs.map((entry) => h('button', {
              key: entry.id,
              type: 'button',
              className: `dshpm-tab${tab === entry.id ? ' dshpm-tab--active' : ''}`,
              onClick: () => setTab(entry.id),
            }, entry.label, entry.count === null ? null : h('span', { className: 'dshpm-tab-count' }, String(entry.count))))),
          tab === 'settings' && h('section', { className: 'dshpm-tab-panel' },
            h('h4', { className: 'dshpm-section-title' }, t('inject.title')),
            h('p', { className: 'dshpm-hint', style: { margin: '6px 0 0' } }, t('inject.hint')),
            h('p', { className: 'dshpm-hint', style: { margin: '4px 0 0' } }, t('inject.rules')),
            h('p', { className: 'dshpm-hint', style: { margin: '4px 0 0' } },
              state.enabled ? t('inject.count', { count: String(injected.length) }) : t('inject.disabledHint'))),
          tab === 'settings' && h('section', null,
            h('h4', { className: 'dshpm-section-title' }, t('sources.title')),
            state.sources.length === 0 && !state.loading && h('div', { className: 'dshpm-empty' }, t('sources.empty')),
            state.sources.map((source) => h(SourceRow, {
              key: source.id,
              t,
              source,
              busy,
              onRemove: async (target) => {
                await run(() => unwrap(api().removeSource({ id: target.id })))
              },
            }))),
          tab === 'plugin' && h('section', { className: 'dshpm-tab-panel' },
            h('h4', { className: 'dshpm-section-title' }, t('plugin.title')),
            h('p', { className: 'dshpm-hint', style: { margin: '0 0 8px' } }, t('plugin.hint')),
            state.plugins.length === 0
              ? (state.loading ? null : h('div', { className: 'dshpm-empty' }, t('plugin.empty')))
              : h('div', { className: 'dshpm-plugin-list' },
                  state.plugins.map((plugin) => h('div', {
                    key: plugin.id,
                    className: `dshpm-plugin${pluginFilter === plugin.id ? ' dshpm-plugin--active' : ''}`,
                  },
                    h('button', {
                      type: 'button',
                      className: 'dshpm-plugin-name',
                      onClick: () => setPluginFilter((current) => (current === plugin.id ? null : plugin.id)),
                    }, plugin.label),
                    plugin.builtin && h(Badge, null, t('plugin.builtin')),
                    h('span', { className: 'dshpm-plugin-meta' },
                      t('plugin.count', { count: String(plugin.count) }))))),
            pluginFilter !== null && h('div', { className: 'dshpm-row', style: { marginTop: '8px' } },
              h(Button, { outline: true, onClick: () => setPluginFilter(null) }, t('plugin.filterOff')))),
          tab === 'settings' && h('section', null,
            h('h4', { className: 'dshpm-section-title' }, t('preset.title')),
            h('p', { className: 'dshpm-hint', style: { margin: '0 0 8px' } }, t('preset.hint')),
            state.presets.length === 0
              ? (state.loading ? null : h('div', { className: 'dshpm-empty' }, t('preset.empty')))
              : h('div', { className: 'dshpm-plugin-list' },
                  [{ id: null, name: t('preset.global'), default: true, overridden: 0, broken: false }]
                    .concat(state.presets)
                    .map((preset) => h('div', {
                      key: preset.id === null ? '__global' : preset.id,
                      className: `dshpm-plugin${presetView === preset.id ? ' dshpm-plugin--active' : ''}`,
                    },
                      h('button', {
                        type: 'button',
                        className: 'dshpm-plugin-name',
                        onClick: () => setPresetView(preset.id),
                      }, preset.name || preset.id),
                      preset.id !== null && preset.default && h(Badge, null, t('preset.default')),
                      preset.broken && h(Badge, null, t('preset.broken')),
                      h('span', { className: 'dshpm-plugin-meta' },
                        preset.id === null
                          ? ''
                          : t('preset.overridden', { count: String(preset.overridden ?? 0) })))))),
          presetView !== null && h('p', { className: 'dshpm-hint', style: { margin: '8px 0 0' } },
            t('preset.active', { name: (state.presets.find((p) => p.id === presetView) ?? {}).name || presetView })),
          tab === 'settings' && h('section', { className: 'dshpm-tab-panel' },
            h('h4', { className: 'dshpm-section-title' }, t('presetDefs.title')),
            h('p', { className: 'dshpm-hint', style: { margin: '0 0 8px' } }, t('presetDefs.hint')),
            state.presetDefinitions.length === 0 && h('div', { className: 'dshpm-empty' }, t('presetDefs.empty')),
            state.presetDefinitions.map((definition) => {
              const view = state.presetViews.find((candidate) => candidate.preset === definition.preset)
              const runtime = view?.sections ?? []
              const total = definition.entries.length + runtime.length
              return h('details', {
                key: 'def-' + definition.preset,
                className: 'dshpm-preset-view',
                open: presetView === definition.preset,
              },
                h('summary', null,
                  h('span', { className: 'dshpm-preset-name' }, definition.presetName || definition.preset),
                  total === 0
                    ? h(Badge, null, t('presetDefs.none'))
                    : h(Badge, null, t('presetDefs.count', { count: String(total) }))),
                definition.entries.map((entry) => h('div', {
                  key: 'decl-' + (entry.entryId || entry.moduleName || 'entry'),
                  className: 'dshpm-preset-section',
                },
                  h('div', { className: 'dshpm-preset-section-head' },
                    h('code', null, entry.moduleName || entry.entryId || '?'),
                    entry.entryId && h('span', { className: 'dshpm-hint' }, entry.entryId)),
                  entry.texts.map((item) => h('pre', {
                    key: item.key,
                    className: 'dshpm-preview',
                  }, item.key + ':\n' + item.value)))),
                runtime.length > 0 && h('p', { className: 'dshpm-preset-section-head' },
                  t('presetView.runtimeHead', { time: new Date(view.at).toLocaleString() })),
                runtime.map((section) => h('div', {
                  key: 'run-' + section.name,
                  className: 'dshpm-preset-section',
                },
                  h('div', { className: 'dshpm-preset-section-head' },
                    h('code', null, section.name),
                    section.order !== null && h('span', { className: 'dshpm-hint' }, 'order ' + section.order),
                    h('span', { className: 'dshpm-hint' }, section.pluginLabel ?? section.plugin)),
                  h('pre', { className: 'dshpm-preview' }, section.text))))
            })),
          tab === 'settings' && h('section', { className: 'dshpm-tab-panel' },
            h('div', { className: 'dshpm-zone-head' },
              h('h4', { className: 'dshpm-section-title' }, t('translate.title')),
              h('span', { className: 'dshpm-preview-spacer' }),
              h(Button, {
                outline: true,
                disabled: busy || batchTranslating || untranslatedCount === 0,
                onClick: translateAll,
              }, batchTranslating
                ? t('translate.running')
                : t('translate.batch', { count: String(untranslatedCount) }))),
            h('p', { className: 'dshpm-hint', style: { margin: '0 0 8px' } }, t('translate.hint')),
            h('div', { className: 'dshpm-row', style: { alignItems: 'flex-end', marginTop: '4px' } },
              h('label', { className: 'dshpm-field', style: { margin: 0 } },
                h('span', { className: 'dshpm-field-label' }, t('translate.target')),
                h('select', {
                  className: 'dshpm-input',
                  value: (translationDraft ?? state.translation)?.targetLanguage ?? 'zh-CN',
                  onChange: (event) => setTranslationDraft((draft) => ({
                    ...(draft ?? state.translation ?? {}),
                    targetLanguage: event.target.value,
                  })),
                }, (state.languages.length > 0 ? state.languages : ['zh-CN'])
                  .map((lang) => h('option', { key: lang, value: lang }, lang)))),
              h('label', { className: 'dshpm-field', style: { margin: 0 } },
                h('span', { className: 'dshpm-field-label' }, t('translate.provider')),
                h('input', {
                  className: 'dshpm-input',
                  value: (translationDraft ?? state.translation)?.provider ?? '',
                  placeholder: 'deepseek',
                  onChange: (event) => setTranslationDraft((draft) => ({
                    ...(draft ?? state.translation ?? {}),
                    provider: event.target.value,
                  })),
                })),
              h('label', { className: 'dshpm-field', style: { margin: 0 } },
                h('span', { className: 'dshpm-field-label' }, t('translate.model')),
                h('input', {
                  className: 'dshpm-input',
                  value: (translationDraft ?? state.translation)?.model ?? '',
                  placeholder: 'deepseek-chat',
                  onChange: (event) => setTranslationDraft((draft) => ({
                    ...(draft ?? state.translation ?? {}),
                    model: event.target.value,
                  })),
                })),
              h(Button, {
                primary: true,
                disabled: busy || translationDraft === null,
                onClick: () => saveTranslationSettings(translationDraft),
              }, t('translate.save'))),
            h('p', { className: 'dshpm-hint', style: { margin: '6px 0 0' } }, t('translate.llmHint')),
            h('p', {
              className: 'dshpm-hint',
              style: { margin: '4px 0 0', color: state.llm.available ? undefined : 'var(--dsw-alias-state-error-primary)' },
            }, state.llm.available
              ? t('translate.llmAvailable', { providers: state.llm.providers.join(', ') })
              : t('translate.llmUnavailable'))),
          tab === 'mine' && renderZone(
            t('section.mine'),
            t('section.mineDesc'),
            groups.mine,
            h('div', { className: 'dshpm-actions' },
              h(Button, { outline: true, onClick: () => setSourceDialog({}), disabled: busy }, t('action.addSource')),
              h(Button, { primary: true, onClick: () => setEditor({}), disabled: busy }, t('action.new'))),
            pluginFilter ? t('plugin.emptyFilter') : t('prompts.empty'),
          ),
          tab === 'system' && renderZone(
            t('section.system'),
            t('section.systemDesc'),
            groups.system,
            h(Button, { outline: true, disabled: busy, title: t('action.importDshHint'), onClick: importDsh }, t('action.importDsh')),
            t('section.systemEmpty'),
          ),
          tab === 'plugin' && renderZone(
            t('section.plugin'),
            t('section.pluginDesc'),
            groups.plugin,
            h(Button, { outline: true, disabled: busy, title: t('action.importDshHint'), onClick: importDsh }, t('action.importDsh')),
            t('section.pluginEmpty'),
          ),
          editor && h(EditorDialog, {
            t,
            sources: state.sources,
            initial: editor.initial,
            presetName: presetView === null
              ? ''
              : ((state.presets.find((p) => p.id === presetView) ?? {}).name || presetView),
            saving: editor.saving === true,
            error: editor.error,
            onCancel: () => setEditor(null),
            onSave: async (values) => {
              setEditor((prev) => ({ ...prev, saving: true, error: undefined }))
              const failure = await run(() => {
                // Creating a prompt always writes it as a global default; a
                // preset view only ever patches the existing entry.
                if (!editor.initial?.key) {
                  return unwrap(api().create({ sourceId: values.sourceId, title: values.title, content: values.content, inject: values.inject }))
                }
                const preset = presetView === null ? {} : { preset: presetView }
                if (editor.initial.editableTitle === false) {
                  return unwrap(api().update({ key: editor.initial.key, content: values.content, inject: values.inject, ...preset }))
                }
                return unwrap(api().update({ key: editor.initial.key, title: values.title, content: values.content, inject: values.inject, ...preset }))
              })
              if (failure === true) setEditor(null)
              else setEditor((prev) => ({ ...prev, saving: false, error: failure?.message ?? 'failed' }))
            },
          }),
          sourceDialog && h(AddSourceDialog, {
            t,
            api,
            saving: sourceDialog.saving === true,
            error: sourceDialog.error,
            onCancel: () => setSourceDialog(null),
            onSave: async (values) => {
              setSourceDialog((prev) => ({ ...prev, saving: true, error: undefined }))
              const failure = await run(() => unwrap(api().addSource(values)))
              if (failure === true) setSourceDialog(null)
              else setSourceDialog((prev) => ({ ...prev, saving: false, error: failure?.message ?? 'failed' }))
            },
          })))
    }

    function PromptsIcon({ size = 16 }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': true,
      },
        h('rect', { x: 2, y: 1.5, width: 12, height: 13, rx: 2, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('path', { d: 'M4.5 5h7M4.5 8h7M4.5 11h4', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }))
    }

    return {
      inject: ['slots', 'locale', 'remote'],
      async apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'prompt-manager: locale')
        try {
          await ctx.remote.$mount(TYPERT_REMOTE)
        } catch (error) {
          // A hot reload can activate a fresh fiber while an earlier mount is
          // still registered; that generation already serves the namespace.
          if (!String(error?.message ?? error).includes('already registered')) throw error
          console.warn('[prompt-manager] reusing the already-mounted Remote contribution')
        }
        const t = ctx.locale.bind(NS)
        const api = () => {
          // `ctx.get` reads without the inject requirement: the namespace is
          // mounted by this very plugin, so declaring it in `inject` would
          // deadlock activation waiting for a service we install ourselves.
          const namespace = ctx.get('remote.promptManager')
          if (!namespace) throw new Error('prompt-manager: Remote namespace unavailable (Host plugin inactive or mount failed)')
          return namespace
        }
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          locale: NS,
          label: () => t('panel.title'),
        }, PromptsIcon))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ t, api }),
        }, PromptManagerPage))
      },
    }
  },
})
