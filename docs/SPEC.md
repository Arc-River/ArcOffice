# ArcOffice 精简技术规格

> 基于 Spec V1.0 提炼，覆盖架构 / 技术栈 / 核心约定。完整版见 [SPEC_V1.0](./SPEC_V1.0.md)。设计系统细节（色板、字体、组件、圆角、间距）见 [DESIGN.md](./DESIGN.md)。

---

## 一、产品定位

**ArcOffice** — Electron + Vue3 + Node.js + Anthropic AI 构建的跨端桌面 Office 工具。

- 本地运行、离线可用、隐私优先
- 主流 Office 文档（docx / xlsx / pptx）解析、编辑、转换、批量处理
- AI 智能：文档摘要、润色、问答、自然语言指令触发操作
- 三端：Windows / macOS / Linux

---

## 二、整体架构

### 2.1 分层

```
┌─────────────────────────────────────┐
│ Electron 桌面壳（窗口/系统能力/IPC）  │
├─────────────────────────────────────┤
│ Vue3 + Vite + TS + Element Plus     │
├─────────────────────────────────────┤
│ Node.js 主进程（IO/Office/AI 解析）  │
├─────────────────────────────────────┤
│ sql.js 本地数据库（纯 JS，零原生依赖）│
└─────────────────────────────────────┘
```

### 2.2 双进程架构

| 进程 | 职责 |
|------|------|
| **Main Process** | 窗口管理、文件系统、SQLite 数据库、AI SDK 调用 |
| **Renderer Process** | Vue3 UI 渲染（contextIsolation 隔离） |

前后端通过 Electron IPC（contextBridge + ipcMain.handle）通信。

---

## 三、技术栈

### 3.1 前端

| 项 | 选型 |
|----|------|
| 框架 | Vue3 + Composition API + TypeScript |
| 构建 | Vite（路由懒加载、代码分割） |
| UI | Element Plus（按需引入，复用官方暗黑主题） |
| 样式 | SCSS + `<style scoped>`，**废弃 Tailwind**¹ |
| 状态 | Pinia（主题 / 任务 / AI 会话 / 配置） |
| 通信 | 统一 Electron IPC，**禁止前端直连文件/AI/DB** |
| 国际化 | vue-i18n（中/英文，初期仅中文） |

> ¹ Tailwind 在桌面端多层组件化场景下导致模板可读性下降，SCSS + scoped 更符合 Element Plus 生态。

### 3.2 Node.js 主进程

| 项 | 选型 |
|----|------|
| 运行时 | Node.js（Electron 内置） |
| 桌面壳 | Electron（contextBridge + ipcMain.handle） |
| 文件操作 | Node.js fs/promises（readFileText / writeFile / editFile） |
| 数据库 | sql.js（纯 JS SQLite，零原生依赖，无 ABI 问题） |
| AI SDK | @anthropic-ai/sdk（主进程中运行） |
| 构建集成 | vite-plugin-electron（保留 Vite 开发体验） |
| 打包 | electron-builder（dmg/nsis/AppImage） |

### 3.3 环境要求

| 依赖 | 最低版本 | 备注 |
|------|---------|------|
| Node.js | >= 18 | sql.js 纯 JS，无版本限制 |
| pnpm | >= 8 | - |
| macOS | 13+ | - |
| Windows | 10 | - |
| Linux | glibc >= 2.28 | - |

### 3.4 测试策略

| 层 | 工具 | 范围 |
|----|------|------|
| Node.js 单元 | Vitest | 主进程逻辑、IPC handler、文件操作 |
| Vue 组件 | Vitest + @vue/test-utils | 组件渲染、交互 |
| E2E | Playwright + Electron | 端到端主流程 |

### 3.5 AI

- @anthropic-ai/sdk：意图识别、函数调用、多轮对话
- 运行在 Electron 主进程，通过 IPC 与前端通信
- 资源管控：限制并发数、超时熔断

### 3.6 前端目录结构

```
src/
├── assets/styles/
│   ├── global.scss          # 全局重置、滚动条、通用样式
│   ├── element-vars.scss    # Element Plus 主题变量
│   └── mixins.scss          # 桌面端通用 SCSS 混入
├── components/              # 公共业务组件
├── stores/                  # Pinia 状态（主题、任务、配置）
├── utils/                   # 工具函数（主题、IPC、格式处理）
├── views/                   # 页面视图（首页/工作台/批量任务等）
├── types/                   # TS 类型定义
└── main.ts                  # 应用入口
electron/
├── main.ts                  # Electron 主进程入口
├── preload.ts               # contextBridge 桥接脚本
└── ipc/                     # IPC handler 实现
    ├── index.ts             # 注册所有 handler
    ├── io.ts                # 文件系统操作
    ├── db.ts                # sql.js 数据库操作
    └── ai.ts                # @anthropic-ai/sdk 集成
```

---

## 四、核心能力

### 4.1 文档处理
- 解析：docx / xlsx / pptx 读取（通过 AI 工具）、内容提取
- 操作：合并、拆分、重命名、批量归类
- 转换：Office ↔ PDF / 图片 / Markdown / 纯文本
- 缩略图：自动生成封面图

### 4.2 批量任务
- 队列管理：优先级、暂停、恢复、取消、限流
- 进度可视化 + 任务日志留存
- 状态实时写入 SQLite，IPC 推送前端

### 4.3 AI 能力
- 文档理解：摘要、关键词、结构分析
- 内容编辑：润色、改写、翻译、纠错
- 智能问答：基于当前文档对话
- 自然语言指令：触发文档操作

---

## 五、主题与色彩

三模式：**浅色 / 深色 / 跟随系统**，首次启动默认"跟随系统"。

### 5.1 色板

```
品牌蓝  #1677FF  — 按钮、选中态、高亮、焦点边框
成功    #00B42A  — 任务完成
警告    #FF7D00  — 部分完成
危险    #F53F3F  — 任务失败
信息    #86909C  — 禁用态
```

浅色表面：
```
Page    #F2F3F5  窗口/侧栏背景
Canvas  #FFFFFF  卡片/面板/输入框
Hover   #F5F7FA  悬浮态
Border  #E5E6EB  唯一边框色（1px）
```

深色表面：
```
Dark Page       #141414
Dark Canvas     #1F1F1F
Dark Card       #262626
Dark Hover      #2A2A2A
Dark Border     #333333
Dark AI Bubble  #2A3D1A
```

### 5.2 CSS 变量命名

```
--arc-bg-page            浅色页面背景
--arc-bg-card            浅色卡片背景
--arc-text-primary       主文本色
--arc-text-secondary     次要文本色
--arc-border             边框色
--arc-hover              悬浮态背景色
```

深色主题通过 `:root.dark` 覆盖上述变量。

### 5.3 字体层级

| Token | Size | Weight | 用途 |
|-------|------|--------|------|
| display | 28px | 600 | 页面标题 |
| title-lg | 20px | 600 | 章节/对话框标题 |
| title | 18px | 600 | 卡片标题 |
| title-sm | 16px | 600 | 文件卡片标题 |
| body | 14px | 400 | 默认正文 |
| body-sm | 13px | 400 | 元数据 |
| body-xs | 12px | 400 | 状态栏 |
| button | 14px | 500 | 按钮标签 |
| label-sm | 12px | 500 | 状态标签 |
| mono | 13px | 400 | 等宽（代码/路径） |

### 5.4 实现要点
- 根节点 `document.documentElement` 追加/移除 `dark` 类名
- 启动时读取 DB 配置→初始化 Pinia→渲染前完成主题加载（杜绝闪屏）
- Auto 模式监听 `prefers-color-scheme` 媒体查询
- **所有自定义样式禁止硬编码色值**，使用全局 CSS 变量

---

## 六、数据存储

### 6.1 SQLite 配置
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -20000;
PRAGMA temp_store = MEMORY;
```

### 6.2 核心表
| 表 | 用途 |
|---|------|
| `app_config` | 主题、默认路径、AI 参数、快捷键 |
| `file_history` | 文件路径/名称/类型/访问时间/标签 |
| `task_records` | 任务 ID/类型/状态/进度/日志 |
| `ai_chat` | 对话内容/角色/时间/关联文档 |
| `template` | 自定义指令模板 |

### 6.3 约束
- 30 天以上数据自动归档
- 单字段 > 4KB 的文本存文件路径，本体落地磁盘
- API Key 等敏感配置加密存储（AES-256-GCM）
- 支持定时备份 + 手动导出/恢复

---

## 七、安全约束

1. **文件安全**：读取前格式校验，隔离可疑文件
2. **权限安全**：路径白名单，限制 AI 工具和文件浏览器的工作目录
3. **隐私安全**：默认不上传文档；云端 AI 模式支持敏感信息脱敏
4. **代码安全**：Electron 沙箱隔离，contextIsolation 保护
5. **配置安全**：密钥加密存储，禁止明文

---

## 八、阶段规划

### Phase 1 — MVP
- [x] Electron + Vue3 + Node.js + SQLite 联调
- [ ] 基础文件管理、Office 解析、格式转换
- [ ] 本地持久化、任务队列
- [ ] 双主题基础适配

### Phase 2 — AI 能力
- [ ] 集成 Goose AI Agent
- [ ] 对话、文档智能处理、FunctionCall
- [ ] 三主题完整切换、设置页、通知
- [ ] 交互细节打磨（滚动条、标题栏）

### Phase 3 — 发布
- [ ] 老旧文档兼容、批量能力增强
- [ ] 数据备份、日志导出、异常捕获
- [ ] 全平台适配、压力测试、性能调优
- [ ] 打包、签名、发布

---

## 九、通信规范

前后端统一走 **Electron IPC**（contextBridge + ipcMain.handle），不启动额外 HTTP 服务。数据格式 JSON。

### 9.1 标准响应结构

```typescript
// 统一响应结构（前后端共享）
interface RpcResponse<T = unknown> {
  code: number;       // 0=成功，>0=错误
  data?: T;
  message: string;    // 成功时 "ok"，失败时为错误描述
}
```

### 9.2 错误码范围

| 范围 | 分类 | 示例 |
|------|------|------|
| 1xxx | IO 错误 | 1001 文件不存在、1002 无权限 |
| 2xxx | 格式错误 | 2001 不支持格式、2002 文件损坏 |
| 3xxx | AI 错误 | 3001 推理超时、3002 上下文超长 |
| 4xxx | 权限错误 | 4001 路径越权、4002 密钥未配置 |
| 5xxx | 系统错误 | 5001 进程崩溃、5002 内存不足 |

### 9.3 调用约束
- 高频接口（文件列表刷新）加 300ms 防抖
- 耗时接口（文档解析/AI 推理）显示加载状态
- 所有 IPC 调用设超时：IO 操作 30s，AI 操作 120s

---

## 十、关键约定

### 10.1 开发约定

| 领域 | 约定 |
|------|------|
| IPC 通信 | Electron contextBridge + ipcMain.handle，数据格式 JSON |
| 文件流 | 全部流式读取，禁止一次性加载大文件至内存 |
| 字体 | 纯系统字体栈，无自定义字体加载 |
| CSS 变量 | 全局变量 `--arc-*`，禁止硬编码色值 |
| 测试 | Vitest 单元测试 + Playwright E2E |

### 10.2 UI 约定

| 领域 | 约定 |
|------|------|
| 圆角 | 默认 8px（`--arc-radius`），按钮/卡片/输入框统一 |
| 阴影 | 轻阴影设计，发丝线替代传统阴影 |
| 边框 | 仅 1px 发丝线，无 2px 边框 |
| 按钮 | 32px 标准高度，无 pill 形 |
| 滚动条 | 6px 宽，hover 时显示，track 透明 |
| 组件高度 | Top Nav 48px / Toolbar 40px / Status Bar 28px |
| 间距基线 | 8px，关键间距：section 64px / card 16px / form 24px |

### 10.3 编译与打包

| 领域 | 约定 |
|------|------|
| 前端 | Vite 极致压缩、依赖按需加载、代码分割 |
| 包体 | 依赖按需加载，无需额外运行时 |
| 更新 | electron-builder 增量更新机制，仅下载差异资源 |
