# Usage / 使用说明

## 工作流程

点击“记忆”后先选择工作区。在当前记忆页阅读项目总结、主题和条目；有争议的内容有独立入口，可在同一右侧对话中解释或解决。切换到记忆动态查看实际变化和来源。

可以直接说“记住这个项目只接受人工确认后的发布日期”“这条约定已过期，请解释会影响哪些记忆”“合并这两个主题”。助手使用当前范围，必要时只读项目文件核查；模型回复不等于已写入，检查回执和动态。

对话管理的上下文只属于本次访问。切换主题或页签会保留它；退出后重新进入开始新的对话。后台承载使用原生会话，用户无需挑选接收会话。失败时“刷新状态”和“重试请求”含义不同：前者检查原请求，后者在新上下文中核对后重新处理。不要把未收到网页回复当作确定未写入。

## 设置与历史

记忆设置集中提供四个区域：模型与整理、工作区设置、资料使用方式、归档与历史。

- 项目自动记忆默认开启，关闭后普通会话的记忆提供、自动写入和后台任务暂停。已有记忆可读，也可在页面明确管理。
- 自动整理单独控制，关闭它不关闭日常工作中的记录和召回。自动运行至少间隔24小时，且需要新资料和项目空闲；手动整理仍要通过预算、版本和并发检查。
- USER.md 的注入与自动维护分别设置。自动维护只接纳适用于各项目的个人事实和协作偏好；项目约定保存在项目内。
- 旧会话只在手动选中后纳入。已纳入表示进入管理范围，不意味着每句话都已转为记忆。开启后的新资料自动进入范围；关闭期间的缺口不会偷偷回扫。
- 已移除工作区的记忆保存在归档入口，自动整理暂停。同一项目重新出现在宿主工作区列表时恢复关联，不需要手动“恢复记忆”。

## 模型与额度

工程默认的 manager/Dreamer/Reviewer 是 `deepseek-official / deepseek-flash`，请改为宿主实际可用的提供方和模型。插件不管理另一份 API key。G2 默认跟随发起工作会话；换模型不会把继承上下文悄悄缩成摘要。

默认每调用输入估算上限131072、输出上限4096，每请求最多8个模型步骤，每滚动24小时后台额度1000000 tokens。输入估算可能比实际计费保守；管理对话目前使用字节上界保护。超预算时请求可能在出站前被拒绝，或后台任务等待配置调整；不会自动提高额度。用量缺失不按零计算，提供方没有返回的货币费用保持未知。

模型不可用时先检查该宿主是否注册了所选路线。共享记忆不代表每个宿主都装了同一个模型提供方。等待模型服务的任务不会自动改用其他模型。

## Inspecting memory / 阅读与审计

Current memory is the user-facing view; activity records actual changes. A model's “remembered” sentence is not a commit receipt. “Accepted” means queued or accepted for processing; “committed” establishes a formal change. “Cleanup incomplete” means some owned copies still require cleanup even if the formal entry is gone.

For an unexpected answer, compare the original user requirement, the saved entry/version, the native request context, the actual `memory_read` result and the answer/action. Optional Context Lite can inspect native admission and replacements. Version 0.3.1 adds pre-step provenance; older releases can show the message while lacking the original caller. Missing caller evidence is not evidence of absent memory.

## Upgrade and uninstall

Back up the `DSH_HOME` used by the relevant host. Install the new archive into that profile, preserve its bundle entry and restart. Do not assume updating Web also updates Desktop. Two hosts sharing memory should use the same compatible plugin version.

Use `dsh plugin --profile web add ...` for Web. Desktop's reserved profile is managed by the Electron app, not the CLI: extract the archive and add its local package directory through the in-app plugin manager. The CLI's refusal to manage `desktop` is expected host behavior, not an AutoMemory installation error.

Disable the plugin through the host manager, or remove its profile bundle entry and package, then restart. Data remains. Use explicit memory/profile clearing when you want plugin-controlled data removed, and inspect cleanup receipts. Do not delete a live database while another host is writing it. See [privacy](privacy.md) for the scope of erasure.
