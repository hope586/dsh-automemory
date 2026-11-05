# dsh-automemory 0.3.7 发布说明

0.3.7 是一个补丁版本，面向所有 0.3.x 用户。它交付两类内容：2026-11-05 审查轮的服务端性能与健壮性修复，以及此前一直未单独发布的原生模型选择改动（原属 0.3.6，0.3.6 从未发布，本次随 0.3.7 首次发布）。从 0.3.5 升级无需数据迁移。

## 本版本包含什么

### 模型选择（首次发布）

- 记忆设置中的模型路由从两个独立文本框改为按提供方分组的下拉选择，数据来自与「新建会话」相同的宿主原生模型目录（`model-picker`，设置页）。
- 可以一次选定提供方、模型以及该模型支持的推理力度；G2 审计保留「跟随发起会话」选项。
- 宿主配置变化时自动刷新可选项；目录获取失败时给出明确提示，且不会丢弃由其他宿主保存的路由。
- 兼容旧设置：0.3.5 保存的 `provider`/`model` 路由会直接出现在新选择器中，无需手工迁移；`reasoningEffort` 是新增的可选字段。

### 性能改进（服务端）

- `/state` 与 `/global` 的 `models` 字段改为服务端缓存枚举：TTL 30 秒、宿主提供方列表变化立即失效、并行枚举、单个提供方目录最多等待 5 秒。字段形状不变，最多滞后 30 秒；设置页的模型选择器读取实时原生目录，不受此缓存影响。
- 记忆列表与索引渲染原先对每条记忆执行一次「开放争议」子查询，现合并为一次分组查询；输出（含按争议排序的引用）与原先完全一致。
- 重复投递或乱序到达的会话事件不再打开写事务（原先每个事件一次 `BEGIN IMMEDIATE`）；真正的新事件仍保持每事件一次写事务的持久性语义。

### 健壮性与资源回收

- 宿主销毁会话时，控制器释放该会话的内存簿记（工具调用序列、待读正文、会话绑定与回合快照），长期运行的宿主不再随会话数量累积。
- 崩溃 worker 或被替换租约遗留的任务证据目录，在任务进入终态（completed/failed/cancelled）后被清扫；运行中任务的证据一律保留，清扫范围严格限于插件自有的 `job-evidence` 临时目录，不触碰宿主数据。
- 模型路由枚举的竞态加固：旧的枚举完成后不会覆盖新提供方列表的缓存条目；挂起的提供方目录列举按「目录不可用」有界返回，并在 TTL 之后自动恢复。
- 多宿主并发下的开关安全：工作区启用/停用状态在写锁内重新读取，另一宿主在预读与事务之间关闭开关时，关闭期间的事件不会被接纳为证据。

## 性能测量：数字与边界

以下数字来自**同一台机器（macOS、Node 22）上的合成 fixture 微基准**，测量的是特定代码路径在受控输入下的耗时与调用次数。它们**不是端到端速度**，不代表页面整体变快了多少倍；真实收益取决于宿主配置的提供方数量与其目录延迟。仓库中的 `node scripts/bench.mjs`（无需网络与 API key，全部在临时目录运行）可复现「修改后」一侧：

| 场景（合成 fixture） | 修改前 | 修改后 |
|---|---|---|
| 状态读取热路径（5 提供方 × 每目录 15 ms 受控延迟） | 82.5–83.6 ms/次 | 0.062–0.071 ms/次 |
| 同场景 20 次请求的目录枚举次数 | 105 次 | 5 次 |
| 状态读取冷路径（4 提供方 × 每目录 50 ms） | 205.2–208.8 ms | 50.5–52.9 ms |
| 列表查询（300 条记忆 + 40 个开放争议） | 5.58–5.71 ms | 0.64–0.90 ms |
| 修订后索引重渲染（同上 fixture） | 5.84–5.93 ms | 1.03–1.09 ms |
| 重复事件路径（1000 次调用） | 79.2–81.8 ms | 21.0–21.8 ms |

「修改前」数值来自修复前代码在同一 fixture 上的测量；0.3.7 构建上维护者另行复测，结果与「修改后」区间一致（列表查询约 0.71 ms、索引重渲染约 1.13 ms、重复事件约 23.9 ms/千次、热路径约 0.067 ms/次，且 30 秒热窗口内目录枚举 0 次）。不做跨机器、跨负载的外推。

## 兼容性边界

- 已实测基线：DSH 0.2.1-rc.5、Node.js 22.22.2、macOS、Web 与 Desktop。包声明的版本范围不等于其他 DSH 0.2.x、更高 Node、其他操作系统已实测；协调方另完成了本机新版 Desktop 的加载与组件运行检查，未覆盖该宿主全部功能；Linux/Windows 不作为已验收平台。详见[兼容说明](compatibility.md)。
- 数据与设置：SQLite 结构与设置存储无变化，无迁移步骤；0.3.5 起的数据可直接沿用。
- 公开接口：UI-API 与 HOST-API 的形状不变；唯一的行为边界是 `models` 字段最多滞后 30 秒。
- 清理行为：新增的证据目录清扫只作用于插件自有的 `dataDir/job-evidence/`，原生日志删除仍走原有适配器与锁语义。

## 安装与升级

从 [v0.3.7 Release](https://github.com/hope586/dsh-automemory/releases/tag/v0.3.7) 下载 `dsh-automemory-0.3.7.tgz` 和 `SHA256SUMS`，在下载目录校验后安装：

```bash
shasum -a 256 -c SHA256SUMS
dsh plugin --profile web add ./dsh-automemory-0.3.7.tgz
```

或使用固定版本的 GitHub 安装方式：

```bash
dsh plugin --profile web add github:hope586/dsh-automemory#v0.3.7
```

- **Desktop** 使用应用内插件管理器：将发行包解压到空目录，添加含 `package.json` 与 `lib/` 的本地 `package` 目录并启用；当前 CLI 明确拒绝管理 Desktop 专属 profile，不要把上面的 `web` 改成 `desktop`。
- 升级前备份所用 `DSH_HOME`；替换安装包、保留 profile 中的 bundle 条目并重启宿主；多端共享同一 `DSH_HOME` 时应一起升级。
- 发行包与 tag 均包含预构建 `lib/`，安装不需要构建步骤或开发依赖。

## 已验证与未验证

已验证（维护者本机，无远端 CI——本仓库未配置远端 CI）：

- 全量自动测试 **258/258 通过**（含真实 DSH AgentLoop/工具/会话集成测试与受控桩模型适配器，全部数据合成、存放于临时目录）。
- 源码语法检查、打包分发检查（包含发布说明的分发文件、无私有路径、无安装期生命周期脚本）、公开文件检查通过。
- 多写者（多宿主共享 `DSH_HOME`）行为基于 SQLite 锁语义、双连接交错回归测试与代码审查验证。

未验证（如实声明）：

- 未在真实多提供方宿主上实测目录延迟（合成 fixture 只证明数量级与调用次数削减）。
- 未做真实双进程并发压测、完整真实捕获回放与长时间 GUI 压力测试。
- 本版本未重新做真实模型语义质量评估（见[评估方法](evaluation.md)）。

发现问题请通过 [GitHub Issues](https://github.com/hope586/dsh-automemory/issues) 反馈。

---

## English summary

dsh-automemory 0.3.7 is a patch release. It ships the 2026-11-05 server-side performance and robustness fixes, and it is the first public release of the native model picker changes originally staged for 0.3.6 (0.3.6 was never published separately). No data or settings migration is required from 0.3.5; saved model routes carry over.

Highlights: model routes are now chosen from the host's native model catalog with a provider-grouped selector (provider, model and reasoning effort together; G2 can follow its originating session); `/state` and `/global` serve the legacy `models` field from a 30-second server-side cache with parallel, bounded enumeration; browse/index rendering uses one grouped open-issue query; duplicate or out-of-order session events skip write transactions; per-session bookkeeping is released when the host disposes a session; and evidence directories left by crashed workers are swept once their task is terminal.

The performance numbers above come from same-machine synthetic-fixture micro-benchmarks (reproducible with `node scripts/bench.mjs`). They are not end-to-end speedups; real gains depend on your provider count and catalog latency. Tested baseline: DSH 0.2.1-rc.5, Node.js 22.22.2, macOS, Web/Desktop. This repository has no remote CI; checks run locally. The coordinator also verified loading and component operation in the installed newer Desktop. Real two-process stress, full capture replay and long-duration GUI load were not performed. See [README.en.md](../README.en.md) for installation and [compatibility](compatibility.md) for boundaries.
