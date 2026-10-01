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
- **系统提示词注入**：每条提示词有「注入」开关，开启后其内容会拼入所有会话的系统提示词（2 秒内生效，手动改文件也会在下一次组装时刷新）。
- **注入前言可改**：注入块开头那句"以下是我的常驻要求…"是可编辑的设置（存于 `state.json` 的 `preamble`）：可改成任意文字、**清空则完全不输出前言**、「恢复默认」还原英文原文；改完保存后预览立即同步。
- **装好就有 DSH 自己的提示词**：首次打开面板时抓取当前真实拼装出的系统提示词各段，按段写入内置文件（标题 `DSH · <段名>`），默认**不开启注入**（DSH 自身已经注入它们，重复开启会产生重复内容）。
- **随时重新抓取**：面板右上角「导入 DSH 提示词」重新快照一次；只替换 `origin: dsh-system-prompt` 的条目，**你自己的提示词不会被覆盖**。
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
2. 面板分两块：
   - **来源文件**：显示每个 JSON 文件的路径、提示词条数；内置来源不可删除，外部来源可「移除」（只解除挂载，不动文件）。
   - **提示词列表**：按来源文件分组，每条显示标题、内容预览、更新时间。
3. 常用操作：
   - **新建提示词**：右上角「新建提示词」→ 选来源文件、填标题/内容 → 保存。第一条保存时若无文件会自动创建。
   - **编辑 / 删除**：在提示词卡片右下角；删除需要点两次确认。
   - **注入系统提示词**：点卡片上的「未注入 / 已注入」按钮切换。开启后内容会拼进所有会话的系统提示词，下次组装即可见。
   - **添加外部来源文件**：右上角「添加来源文件」→ 点「浏览…」展开**应用内文件浏览器**：点目录进入、`↑` 返回上级、点文件即选中（只列出 `.json` / `.md` / `.txt`）。也可在下方输入新文件名（如 `my-prompt.md`）后点「使用该文件名」，或直接粘贴绝对路径 → 可选「只读」→ 添加。
4. 直接改文件也可以：面板「刷新」后即读到最新内容；系统提示词注入最多 2 秒后自动刷新。

## DSH 自带提示词（首次播种）

- 触发时机：**首次打开面板**（`overview` 调用）而不是插件激活时，确保所有系统提示词段都已注册完毕。
- 每段生成一条：`title = DSH · <section 名>`，`content = 该段原文`，`inject = false`，并带 `origin: "dsh-system-prompt"` 标记（界面显示 `DSH` 徽标）。
- 空白段落跳过；如果内置文件里已经有你自己的提示词，**播种会跳过**，不覆盖。
- 它是**快照**而不是实时引用：DSH 升级或改了提示词后，点「导入 DSH 提示词」重新抓取。
- 想临时移除 DSH 自带段落对模型的影响：把该段 `inject` 保持关闭即可（我们不会干扰 DSH 自身的注入；只有你把某段的注入开关打开时，才会额外重复注入一次）。

## 文本来源（.md / .txt）的约定

- 整个文件就是一条提示词；标题 = 第一个 `# 标题`（没有标题行则用文件名）。
- 编辑保存时**按原文写回**，不改动你的排版；标题随你改的标题行自动更新，因此标题框在编辑弹窗里是只读的。
- 文本来源不提供「新建提示词」和「删除提示词」——一个文件就是一条；要管理多条请用 `.json` 来源，或用「移除」解除挂载。
- 注入开关存在 `<DSH_PROFILE_DIR>/prompt-manager/state.json` 的 `inject` 映射里（按绝对路径），移除来源时会一并清掉。

## 数据位置

- 内置来源：`<DSH_PROFILE_DIR>/prompt-manager/prompts.json`
- 外部来源挂载记录与前言：`<DSH_PROFILE_DIR>/prompt-manager/state.json`（`sources` / `inject` / `preamble` / `seededSystemPrompt`）
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

- `index.js`（Host）：`promptManager` 服务通过 Typert Gateway 暴露 `overview / create / update / delete / addSource / removeSource / listDir` 七个 Remote 方法（SRC 模式，免生成描述符）；通过 `ctx.systemPrompt.section()` 注入已开启的提示词。
- `client.js`（Web）：`ctx.remote.$mount()` 挂载 Remote 描述符，注册左侧栏面板（`sidebar.panellist` + `main` 插槽），样式只用 `--dsw-alias-*` 主题令牌。

## 已知限制

- 应用内文件浏览器由插件自己的 Host 方法 `listDir` 提供（只列 `.json` / `.md` / `.markdown` / `.txt`，隐藏点文件），因此**改动 Host 代码后必须重启 DSH**。
- 宿主 `remote.directoryPicker` 在本 profile 只提供 `native` 能力（系统目录对话框），无法用于应用内列目录；插件因此不依赖它。
- 通过 `ctx.get("remote.promptManager")` 读取自己挂载的命名空间：点号服务名不能写进 `inject`，否则激活会等待一个由自己创建的服务而死锁。
