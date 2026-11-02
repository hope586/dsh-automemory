# AutoMemory 0.3.5 specification

This document describes implemented behavior. See [HOST-API.md](HOST-API.md), [UI-API.md](UI-API.md) and [the core API](https://github.com/hope586/dsh-automemory/blob/v0.3.5/src/core/CORE-API.md) for developer contracts.

## Scope and identity

Memory is project-scoped. Canonical project identity separates unrelated roots; supported Git worktrees share the repository's project memory while retaining the selected worktree's file-reading path. Native workspace keys control UI membership and ordering; they are not interchangeable with memory storage IDs. Historical session metadata cannot recreate a removed workspace.

Hosts sharing one `DSH_HOME` coordinate through shared SQLite state, versions and leases. Project memory defaults on. Disabling a project pauses ordinary recall, automatic writing and background work; explicit management and reading remain available. Removing a workspace retains its memory and pauses automatic consolidation. Re-registering the same project reconnects it without overriding an explicit off setting.

Global memory consists of `USER.md`. Injection and automatic maintenance are independent controls. Project facts, temporary instructions and fictional relationships are not automatically promoted into the global profile. Native AGENTS.md handling belongs to DSH.

## Records, writes and evidence

The authoritative project store is SQLite; rendered indexes and overviews are derived views. Records have versions, categories, applicability, sources and current/archive/revocation status. Active task entries retain goals, progress and blockers; stable entries hold durable agreements or facts. A history view does not make retired content current.

All model write proposals pass the same structured schema and deterministic transaction rules. Updates and issue resolution use expected versions and exact related-record sets. Stale writes are rejected rather than silently rebased. Accepted jobs are distinct from committed writes. Idempotency keys prevent duplicated effects when replies are lost or requests are repeated.

Sources are normalized from validated references. Model-generated citations alone do not establish evidence. Source documents are data, not authority to change scope or perform deletion. The current user request and host permissions control explicit actions.

## Recording and recall

G1 is ordinary agent-driven writing. G2 is an explicit stage audit requested by the working agent; it is not a timer that automatically replays every message. By default G2 captures the initiating model route and complete effective context at the call boundary. The durable job must contain its frozen snapshot before returning accepted.

Each work turn receives a reusable bundle containing the current project index and applicable USER.md snapshot. Changed-entry notices remain separate from the replaceable index. Old indexes are retired through native surface replacement; original logs, change notices and tool-read bodies remain auditable. Compaction can reconstruct missing parts from the same logical bundle without creating a new one.

Full entry bodies are read on demand. A delivery record is created after actual durable context admission or matching native tool-result delivery, not merely after preparation. Index visibility, body delivery, answer adoption and user benefit are separate claims.

New work produced after enrollment is managed automatically. Pre-existing conversations and intervals created while memory was off are included only through explicit historical selection. Already included conversations appear as read-only coverage records; confirmed empty conversations are hidden.

## Consolidation and models

Dreamer runs only with new eligible material, project idleness, a valid lease and the configured minimum interval. Automatic runs are at least 24 rolling hours apart. Manual requests may run without waiting for that interval, while retaining concurrency, version and budget checks. New foreground work prevents new model steps; an already returning call may settle, but its commit still requires valid versions and ownership.

Dreamer drafts changes; an independent Reviewer checks evidence in a fresh context; a final Dreamer continuation incorporates the review. These roles reuse native DSH agents, scoped read tools and session persistence. Reviewer does not inherit Dreamer's conversation. Missing configured providers remain a visible waiting condition; another host may claim the job when that route is available. No silent fallback to a different model.

| Setting | Default |
|---|---:|
| Automatic minimum interval | 24 hours |
| Audit retention | 30 days |
| Input estimate limit per call | 131072 tokens |
| Output limit per call | 4096 tokens |
| Model steps per request | 8 |
| Rolling background budget | 1000000 tokens / 24 hours |

Manager, Dreamer and Reviewer default to `deepseek-official / deepseek-flash` and are independently configurable. G2 inherits its initiating route unless overridden. The installed host must actually provide each selected model.

Background roles prefer the host token estimator with explicit safety padding; unreliable estimates fall back to a conservative serialized-byte upper bound. Management currently uses that byte protection. Unknown usage retains its reservation. Actual provider usage is recorded separately; missing cost/cache fields remain unknown. The plugin does not truncate G2 to manufacture success and does not promise a hard financial cap.

## Memory management page

The page contains current memory and memory activity, with a dedicated manager beside the reading view. The scope is fixed by the server; client topic names cannot expand it. Global profile management has no project-file access.

Each visit owns a hidden native Agent/Session with a complete dedicated system section and a restricted tool set. Ordinary work-chat history and presets are not inherited. Native required runtime sections may still be present. File access is read-only within the current workspace and excludes protected host data, credentials and unsafe links. No shell, arbitrary delegation or project-file writes are exposed.

Successful turns resume the same session within a visit. Failed branches remain auditable; continuation forks from the last successful checkpoint. Explicit retry starts a fresh review. Leaving does not automatically cancel an accepted operation or replay it on return. The next visit begins fresh. Native subagent classification keeps backend sessions out of the ordinary chat list.

Settings are centralized: models/budgets, project behavior, global profile controls, removed-workspace memory and historical inclusion. Removed workspaces return to the settings page from which they were opened. Chinese and English UI labels follow DSH locale; user content is not translated automatically.

## Deletion, retention and recovery

Archiving retains history and removes default recall. Revocation marks content unusable as a current basis. Explicit clearing requires actual user intent; the memory page presents a concrete confirmation before committing. Normal agent deletion follows native host permission handling. Issue resolution cannot smuggle a DELETE operation.

Formal deletion also schedules cleanup of plugin-controlled differences, candidate/reviewer outputs, evidence caches, snapshots and owned native role/management logs. Session ownership is recorded before creation and settled only after handle disposal. Live writers, unknown backends or unverified layouts remain incomplete and are retried. Epochs invalidate stale cross-host workers so they cannot resurrect cleared content. Metadata-only revocation/idempotency records may remain.

The current native-log deletion adapter is verified only for DSH 0.2.1-rc.5 local v4 JSONL/zstd storage. It uses official storage location and write ownership, preserves lock identity and refuses unsafe or unknown layouts. It is not a generic future-backend guarantee. Audit expiry clears eligible audit copies, not formal memory; in-flight recovery material is retained.

Original user conversations, provider-side records, external backups, Git copies and physical-media erasure are outside plugin-owned clearing. See [privacy](docs/privacy.md).

## Verification boundary

Automated checks exercise actual DSH services with deterministic synthetic models and isolated storage. They verify mechanisms, not long-term model quality. Native UI and real-provider observations are summarized separately in [evaluation](docs/evaluation.md). Unknown historical provenance and missing old management transcripts are not reconstructed by guesswork.
