# Prompt Manager（提示词管理）

DSH 的提示词管理插件：文件驱动的提示词库 + Web UI 管理面板 + 可选的系统提示词注入。

## 功能

- **两种来源文件**：
  - `.json`：一个文件装多条提示词（`{ version, prompts: [...] }`）；
  - `.md` / `.markdown` / `.txt`：**一个文件即一条提示词**，标题取自文件里第一个 `# 标题`，注入开关记在本插件自己的 `state.json` 里，不会改动你的文件。
- **来源文件管理**：面板中可以看到每条提示词来自哪个文件，并带类型徽标（JSON / MD / TXT）。
  - 内置来源：`<DSH_PROFILE_DIR>/prompt-manager/prompts.json`（自动创建，不可移除）。
  - 外部来源：在面板中「添加来源文件」挂载任意 JSON 文件（持久化在 `<DSH_PROFILE_DIR>/prompt-manager/state.json`），或在插件 config 里声明。
- **提示词管理**：新建 / 编辑 / 删除提示词，就地修改标题、内容。
- **标题可改（包括导入的）**：每条提示词都能改显示标题——JSON 条目、`.md` / `.txt` 来源、以及从 DSH 抓下来的段都一样；自定义标题存进本插件的 `state.json`，不改你的文件，**重新导入 DSH 提示词也不会丢**。标题改回默认值即自动取消自定义标记。
- **按插件区分提示词（只有第三方插件段特殊）**：从 DSH 抓下来的每条都带来源插件信息（`checkpoint-rewind`、`dsh-context`、`harness`… 第一方固定段归为 `DSH`）。**DSH 第一方段和本地提示词用同一种逻辑**：卡片上就是普通的「已注入 / 未注入」开关，开启时由本插件写进系统提示词——原段会先被 assembly waterfall 从 DSH 的拼装结果里摘掉，不会重复。**只有第三方插件注册的段特殊**：它们由各自的插件注入，本插件只展示、翻译，并在卡片上标出「注入条件」（由哪个插件注册、section 名、order、是否还在注册表里），不给注入开关。面板顶部「插件提示词」区可按插件筛选，提示词列表再按插件分子组。
- **系统提示词注入**：**本地提示词和 DSH 第一方段**都有「注入」开关，开启后内容会拼入所有会话的系统提示词（2 秒内生效，手动改文件也会在下一次组装时刷新）。第三方插件段不在此列。
- **按预设管理注入**：DSH 的 agent 预设（`standard` / `minimal` …）可以各自覆盖注入开关（本地提示词与 DSH 第一方段都可覆盖）。默认按「全局」值；选中某个预设后单独开关，只影响该预设下的会话，其它预设不受影响，随时可「继承」回全局。会话运行时按它实际使用的预设读取对应的一份。第三方插件段不参与这套覆盖。
- **注入总开关**：面板顶部「注入状态」独立栏位显示本插件当前是否向系统提示词注入，可一键启用 / 停用。停用后 DSH 组装系统提示词时本插件的段为空，管理、编辑、翻译等功能全部照常；状态存 `state.json` 的 `enabled`。栏位里同时写明注入时机与拼接规则。
- **注入前言可改**：注入块开头那句"以下是我的常驻要求…"是可编辑的设置（存于 `state.json` 的 `preamble`）：可改成任意文字、**清空则完全不输出前言**、「恢复默认」还原英文原文；改完保存后预览立即同步。
- **按来源分 tab**：提示词列表按来源拆成「我的提示词」「系统提示词」「插件提示词」三个 tab，面板不再是超长单页；注入状态、来源文件、注入预设、翻译设置收进「设置」tab。**注入预览不放进 tab**：它常驻在 tabs 上方、默认展开，切到任何 tab 都能看到，随页面正常滚动（不固定在顶部），方便边改提示词边对结果。新建 / 添加来源在「我的」tab，导入 DSH 按钮在系统与插件 tab。
- **提示词翻译**：每条提示词可一键翻译成目标语言（默认中文，可选 `zh-CN` / `zh-TW` / `en` / `ja` / `ko` / `fr` / `de` / `es` / `ru`，也可指定 provider / model）。译文存在 `state.json` 的 `translations` 里，**不改来源文件**；默认注入仍用原文，卡片上的「注入原文 / 注入译文」可以在译文生成后切换成**注入译文**（选择存在 `state.json` 的 `injectTranslations`）；**翻译成功后卡片自动切到译文视图**，也可「看原文」切回，或「清除译文」；源文本已经是目标语言时会明确提示「无需翻译」而不是假装翻译过。**翻译失败时错误直接显示在卡片上**（不再只是顶部一闪而过的提示），设置 tab 也会显示当前 profile 里检测到的 LLM 服务，方便判断是不是没有可用 provider。也能「翻译全部」，失败条目数会汇总提示。翻译指令要求逐段对应、保持 Markdown 结构（标题层级、列表、表格、代码块、占位符不译），译文写入后还会比对代码围栏 / 标题 / 表格行数，结构对不上时在卡片上提示「格式可能不一致」，不会静默放过。
- **拖动排序**：卡片可以直接拖动调整顺序（同区内拖动即可），顺序存进 `state.json` 的 `order`，**系统提示词注入按这个顺序拼接**；没排过序的提示词保持文件顺序排在后面，删除提示词会自动清掉它的排序项。
- **装好就有 DSH 自己的提示词**：首次打开面板时抓取当前真实拼装出的系统提示词各段，按段写入内置文件（标题 `DSH · <段名>`，并解析出所属插件）。**DSH 第一方段默认开启注入，由本插件接管**——它们的原段会先被从 DSH 的拼装结果里摘掉，再由本插件按开关重新写入，所以不会重复；第三方插件段只展示、翻译、查看注入条件。插件自己的 `prompt-manager` 段不会被抓取。
- **随时重新抓取**：面板右上角「导入 DSH 提示词」重新快照一次；只替换 `origin: dsh-system-prompt` 的条目，**你自己的提示词不会被覆盖，已改过的标题、注入开关也会保留**。
- **只读来源**：外部文件可标记为只读，只展示不允许修改。

## 来源文件格式

```json
{
  "version": 1,
  "prompts": [
    {
      "id": "uuid",
      "title": "标题",
      "content": "提示词内容",
      "inject": true,
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

## 使用方法

1. 左侧栏点「提示词」图标（文档样式）进入管理面板。
2. 面板分四个 tab（顶部切换，tab 上带条数），顶部状态条始终显示「注入 N 条」和启用 / 停用按钮：
   - **我的提示词**：新建 / 添加来源，拖拽排序，你自己的卡片；每条显示标题（改过会带「自定义」徽标）、内容预览、更新时间、翻译 / 编辑 / 删除。
   - **系统提示词**：DSH 第一方固定段。卡片上是普通的「已注入 / 未注入」开关，和本地提示词一致；也能翻译、拖拽排序。
   - **插件提示词**：其它插件注册的段，由各自的插件注入。卡片上只有「由 xxx 注入」徽标和「注入条件」，没有注入开关；可翻译。这一 tab 还带按插件筛选。
   - **设置**：注入规则说明、来源文件（每条来源的路径 / 条数 / 移除）、注入预设、预设声明的提示词（读 `agentPresets.readDocument`，按预设折叠）、预设自带的提示词（只读快照）、翻译设置（目标语言、provider / model、当前 profile 可用的 LLM 服务、翻译全部）。
   - **注入预览（常驻，不在 tab 里）**：tabs 上方一块，默认展开、可收起，随页面滚动，不遮挡提示词列表。显示当前视角下实际会拼进系统提示词的完整文本、注入条数、来源清单，并可直接编辑注入前言，改提示词后立即反映。
3. 常用操作：
   - **新建提示词**：右上角「新建提示词」→ 选来源文件、填标题/内容 → 保存。第一条保存时若无文件会自动创建。
   - **编辑 / 删除**：在提示词卡片右下角；删除需要点两次确认。
   - **注入系统提示词**：你自己的提示词卡片上有「未注入 / 已注入」按钮，开启后内容会拼进所有会话的系统提示词，下次组装即可见。DSH 段与其它插件段的卡片不显示这个开关，只显示「由 xxx 注入」。
   - **调整注入顺序**：直接拖动卡片到目标位置。顺序保存在 `state.json` 的 `order`，注入文本和面板列表都按这个顺序；新建的提示词默认排在最后。
   - **翻译**：点卡片上的「翻译」；成功后卡片自动显示译文（再点「看原文」切回）。源文本已经是目标语言时会提示无需翻译，「清除译文」只删译文不动原文。
   - **注入译文**：译文生成后，卡片上多出「注入原文 / 注入译文」开关。切到「注入译文」后，本插件注入系统提示词时用译文替换原文（标题仍用原标题），注入预览同步变化；关闭即恢复原文。清除译文会一并取消这个选择。
   - **按预设覆盖注入**：先在「注入预设」区选中一个预设，再点你自己提示词的注入按钮——这次改动只落在这个预设上，卡片会多出一枚「继承」按钮，点它清除覆盖、回到全局值。编辑弹窗里的注入复选框也会注明「只对 xxx 预设生效」。DSH 段不参与覆盖。
   - **翻译一条提示词**：卡片右下角「翻译」→ 调用 LLM 生成目标语言译文，卡片出现「译文」徽标；「看译文 / 看原文」切换预览，「清除译文」删掉它。只读条目和 DSH 段也能翻译（译文不写来源文件）。
   - **停用整个插件**：「注入状态」区点「停用注入」，本插件不再向系统提示词注入任何内容；再点「启用注入」恢复。
   - **添加外部来源文件**：右上角「添加来源文件」→ 点「浏览…」展开**应用内文件浏览器**：点目录进入、`↑` 返回上级、点文件即选中（只列出 `.json` / `.md` / `.txt`）。也可在下方输入新文件名（如 `my-prompt.md`）后点「使用该文件名」，或直接粘贴绝对路径 → 可选「只读」→ 添加。
4. 直接改文件也可以：面板「刷新」后即读到最新内容；系统提示词注入最多 2 秒后自动刷新。

## DSH 自带提示词（首次播种）

- 触发时机：**首次打开面板**（`overview` 调用）而不是插件激活时，确保所有系统提示词段都已注册完毕。
- 每段生成一条：`title = DSH · <section 名>`，`content = 该段原文`，`inject = true`，并带 `origin: "dsh-system-prompt"` 标记和来源插件（`plugin` / `pluginLabel` / `builtin`）。段名形如 `<plugin>:<section>` 时取前缀为插件；`HARNESS_IDENTITY`、`deployment:*`、`harness:*`、`app:*`、`ui:*` 等第一方段归为 `DSH`。
- 空白段落跳过；如果内置文件里已经有你自己的提示词，**播种会跳过**，不覆盖。
- 它是**快照**而不是实时引用：DSH 升级或改了提示词后，点「导入 DSH 提示词」重新抓取。
- **DSH 第一方段（`builtin: true`）与本地提示词同一种注入方式**：卡片上就是普通注入开关，开启时由本插件写入系统提示词。实现上监听 DSH 官方的 `system-prompt/assemble` waterfall，把第一方段从 DSH 的拼装结果里摘掉（否则会和本插件的注入重复），不改任何插件的注册。
- **第三方插件段（`builtin: false`）只展示**：由各自的插件注入，卡片上只有内容、翻译和「注入条件」（插件、section 名、order、是否仍在注册表里），没有注入开关。

## 注入预设（DSH agent preset）

- 预设列表来自 DSH 的 `agentPresets` 服务：bundle 补丁里 `@deepseek-ai/dsh-agent-preset` 声明的预设，加上内置的 `standard` / `minimal` / `ptc` / `cordis`。`~/.dsh/.agent-presets/` 目录已废弃，不再读取。
- 数据只存**覆盖**：`state.json` 的 `presets.<presetId>.<sourceId/promptId> = true|false`。没有覆盖时继承全局 `inject`；把覆盖设成与全局相同会自动删除该条。覆盖只对**你自己的提示词**生效，DSH 段与其它插件段不参与（给它们写覆盖会被 Host 拒绝）。
- 注入文本按预设各渲染一份缓存；会话组装系统提示词时，用该 agent 的 `ctx` 查 `composedPreset` 得到预设 id，取对应的一份（取不到就用全局）。每次拼装还会按预设记录一份原始段快照（见上节「预设自带的提示词」）。
- 该 profile 没有注册 `agentPresets`（如 headless）时自动降级：面板只显示「默认（全局）」，所有会话都按全局注入。
- 预设列表里已消失但还残留覆盖的预设会以「已移除」徽标保留一行，方便你清掉旧数据。

### 预设声明的提示词（设置 tab，配置角度）

除了运行时快照，本插件还直接读配置：DSH 的 `agentPresets.readDocument(id)` 会把一个预设声明的插件列表渲染成 YAML（`dump(..., { lineWidth: -1 })`），里面的 `persona.prefix` / `plan-mode.section` 就是该预设独有的提示词。设置 tab 的「预设声明的提示词」区按预设折叠展示这些行：插件名、条目 id、以及白名单里的文本键（`prefix` / `suffix` / `section` / `prompt` / `instructions` / `content` / `text` / `rules` / `template` / `message`）；`maxBytes`、`disabled` 这类非文本配置不显示。

这条路径**不需要该预设跑过**，打开面板就有数据，适合检查「某个预设到底改了什么提示词」。解析器是内置的（没有引入 YAML 依赖）：支持 `- id` / `name` / `config:` 三行结构、单双引号标量、`|` `|-` `|+` `>` `>-` `>+` 块标量，遇到非白名单键直接跳过。headless profile 或没有 `agentPresets` 服务时该区显示「读不到预设声明」。

### 预设的提示词（设置 tab）

每个预设的提示词从两个角度展示，合并在同一个区里，按预设折叠：

- **声明的提示词**（配置角度）：直接读 `agentPresets.readDocument(id)` 返回的插件声明 YAML，例如 `persona.prefix`、`plan-mode.section`。这条路径**不需要该预设跑过**，打开面板就有数据。解析器内置（无 YAML 依赖）：支持 `- id` / `name` / `config:` 结构、单双引号、`|` `|-` `|+` `>` `>-` `>+` 块标量，只取白名单文本键（`prefix` / `suffix` / `section` / `prompt` / `instructions` / `content` / `text` / `rules` / `template` / `message`）。
- **运行时实际注册的段**（快照角度）：该预设的 agent 真正组装系统提示词时注册过的段（`presetViews`，由 `system-prompt/assemble` waterfall 顺带记录），能补上配置里看不出来的段（例如第三方插件在 agent 作用域注册的 persona 段）。只有该预设的会话发起过请求后才有数据；没有就只显示声明部分，不占位。

两段都是只读展示，不参与注入开关。

## 文本来源（.md / .txt）的约定

- 整个文件就是一条提示词；标题 = 第一个 `# 标题`（没有标题行则用文件名）。
- 编辑保存时**按原文写回**，不改动你的排版；默认标题取自标题行，但可以在编辑弹窗里改成任意显示名（只写进本插件的 `state.json`，留空或点「恢复默认」即回到文件里的标题）。
- 文本来源不提供「新建提示词」和「删除提示词」——一个文件就是一条；要管理多条请用 `.json` 来源，或用「移除」解除挂载。
- 注入开关存在 `<DSH_PROFILE_DIR>/prompt-manager/state.json` 的 `inject` 映射里（按绝对路径），移除来源时会一并清掉。

## 数据位置

- 内置来源：`<DSH_PROFILE_DIR>/prompt-manager/prompts.json`
- 外部来源挂载记录、前言、自定义标题、手工排序、按预设的注入覆盖、总开关、翻译设置与译文、旧版屏蔽列表的迁移标记：`<DSH_PROFILE_DIR>/prompt-manager/state.json`（`sources` / `inject` / `preamble` / `titles` / `order` / `presets` / `seededSystemPrompt` / `sectionFlagsMigrated` / `enabled` / `translation` / `translations` / `injectTranslations`）。`enabled` 只在关闭时写入，`translation` 只在非默认时写入；旧版 `muted` 会在首次打开面板时一次性迁移进各段的 `inject` 开关并删除。
- 单个来源文件格式：

```json
{ "version": 1, "prompts": [ { "id": "uuid", "title": "标题", "content": "内容", "inject": true, "updatedAt": "ISO 时间" } ] }
```

## 变更 Host 代码后需要重启

Client 改动（client.js）刷新页面即可；Host 改动（index.js，例如新增 Remote 方法）必须重启 DSH，Node 的 ESM 缓存不会热替换已加载的模块。

## 插件 Config（可选）

在 profile 的 patch 层里给 `prompt-manager` 行加 config 可预声明外部来源：

```yaml
- override:
    - id: prompt-manager
      config:
        sources:
          - path: /absolute/path/to/prompts.json
            readonly: false
```

## 架构

- `index.js`（Host）：`promptManager` 服务通过 Typert Gateway 暴露 `overview / create / update / delete / addSource / removeSource / listDir / importSystemPrompt / setPluginInject / setPresetInject / setPreamble / setEnabled / translatePrompt / clearTranslation / setInjectTranslation / setTranslationSettings / reorder` 十七个 Remote 方法（SRC 模式，免生成描述符）；通过 `ctx.systemPrompt.section()` 注入已开启的提示词，`text` 回调拿到当前 agent 的 ctx 以选取预设视角。`overview` 额外返回 `plugins`、`presets`、`presetViews`（按预设的原始段快照）、`presetDefinitions`（每个预设的插件声明 YAML 与解析出的提示词条目）、`enabled`、`translation`、`languages`、`llm`（`{ available, providers }`，排除 `lingshu-whitebox`），并接受 `{ preset }` 参数返回该预设视角下的有效注入值（`inject` / `baseInject` / `presetOverride`）与每条提示词的 `translation` / `injectTranslation` / `injectContent`（`injectContent` 是实际会写进系统提示词的正文：开了注入译文就是译文）。`translatePrompt` 会把 adapter 的终止块（`{ type: 'finish', reason: { kind: 'error' } }`）还原成带错误码的异常，并把最近一次失败写到 `last-translate-error.json`；译文结构对不上时在 `translations[key].warnings` 里返回差异。从 DSH 抓来的段带 `condition: { order, registered, builtin, section, managed }`：`builtin: true` 的第一方段 `injectable: true`，用普通 `inject` 开关（默认开启）；`builtin: false` 的第三方段 `injectable: false`、`inject` 恒为 `false`。Host 在 `system-prompt/assemble` waterfall 里无条件摘掉所有第一方段，再由自己的 section 按开关重新写入，避免重复；`setPluginInject` 保留为兼容空实现（返回 `changed: 0`）；`reorder({ keys })` 保存手工排序（写 `state.order`，`overview` 与注入文本都按它排序，未知 key 自动丢弃）。
- 翻译调用 profile 的 `llm` 服务：优先用设置里的 provider / model，否则取第一个可用 provider；分片里 `type === 'reasoning-delta'` 的内容会被丢弃，译文裁剪后为空即报错。
- `client.js`（Web）：`ctx.remote.$mount()` 挂载 Remote 描述符，注册左侧栏面板（`sidebar.panellist` + `main` 插槽），样式只用 `--dsw-alias-*` 主题令牌。面板按 tab 渲染：`tab` state 决定渲染哪一块；顶部状态条、tab 行、**注入预览 dock**（默认展开、随页面滚动）三者在 tabs 之外常驻。

## 已知限制

- 应用内文件浏览器由插件自己的 Host 方法 `listDir` 提供（只列 `.json` / `.md` / `.markdown` / `.txt`，隐藏点文件），因此**改动 Host 代码后必须重启 DSH**。
- 宿主 `remote.directoryPicker` 在本 profile 只提供 `native` 能力（系统目录对话框），无法用于应用内列目录；插件因此不依赖它。
- 通过 `ctx.get("remote.promptManager")` 读取自己挂载的命名空间：点号服务名不能写进 `inject`，否则激活会等待一个由自己创建的服务而死锁。
- 翻译依赖当前 profile 的 `llm` 服务与可用 provider；headless 等没有该服务的 profile 上，翻译按钮会返回明确错误（插件其余功能不受影响）。
- 翻译失败时，卡片上会直接显示 provider 返回的错误码与信息；同一条错误也会写到 `<DSH_PROFILE_DIR>/prompt-manager/last-translate-error.json`，方便本地排查（不会写入你的 `state.json`）。
- 翻译的模型选择顺序：翻译设置里手填的 model → `listProviders()` 返回的 provider.model → 问 adapter 要模型目录（`listModels`）取第一项。都没有时会在卡片上报「no model available for translation; set one in translation settings」，这时在翻译设置的 model 输入框里填上真实模型名（如 `deepseek-flash`）即可。
