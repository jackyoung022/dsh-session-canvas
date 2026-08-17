# DSH Session Canvas

一个面向 DSH Web 的多会话画布插件。它把分散在不同 session 中的内容放到同一张可视化画布上，方便浏览、组织、关联上下文，并直接在卡片内继续与模型对话。

## 可以做什么

- **聚合多 session**：按 workspace 浏览会话库，并将需要关注的 session 添加到同一画布。
- **自由整理卡片**：拖动、缩放和移除画布卡片；从会话库添加时，卡片默认出现在当前视口中央。
- **直接继续对话**：在卡片输入框中向对应 session 发送消息并接收模型回复，无需离开画布。
- **关联会话上下文**：连接两张卡片，将来源 session 的内容注入目标 session，便于跨会话继续分析。
- **创建汇总 session**：选择多个 session，生成一个包含来源内容的新 session，并继续追问或整理结果。
- **创建空白 session**：在当前 workspace 中快速创建新对话，继承 DSH 默认 agent preset、模型、工具与权限配置。
- **调用命令和 skills**：输入 `/` 查看当前会话可用的命令与 skills；使用 `↑`、`↓` 选择，`Tab` 补全，`Enter` 执行。
- **使用原生 skill 执行链路**：skill 以 DSH 原生用户调用形式发送给模型，完整加载 `SKILL.md`，并使用与普通 DSH 会话一致的工具和权限。
- **兼容中文输入法**：输入法组词期间按回车只确认候选字，不会误发送卡片消息。
- **删除 session**：卡片中可以删除对应 session。当前实现调用 DSH 的归档能力，因此会话仍可从 DSH 的归档区恢复。
- **保存画布布局**：每个 workspace 的卡片位置、尺寸和连线保存在浏览器 `localStorage` 中。

## 典型工作流

1. 从 DSH 侧边栏打开“会话画布”。
2. 选择 workspace，从会话库添加已有 session，或创建一个空白 session。
3. 拖动和缩放卡片，整理当前任务需要的会话。
4. 在卡片内继续对话，或输入 `/` 调用命令和 skill。
5. 连接两张卡片，将一个 session 的内容作为上下文注入另一个 session。
6. 多选相关 session，创建新的汇总 session。

## 安装

该项目是 DSH Web 插件，需要在已安装并可运行 DSH 的环境中使用。

从 Git 仓库安装：

```bash
dsh plugin --profile web add git+ssh://git@github.com/jackyoung022/dsh-session-canvas.git
```

然后重启 DSH Web，使 profile bundle patch 和浏览器端插件生效：

```bash
dsh web
```

如果你的 DSH 版本使用不同的插件管理命令，请将本仓库作为包安装到 Web profile，并确保 `cordis.patch.yml` 被加载。

## 使用说明

### 卡片操作

- 从会话库点击添加：把 session 卡片放到当前画面中央。
- 拖动卡片标题栏：移动卡片。
- 拖动卡片右下角：调整尺寸。
- 点击卡片关闭按钮：仅从画布移除，不影响原 session。
- 点击删除 session：确认后归档该 session，并从画布和会话库移除。

### Slash 命令与 skills

在卡片输入框键入 `/` 后：

- `↑` / `↓`：循环选择候选项。
- `Tab`：补全候选名称，之后可以继续输入任务描述。
- `Enter`：执行选中的 skill；命令补全后按 `Enter` 执行命令。
- 也可以点击候选项直接选择或执行。

例如：

```text
/last30days 研究最近 30 天大家如何评价 DSH
```

插件不会自行截断或拼接 skill 指令，而是通过 DSH 原生 skill 调用链路加载完整 skill，并让模型在目标 session 的 agent 上执行。

## 项目结构

```text
.
├── cordis.patch.yml       # 将插件加入 DSH Web profile
├── lib
│   ├── index.js           # Host 端：session、对话、注入、命令和 skill API
│   └── client.js          # Web 端：画布、卡片、连线和交互界面
├── test
│   └── skill-run.test.js  # Skill 原生调用和 agent preset 回归测试
└── package.json
```

Host 端接口仅接受本机请求。浏览器端负责画布交互，Host 端通过 DSH 服务读取 session、恢复或创建 agent，并执行对话、命令及 skill。

## 本地开发与验证

```bash
npm test
node --check lib/index.js
node --check lib/client.js
npm pack --dry-run
```

提交代码前请确认不要加入 `.env`、访问令牌、SSH 私钥、证书、会话日志或其他个人数据。本仓库的 `.gitignore` 已覆盖常见敏感文件，但它不能替代人工检查。

## 后续计划

- 增加画布缩放、平移、小地图、自动布局和一键整理。
- 增加撤销/重做，以及布局版本历史。
- 支持画布布局导入、导出、模板和跨设备同步。
- 为连线增加方向、备注、注入范围、刷新策略和上下文长度控制。
- 支持流式响应、中止生成、重新生成和更完整的消息状态展示。
- 在卡片级选择模型、agent preset、权限配置和工具集合，并清晰展示当前权限来源。
- 支持附件、图片及其他多模态内容。
- 增加 session 搜索、筛选、标签、批量添加、批量归档和归档恢复入口。
- 优化大量卡片和长会话下的渲染性能，增加虚拟化与增量加载。
- 增加端到端测试、持续集成、兼容性矩阵和自动发布流程。
- 增加更细粒度的本地访问校验、请求防护和安全审计。

## License

Apache-2.0
