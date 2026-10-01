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
      'editor.textTitleHint': '标题取自文件里的第一个「# 标题」；直接编辑下方内容即可',
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
      'editor.textTitleHint': 'The title comes from the file\u2019s first “# heading”; edit the content below',
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
        descriptor('overview', []),
        descriptor('create', [requestParam('create')]),
        descriptor('update', [requestParam('update')]),
        // `remove` collides with the Client namespace service's own member.
        descriptor('delete', [requestParam('delete')]),
        descriptor('addSource', [requestParam('addSource')]),
        descriptor('removeSource', [requestParam('removeSource')]),
        descriptor('listDir', [requestParam('listDir')]),
        descriptor('importSystemPrompt', []),
        descriptor('setPreamble', [requestParam('setPreamble')]),
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
.dshpm-card-head { display: flex; align-items: center; gap: 8px; }
.dshpm-card-title { font-weight: 600; flex: 1; word-break: break-all; }
.dshpm-card-preview { color: var(--dsw-alias-label-secondary); margin: 6px 0 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; word-break: break-word; }
.dshpm-card-foot { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.dshpm-card-meta { color: var(--dsw-alias-label-tertiary); font-size: 12px; flex: 1; }
.dshpm-group { margin-bottom: 16px; }
.dshpm-group-title { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--dsw-alias-label-secondary); margin: 0 0 8px; word-break: break-all; }
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
.dshpm-hint { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }

/* Final injected text, exactly as the system-prompt section renders it. */
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
.dshpm-browser-empty { padding: 10px 12px; color: var(--dsw-alias-label-tertiary); font-size: 12.5px; }
.dshpm-browser-error { padding: 10px 12px; color: var(--dsw-alias-state-error-primary); font-size: 12.5px; line-height: 18px; word-break: break-word; }
.dshpm-browser-block { display: flex; flex-direction: column; gap: 6px; }

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
      const active = prompts.filter((prompt) => prompt.inject)
      if (active.length === 0) return ''
      const body = active.map((prompt) => `## ${prompt.title}\n\n${prompt.content}`)
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
      // A text source holds one prompt whose title is its first heading, so it
      // cannot host new prompts and its title is not editable.
      const isText = props.initial?.editableTitle === false
      const writable = sources.filter((s) => !s.readonly && s.kind !== 'text')
      const save = () => {
        if (!isText && !title.trim()) {
          setLocalError(t('editor.titleRequired'))
          return
        }
        props.onSave({ title: title.trim(), content, inject, sourceId })
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
          isText
            ? h('p', { className: 'dshpm-hint' }, t('editor.textTitleHint'))
            : h('label', { className: 'dshpm-field' },
                h('span', { className: 'dshpm-field-label' }, t('editor.fieldTitle')),
                h('input', {
                  className: 'dshpm-input',
                  value: title,
                  autoFocus: true,
                  onChange: (e) => setTitle(e.target.value),
                })),
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
            t('editor.fieldInject')),
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
      useEffect(() => {
        if (!confirming) return undefined
        const timer = setTimeout(() => setConfirming(false), 3000)
        return () => clearTimeout(timer)
      }, [confirming])
      const updated = prompt.updatedAt ? new Date(prompt.updatedAt).toLocaleString() : ''
      const injectChip = h('button', {
        type: 'button',
        className: `dshpm-toggle${prompt.inject ? ' dshpm-toggle--on' : ''}`,
        disabled: props.busy || prompt.readonly,
        title: t('prompt.inject.hint'),
        onClick: () => props.onToggleInject(prompt),
      }, prompt.inject ? t('prompt.inject.on') : t('prompt.inject.off'))
      const openEditor = prompt.readonly ? undefined : () => props.onEdit(prompt)
      return h('div', { className: 'dshpm-card' },
        h('div', { className: 'dshpm-card-head' },
          h('span', {
            className: `dshpm-card-title${openEditor ? ' dshpm-clickable' : ''}`,
            title: openEditor ? t('prompt.editHint') : undefined,
            onClick: openEditor,
          }, prompt.title),
          prompt.origin === 'dsh-system-prompt' && h(Badge, null, t('prompt.originDsh')),
          injectChip),
        prompt.content && h('p', {
          className: `dshpm-card-preview${openEditor ? ' dshpm-clickable' : ''}`,
          title: openEditor ? t('prompt.editHint') : undefined,
          onClick: openEditor,
        }, prompt.content),
        h('div', { className: 'dshpm-card-foot' },
          h('span', { className: 'dshpm-card-meta' }, updated ? t('prompt.updated', { time: updated }) : ''),
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
      const [state, setState] = useState({ loading: true, error: '', sources: [], prompts: [] })
      const [editor, setEditor] = useState(null)
      const [sourceDialog, setSourceDialog] = useState(null)
      const [busy, setBusy] = useState(false)
      const [actionError, setActionError] = useState('')
      const [notice, setNotice] = useState('')
      const [preambleDraft, setPreambleDraft] = useState(null)
      const [previewOpen, setPreviewOpen] = useState(false)
      const [copied, setCopied] = useState(false)

      const refresh = useCallback(async () => {
        try {
          const data = await unwrap(api().overview())
          setState({
            loading: false,
            error: '',
            sources: data.sources ?? [],
            prompts: data.prompts ?? [],
            preamble: data.preamble ?? '',
          })
          setPreambleDraft((previous) => (previous === null ? (data.preamble ?? '') : previous))
        } catch (error) {
          console.error('[prompt-manager] overview failed', error)
          setState((prev) => ({ ...prev, loading: false, error: error?.message ?? String(error) }))
        }
      }, [api])

      useEffect(() => {
        refresh()
      }, [refresh])

      const run = useCallback(async (operation) => {
        setBusy(true)
        setActionError('')
        try {
          await operation()
          await refresh()
          return true
        } catch (error) {
          console.error('[prompt-manager] operation failed', error)
          // Never fail silently: a swallowed error looks like an unresponsive UI.
          setActionError(error?.message ?? String(error))
          return error
        } finally {
          setBusy(false)
        }
      }, [refresh])

      const injected = useMemo(() => state.prompts.filter((prompt) => prompt.inject), [state.prompts])
      const injectedText = useMemo(
        () => composeInjected(state.prompts, state.preamble),
        [state.prompts, state.preamble],
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

      const groups = useMemo(() => {
        const bySource = new Map()
        for (const prompt of state.prompts) {
          const list = bySource.get(prompt.sourceId) ?? []
          list.push(prompt)
          bySource.set(prompt.sourceId, list)
        }
        return state.sources
          .map((source) => ({ source, prompts: bySource.get(source.id) ?? [] }))
          .filter((group) => group.prompts.length > 0)
      }, [state])

      return h('div', { className: 'dshpm-page' },
        h('style', null, css),
        h('div', { className: 'dshpm-inner' },
          h('div', { className: 'dshpm-header' },
            h('div', null,
              h('h2', { className: 'dshpm-title' }, t('panel.title')),
              h('p', { className: 'dshpm-subtitle' }, t('header.subtitle'))),
            h('div', { className: 'dshpm-actions' },
              h(Button, { outline: true, onClick: refresh, disabled: busy }, t('action.refresh')),
              h(Button, {
                outline: true,
                disabled: busy,
                title: t('action.importDshHint'),
                onClick: async () => {
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
                },
              }, t('action.importDsh')),
              h(Button, { outline: true, onClick: () => setSourceDialog({}), disabled: busy }, t('action.addSource')),
              h(Button, { primary: true, onClick: () => setEditor({}), disabled: busy }, t('action.new')))),
          (actionError || state.error) && h('div', { className: 'dshpm-error' }, actionError || state.error),
          notice && h('div', { className: 'dshpm-notice' }, notice),
          h('section', null,
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
          h('section', null,
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
          h('section', null,
            h('h4', { className: 'dshpm-section-title' }, t('prompts.title')),
            h('p', { className: 'dshpm-hint', style: { margin: '0 0 8px' } }, t('prompts.injectHint')),
            state.loading
              ? h('div', { className: 'dshpm-empty' }, t('state.loading'))
              : groups.length === 0
                ? h('div', { className: 'dshpm-empty' },
                    h('div', null, t('prompts.empty')),
                    h('div', { className: 'dshpm-hint', style: { marginTop: '8px' } },
                      t('prompts.emptyPath', { path: state.sources[0]?.path ?? '' })))
                : groups.map((group) => h('div', { key: group.source.id, className: 'dshpm-group' },
                    h('p', { className: 'dshpm-group-title' }, group.source.path),
                    group.prompts.map((prompt) => h(PromptCard, {
                      key: prompt.key,
                      t,
                      prompt,
                      busy,
                      onEdit: (target) => setEditor({ initial: target }),
                      onToggleInject: async (target) => {
                        await run(() => unwrap(api().update({ key: target.key, inject: !target.inject })))
                      },
                      onDelete: async (target) => {
                        await run(() => unwrap(api().delete({ key: target.key })))
                      },
                    })))))),
          editor && h(EditorDialog, {
            t,
            sources: state.sources,
            initial: editor.initial,
            saving: editor.saving === true,
            error: editor.error,
            onCancel: () => setEditor(null),
            onSave: async (values) => {
              setEditor((prev) => ({ ...prev, saving: true, error: undefined }))
              const failure = await run(() => {
                if (!editor.initial?.key) {
                  return unwrap(api().create({ sourceId: values.sourceId, title: values.title, content: values.content, inject: values.inject }))
                }
                if (editor.initial.editableTitle === false) {
                  return unwrap(api().update({ key: editor.initial.key, content: values.content, inject: values.inject }))
                }
                return unwrap(api().update({ key: editor.initial.key, title: values.title, content: values.content, inject: values.inject }))
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
          }))
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
