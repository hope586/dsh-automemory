# Compatibility and verification

## Tested baseline

| Component | Baseline |
|---|---|
| DeepSeek Harness | 0.2.1-rc.5 |
| Node.js | 22.22.2 |
| Platform | macOS |
| User interface | Web and Desktop |
| Optional context auditing | Context Lite0.3.1, commit `664de395479f2ec43b2591abb0dcb699d6a92b02` |
| Real models observed | Z.ai GLM-5.3 / GLM-5.3-Flash; limited DeepSeek Flash checks |

Package ranges permit compatible updates; they are not a promise that every0.2.x host, later Node version, model or operating system has been tested. Linux/Windows and long-duration multi-host stress are not claimed as accepted platforms by this release. Check host release notes before upgrading and repeat the relevant tests.

## Integration seams

The UI uses native keyed slots, workspace registry, locale, Markdown rendering and authenticated connection routes. The backend uses Cordis services, `agent/pre-step`, session events, native scoped tools, `agents.create/resume` and persisted sessions. AutoMemory does not replace the host's context selection or compression engine.

Memory indexes and updates are admitted through native context paths. Management and background sessions use native subagent classification, keeping ordinary session lists uncluttered. DSH's provider configuration supplies all model routes. Context Lite remains optional and observes these routes; no runtime dependency on it is introduced.

Native-log deletion currently needs a version-scoped storage adapter because the tested host exposes no generic log-deletion API. Unknown storage formats and live ownership fail closed as incomplete cleanup. This is the principal version-sensitive compatibility boundary.

## Automated checks

The public suite runs pure store/client tests and actual DSH AgentLoop/tool/session integrations with a deterministic model adapter. It covers recording, source normalization, project isolation, scope guards, stale writes, failed recovery, explicit deletion, retained workspaces, history selection, budgets and UI navigation contracts. All test data is synthetic and stored in temporary directories.

The Context Lite test installs a pinned public package and exercises its public export API in process. It does not import a sibling checkout or private audit runtime. Test transport mocks only the HTTP registration boundary; native session/query/replay behavior remains real. No API keys or external model calls are required by the suite.

Distribution checks separately inspect the exact staged Git files, dependency notices, rebuilt output and extracted tarball. The package smoke test loads the archive into a fresh host harness, exercises recording/recall/management, unloads it and verifies persistence on reload. These checks do not establish long-term semantic quality.

## Native UI and model observations

Maintainer acceptance exercised normal workspace navigation, manager requests, return paths, history controls and shared-host state. The0.3.5 native manager completed two real DeepSeek Flash requests in one native session; a Z.ai GLM-5.3-Flash ordinary turn showed `dsh-automemory` and `agent.pre-step` in Context Lite with observed admission evidence. Original unknown provenance remained unknown. Formal memory and settings were unchanged by that read-only check.

These are bounded observations, not complete coverage of every provider adapter or post-policy transform. Context Lite reconstructs host logical context, not a provider wire capture. See [evaluation](evaluation.md) for semantic limits and [CI](CI.md) for reproducible verification commands.
