# AutoMemory client / host contract · 0.3.0

The root-scoped page uses public `main` key `autoMemory` and a matching `sidebar.panellist` entry at order 15 above Workspaces. The current UI does not register a right-sidebar body or conversation-header button. React and Markdown are supplied by the host.

Model settings use the native `remote.session.modelCatalog()` endpoint also used by conversation selectors. The host `Menu` renders provider groups and advertised reasoning levels. Selection stages a complete `{provider,model,reasoningEffort?}` in the plugin settings form, while G2 may stage `null` to follow its originating session. Catalog reads create no Session and never change an ordinary conversation or the host default model. Host reset, adapter, settings and credential-reference events invalidate choices; saved routes outside the current catalog remain visible and unchanged until the user selects a replacement. The legacy `models` field below remains for API compatibility and no longer drives this selector.

All requests use same-origin credentials and private/no-store responses. The host enforces normal connection authentication, Origin checks and trusted workspace mapping. Client-provided paths, focus labels and optimistic UI state never grant authority.

## Workspace and global reads

`GET /api/dsh-automemory/catalog` returns `{ok:true,data:{version,build,projects,retainedProjects,nativeWorkspaces,selectedSessionId:null}}`.

Each current project has `{key,nativeWorkspaceId,id,name,path,root,enabled,registered,canBrowse,sessions}`. `key` / `nativeWorkspaceId` identify the native sidebar registration; `id` identifies memory storage. Several worktrees may have separate native keys and the same memory ID. The selector and cards must use native keys. `nativeWorkspaces:true` means names, order and membership follow the host workspace registry, including empty workspaces; old session metadata never recreates a removed workspace. Unknown/missing paths whose identity cannot safely be resolved have `canBrowse:false` and `id:null`.

Retained projects are stored memories with no current native registration; they carry `detached:true`, a `retained:` key and `automaticConsolidationPaused:true`. Show them only in Settings → Archive and history. Re-adding the same project reconnects its original memory, preserving explicit off settings. Hosts without a workspace registry retain the headless project catalog. Registry errors propagate, not an invented empty list.

`GET /api/dsh-automemory/global` returns profile/settings/models/usage without any project or current conversation. Global capabilities include `manage:true` and `managementRequiresSession:false`. Reading never creates a model call.

`GET /api/dsh-automemory/state?workspaceId=<known-memory-id>` returns the project State with `sessionId:null`. The older `sessionId` read is compatible; supplying both IDs requires them to belong to the same project.

```js
{
  version, build, sessionId,
  workspace: {
    id, name, root, enabled, automaticDream,
    detached, automaticConsolidationPaused
  },
  overview: {
    revision, sourceRevision, summary,
    topics: [{id,title,summary,memoryIds,issueIds,entries:[{id,title,version}]}],
    memoryCount, issueCount, derived:true, summaryMode
  },
  memories: [{id,version,status,title,category,group,index_hint}],
  memoriesMore,
  issues: [{id,question,context,affected,source_refs,status,version}],
  activity: [{id,channel,event_type,status:'committed',changed:true,time,summary,reason,before,after,source_refs,review,metadata}],
  jobs: [{id,kind,status,error,deferral,usage:{calls,totalTokens,cacheReadTokens,cost}}],
  userProfile: {enabled,autoWrite,content,version,changes},
  sessions: [{id,title,updatedAt,included}], // included: the complete observed history is eligible; off-period gaps remain selectable
  settings: {
    revision,
    models: {manager:{provider,model},g2:null,dreamer:{provider,model},reviewer:{provider,model}},
    dreamIntervalHours:24,auditRetentionDays:30,
    budget:{maxInputTokens,maxOutputTokens,maxSteps,maxDailyTokens}
  },
  models:[{provider,model,label}], usage,
  capabilities:{manage:true,managementRequiresSession:false,dream,settings:true,includeSessions}
}
```

Formal memory is authoritative; `overview` is a versioned human-readable projection. Opening it does not call a model. The default summary derives from current payloads, never from retrieval hints as if they were facts. A model may reorganize topics using all current memory IDs once. Memory changes invalidate saved prose; valid grouping can remain while summaries derive again from current facts.

Full record content is fetched through `read`, including when project automatic memory is disabled. Preserve the distinction between current and historical records. `memoriesMore:true` means the index list is partial. Historical-session inclusion remains explicitly selected and project-scoped.

## Embedded management conversation

A workspace page has a dedicated manager on its right. It has no user-selected receiving conversation; the backend owns its hidden native session. On every workspace entry call `manager-open`; keep the returned conversation across topic/tab changes, and `manager-close` when leaving. A later entry creates a fresh context. Global profile uses scope `user` without a workspace.

All actions go through `POST /api/dsh-automemory/action`:

| Action | Input | Result |
|---|---|---|
| `manager-open` | `scope:'project'|'user'`, project `workspaceId`, optional trusted `nativeWorkspaceId` | Conversation snapshot |
| `manager-send` | `conversationId,text,requestId`, optional `topicId,memoryId,issueId` | Acceptance with conversation snapshot; acceptance is not a memory commit |
| `manager-retry` | `conversationId,requestId` (new idempotent client request ID) | Retry a failed request after refreshing current records, or perform a read-only result review when a write may already have happened; the server selects the safe mode |
| `manager-state` | `conversationId` | Current conversation snapshot |
| `manager-confirm` | `conversationId,confirmationId,approved:boolean` | Updated conversation after accepting/cancelling the exact pending clearing request |
| `manager-close` | `conversationId` | Closed/detached snapshot; running work may finish, but no more input is accepted |

Conversation snapshots are `{id,scope,workspaceId,status,messages:[{id,role,text}],revision,error?,confirmation?,retry?,diagnostics?}`. `retry` identifies `resend` or `review` and the failed request; it is computed by the server. `diagnostics` contains bounded stage, route, call and error metadata rather than raw provider payloads or credentials. Status is `ready`, `running`, `awaiting-confirmation`, or `closed`. A response can be a direct snapshot or `{conversation: snapshot,...}`. Confirmation contains `{id,title,description,targets:[{id,title}],kind}`; only an explicitly confirmed, version-valid frozen proposal can execute permanent clearing. Refreshing state never resends a request. Retry does not replay a permanent-delete confirmation.

The frontend polls while work is running, without continually polling an idle conversation. Late open responses after navigation are immediately closed; replies for another conversation ID are rejected. The main project state refreshes after a completed manager turn or confirmation. Sending a request is not followed by an optimistic “saved” result.

The manager runs a hidden native Agent/Session through the official AgentLoop and ToolRuntime, using a complete concise system prompt and no outside conversation history. Successful turns resume the same session. Failed branches remain auditable; continuation forks only the last successful checkpoint, and explicit retry starts fresh. Project tools read/write memory through the existing deterministic store, inspect issues, organize the overview and read allowed project files. No shell or project-file writes. Global profile scope cannot access project files or project memory. User request provenance, receipts, diagnostics and native-session ownership are stored in `management.sqlite`; complete model/tool events use native DSH persistence. `diagnostics.nativeSessionId`, `nativeUserSeq` and `nativeEndSeq` link a page request to a Context Lite/native-log audit. These are diagnostic fields, not a receiving-session selector. Native manager logs follow the audit retention period and plugin-owned clearing contract.

The server binds the scope when opening. `nativeWorkspaceId`, when present, must resolve through the trusted registry and match the memory identity; it preserves the chosen worktree file-reading path. Client topic labels are presentation only. Model selection comes from `settings.models.manager`, defaulting to the configured `deepseek-official/deepseek-flash` route, not an external conversation's route.

## Other actions

| Action | Input | Behavior |
|---|---|---|
| `read` | project identity, `ids`, `include_noncurrent` | Read formal records; human management reads remain available while automatic memory is off |
| `project-toggle` | project identity, `enabled` | Enable/disable use and updating in ordinary work conversations |
| `project-dream-toggle` | project identity, `enabled` | Independently enable/disable automatic Dreamer |
| `dream` | project identity | Explicit manual consolidation; returns durable job acceptance |
| `include-sessions` | project identity, `sessionIds` | Include only the selected historical conversations |
| `settings-save` | settings including current revision | Validate model routes, interval and budgets; reject stale settings |
| `user-profile-toggle` | only changed `enabled` or `autoWrite` field | Independently control global profile injection/maintenance |

Only G2 may have a null model route. Manager, Dreamer and Reviewer require provider/model pairs. Dreamer minimum interval is at least 24 hours. Invalid forms retain edits. Cost fields stay unknown if the provider does not report them; cache reads are not a separate addition to total tokens.

The old `manage` action with an explicitly selected native session remains for compatibility with earlier callers. It is not used by the 0.3.0 UI. No current screen asks the user to select a receiving native session.

## Page, rendering and lifecycle

The home page contains current workspace cards, a global-profile entry and Settings. Within a workspace there are exactly two primary tabs: Current memory and Memory activity. The left shows an overview, topics, relevant records/issues or actual changes; the right retains the same manager. Narrow layouts switch reading/conversation areas while keeping the manager mounted.

Settings centralizes Models and consolidation, Workspace settings, Global profile controls, and Archive and history. Past conversations and removed-workspace memories are not scattered among daily reading controls. A disabled workspace remains readable. `default-workspace` receives the same localized display title as native DSH.

Memory activity includes real G1/G2/MEMORY_UI/DREAMING changes, overview organization and issue resolution. Execution-only events are not falsely shown as content changes. Metadata-only events do not render an empty diff disclosure. Task diagnostics and sources stay behind relevant disclosures; a global last-error string is not copied into every project/profile page.

`MarkdownText` renders authored text without raw HTML. Native Markdown may load HTTP(S) images, so text containing `![` is displayed escaped instead; CSS hiding is not used as a network safeguard. Source links are HTTP(S) only, with no opener. Styling uses host semantic colors, system fonts and Desktop frame clearance. Keyboard tab navigation, focus visibility and reduced-motion rules remain supported.

Catalog refreshes on native workspace snapshot changes, focus, mount, explicit successful settings changes and every 15s while visible. `useWorkspaces` projects native names/order/removals immediately. Project state refreshes per scope, on completed mutations, focus and visible periodic checks. Requests cancel on unmount and validate response identity. A deleted focus resets to current project context rather than reusing a missing memory/issue/topic.

A separate light `/status` monitor manages navigation registration and suppresses cached bodies when the service is unavailable. Cordis lifetimes release registrations and listeners. Legacy right-sidebar AutoMemory tabs close only via public APIs as their original sessions mount; other tabs are unaffected.

## Verification

Client tests cover scope-bound requests, slot lifecycle, settings constraints, usage distinctions, native workspace projection, fresh management entry/late-open cleanup, running-only polling, foreign-conversation reply rejection, direct global management and all-channel activity. Native-runtime integration tests exercise backend state, management and store invariants. GUI and real-model acceptance boundaries are summarized in [compatibility](docs/compatibility.md) and [evaluation](docs/evaluation.md). Controlled-model GUI checks do not establish real-provider model quality.

## 0.3.3 普通 Agent 的 JSON 工具参数兼容

原生 DSH `type:json` 允许任意 JSON 值，不替调用者解码字符串。真实 Z.ai GLM-5.3-Flash 会把 DraftResult 作为单层 JSON 字符串传入。`memory_submit` 与 `memory_resolve` 现同时接纳对象或单层对象 JSON 字符串；坏 JSON、标量、数组和双重编码拒绝，仍进入同一 DraftResult 校验与写入权限检查。`memory_resolve.expected_version` 明确为 `vN` 字符串。`user_profile_update.source_refs` 的每个元素也执行单层解码及 SourceRef 校验，自动维护开关不因此绕过。真实失败、修复与效果观察的公开摘要见 [evaluation](docs/evaluation.md)，本节仅说明工具边界。
