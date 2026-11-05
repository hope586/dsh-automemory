# dsh-automemory

[English](README.en.md) · [使用说明](docs/usage.md) · [数据与隐私](docs/privacy.md)

> 当前版本 **0.3.7**：包含首次发布的原生模型选择（原 0.3.6，未单独发布）与 2026-11-05 审查轮的性能、健壮性修复。详见 [0.3.7 发布说明](docs/RELEASE-NOTES-v0.3.7.md) 和 [版本记录](CHANGELOG.md)。

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供按项目隔离的自动记忆：延续会话中形成的决定、理由、进展和协作约定，并在独立记忆页面查看、解释和调整。

这是独立社区插件，采用 MIT 协议，与 DeepSeek 官方没有隶属关系。当前版本 **0.3.7**，处于 0.x 阶段。记忆由模型选择性维护，可能漏记、过度概括或沿用过时内容；它不能替代当前项目文件和用户判断。

## 可以做什么

- **按工作区进入**：项目总结、主题和待解决争议集中展示；“当前记忆”和“记忆动态”分开阅读。
- **直接管理记忆**：左侧阅读，右侧专用对话。可以询问、补充、更正和整理；每次重新进入开始新对话，同次访问切换主题保留上下文。
- **跨会话延续**：工作 Agent 可以主动记录、读取和进行阶段审计。每轮提供项目索引，正文按需读取；更新保留来源、版本与实际回执。
- **后台整理**：有新资料、项目空闲且达到最小间隔时运行 Dreamer；默认至少滚动 24 小时一次，也可手动触发。
- **全局个人资料**：使用 `$DSH_HOME/USER.md` 保存跨项目的偏好；注入和自动维护分别控制，修改可查差异和来源。项目事实仍留在项目内。
- **与宿主共用基础设施**：使用 DSH 的模型配置、原生 Agent/Session、工具运行和日志。可与 [Context Lite](https://github.com/hope586/dsh-context-lite) 联合审计，但运行时不依赖它。

同一 `DSH_HOME` 的 Web/Desktop 共享记忆。工作区移除后保留记忆、暂停自动整理；同一目录重新出现在工作区列表时自动恢复关联。设置、历史会话纳入和已移除工作区统一放在记忆设置中。

## 安装

已实测基线：**DSH 0.2.1-rc.5、Node 22.22.2、macOS、Web/Desktop**。包声明的版本范围不等于其他版本或平台已实测。需要已安装 DSH 和 pnpm。

从 [v0.3.7 Release](https://github.com/hope586/dsh-automemory/releases/tag/v0.3.7) 下载 `dsh-automemory-0.3.7.tgz` 和 `SHA256SUMS`，在下载目录校验后安装：

```bash
shasum -a 256 -c SHA256SUMS
dsh plugin --profile web add ./dsh-automemory-0.3.7.tgz
```

在已验证的宿主中，这条命令会自动将 `dsh-automemory` 加入 `$DSH_HOME/profiles/web/package.json` 的 `dsh.profile.bundles`。核对该条目存在并保留其他 bundle，随后重启该 profile；不要重复添加。

**Desktop 使用应用内的插件管理器。** 将发行包解压到一个空目录，在 Desktop 的“插件”中添加解压后含 `package.json` 和 `lib/` 的本地 `package` 目录，启用并按宿主提示重载。当前 DSH 明确禁止 CLI 管理 Electron 专属的 `desktop` profile；不要把上面命令的 `web` 直接改成 `desktop`。

固定版本的 GitHub 安装方式：

```bash
dsh plugin --profile web add github:hope586/dsh-automemory#v0.3.7
```

发行包和 tag 都包含预构建 `lib/`，安装用户无需构建或复制开发依赖。当前通过 GitHub 发布，**没有发布到 npm registry**；`private:true` 用于防止误发 npm，不影响 MIT 开源和 GitHub 安装。

## 第一次使用

1. 点击侧栏工作区上方的“记忆”，选择工作区。
2. 在“设置 → 模型与整理”核对提供方与模型。工程默认的管理助手、Dreamer、Reviewer 为 `deepseek-official / deepseek-flash`，必须与宿主实际配置匹配；可以分别修改。G2 默认跟随发起工作会话的模型和有效上下文。
3. 项目记忆默认开启，可以逐项目关闭。已有旧会话不会自动回扫；需要时到“设置 → 归档与历史”选择纳入。
4. 正常工作或在记忆页提出请求。以“已正式生效”的回执及记忆动态判断实际保存；“已接受”只代表任务入队。

记忆请求、后台整理和审查会使用所配置模型的额度。模型可能接收会话内容、记忆和允许读取的工作区证据。预算是本地调度保护，不是精确账单或严格费用封顶。默认输入/输出上限、滚动用量和保留规则见[使用说明](docs/usage.md)。

## 停用、升级与数据

在宿主插件管理中停用或移除 bundle 会停止功能，已有数据保留。项目开关关闭后，普通工作的召回、自动写入和后台任务暂停，记忆页仍可阅读并明确管理。全局资料有独立开关。

升级前备份所用 `DSH_HOME`。替换安装包、保留 bundles 条目并重启对应宿主；多端共享时应一起更新。默认数据在 `$DSH_HOME/automemory`，全局资料在 `$DSH_HOME/USER.md`，管理及后台角色的完整过程保存在 DSH 原生会话日志中。卸载不等于清除；[数据与删除边界](docs/privacy.md)说明哪些副本会随明确清除一起处理。

## 验证与开发

```bash
git clone https://github.com/hope586/dsh-automemory.git
cd dsh-automemory
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
pnpm run check
pnpm test
pnpm run verify:licenses
pnpm run verify:public
pnpm run verify:package
pnpm run test:package
```

测试使用公开的 DSH 包和临时合成环境，不需要 API key，不调用付费模型，不读取已有 `DSH_HOME`。Context Lite 的跨插件测试固定到公开提交，并通过它的公开审计 API 验证；它只是开发依赖。

[开发说明](CONTRIBUTING.md) · [规格](SPEC.md) · [宿主适配](HOST-API.md) · [UI/API](UI-API.md) · [兼容与测试边界](docs/compatibility.md) · [效果评估方法](docs/evaluation.md) · [版本记录](CHANGELOG.md) · [安全问题](SECURITY.md)

## 许可证

[MIT](LICENSE)。打包的第三方组件保留各自版权和许可，见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。本仓库不包含维护者的原始会话、记忆库、凭据或私有验收日志。
