# Data, providers and deletion / 数据、模型与清除

AutoMemory stores its state locally, but **it is not necessarily an offline system**. Work conversations, selected historical material, existing memory and permitted project evidence can be sent to the model provider configured in DSH. The plugin adds no independent telemetry endpoint and stores no separate provider key. The host and providers have their own data policies.

## Local data

| Location | Contents |
|---|---|
| `$DSH_HOME/automemory/memory.sqlite` | Formal project records, sources, versions, receipts, issues, jobs and audit data |
| `$DSH_HOME/automemory/management.sqlite` | Management requests, diagnostics, receipts and native-session ownership |
| `$DSH_HOME/automemory/settings.sqlite` | Role models, budget reservations and usage |
| `$DSH_HOME/automemory/user-profile.sqlite` | Profile settings, change journal and audit receipts |
| `$DSH_HOME/automemory/job-evidence/` | Temporary job evidence used by scoped native read tools |
| `$DSH_HOME/USER.md` | Authoritative shared personal profile |
| DSH native session storage | Complete management/background prompts, model responses, tool calls/results and request usage |

管理对话有独立的精简提示词和明确范围。它可以只读当前工作区的允许内容；没有 shell 或项目文件写入权限。全局资料管理不具有项目文件读取权限。保护目录和凭据文件会被拒绝，链接及过宽的后台目录检索也会被限制。该边界不等于对重命名的任意秘密备份、恶意并发文件替换或整个 DSH 的安全审计。

## Controls

Projects are isolated by canonical identity; Git worktrees may intentionally share one repository memory. Hosts sharing one `DSH_HOME` share those records. Global USER.md is intentionally cross-project; its use and automatic editing are separately switchable. Disabling a project does not disable USER.md.

Old conversations require explicit inclusion. Removing a workspace retains its memory and pauses automatic consolidation. Disabling or uninstalling the plugin preserves data. A fresh management-page visit does not inherit the previous conversation, but the previous native audit log remains until retention/clearing removes it.

## Retention and explicit clearing

The default audit retention is30 days and can be configured. It governs eligible audit/difference material and owned native logs; **it does not expire formal memory**. In-flight jobs retain material needed for recovery. Retention is applied while the plugin runs, not by an independent always-on service.

Explicit clearing first checks real current user intent and the relevant confirmation/permission flow. It removes formal target content and cleans related plugin-controlled audit copies, queued artifacts, snapshots, evidence caches and owned native sessions. Cross-host epochs and revocation metadata prevent a stale request from restoring cleared content. Minimal identifiers/hashes may remain for idempotency and cleanup tracking.

Cleanup can remain incomplete while a native writer is active or when the storage layout cannot be safely verified. The receipt reports that state and later attempts retry; deleting the formal entry alone is not reported as complete erasure. The implemented adapter is verified for the DSH0.2.1-rc.5 local v4 JSONL/zstd backend only.

Clearing plugin-owned data does **not** erase the user's original DSH conversations, provider records, external backups, exported reports or copies committed elsewhere. It cannot guarantee physical erasure from SSD snapshots or RAM. Deleting USER.md through the plugin clears related plugin-controlled profile copies and background/management snapshots, while retaining formal project memory.

## Reporting issues safely

Start with version/build, host version, failure code and a synthetic reproduction. Review logs and screenshots before sharing: they can contain project files and personal information. Do not attach credentials, complete databases or unrelated conversations to public issues. The public repository contains synthetic tests and aggregate observations, not the maintainer's raw acceptance data.
