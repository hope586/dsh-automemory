# dsh-automemory

[中文](README.md) · [Usage](docs/usage.md) · [Data and privacy](docs/privacy.md)

Project-scoped memory for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Carry decisions, their reasons, progress and working agreements across conversations; inspect and manage them on a dedicated memory page.

Independent community plugin, MIT licensed; not affiliated with or endorsed by DeepSeek. **Version 0.3.5 is a 0.x release.** Model-driven memory is selective and can omit, overgeneralize or retain stale information. Current project files and user judgment remain necessary.

## Features

- Enter through a workspace. Read the project overview, topics and unresolved issues; switch between current memory and actual changes.
- Read on the left and use a dedicated memory assistant on the right. A new visit starts fresh; topic/tab changes within a visit retain context.
- Working agents can record, read and request a stage audit. A project index is provided each turn; full entries are read on demand. Changes retain versions, sources and commit receipts.
- Dreamer consolidates new material when the project is idle, at least 24 rolling hours apart by default. Manual runs are available.
- A shared `$DSH_HOME/USER.md` holds personal preferences. Injection and automatic maintenance are separate controls; project facts remain project-scoped.
- Native DSH model configuration, Agent/Session, tool execution and logs. Optional [Context Lite](https://github.com/hope586/dsh-context-lite) auditing, with no runtime dependency on that plugin.

Web and Desktop share memory under the same `DSH_HOME`. Removing a workspace retains its memory and pauses automatic consolidation. Re-adding the same project restores the association. Settings, removed workspaces and historical-conversation inclusion live in one settings area.

## Install

Tested baseline: **DSH 0.2.1-rc.5, Node 22.22.2, macOS, Web/Desktop**. Declared version ranges do not imply every version or operating system has been tested. DSH and pnpm must already be installed.

Download `dsh-automemory-0.3.5.tgz` and `SHA256SUMS` from the [v0.3.5 Release](https://github.com/hope586/dsh-automemory/releases/tag/v0.3.5). Verify and install from the download directory:

```bash
shasum -a 256 -c SHA256SUMS
dsh plugin --profile web add ./dsh-automemory-0.3.5.tgz
```

On the verified host, this command automatically adds `dsh-automemory` to `dsh.profile.bundles` in `$DSH_HOME/profiles/web/package.json`. Check that the entry exists, preserve other bundles and restart that profile; do not add it twice.

**Desktop uses its in-app plugin manager.** Extract the release archive into an empty directory, add the local `package` directory containing `package.json` and `lib/` through Desktop's Plugins page, enable it and reload as prompted. The current CLI explicitly refuses to manage Electron's reserved `desktop` profile; do not simply replace `web` with `desktop` in the command above.

Pinned GitHub installation:

```bash
dsh plugin --profile web add github:hope586/dsh-automemory#v0.3.5
```

Both the release archive and tag include prebuilt `lib/`; users do not need a build step or development dependencies. Distribution is through GitHub, **not the npm registry**. `private:true` prevents accidental npm publishing; it does not restrict the MIT license or GitHub installation.

## First use

1. Open **Memory** above the workspace list, then select a workspace.
2. In memory settings, select model routes available in your DSH installation. The manager, Dreamer and Reviewer default to `deepseek-official / deepseek-flash` and are independently configurable. G2 follows its initiating work conversation by default, preserving its effective context.
3. Project memory is enabled by default and can be disabled per project. Old conversations are included only when explicitly selected in **Archive and history**.
4. Continue normal work or ask the memory assistant. An accepted request is queued work; a committed receipt and the activity view establish what actually changed.

Management, consolidation and review use your configured provider quota. Conversations, memory and permitted workspace evidence may be sent to that provider. Budget limits protect local scheduling; they are not exact billing or a hard monetary cap. See [usage](docs/usage.md) and [privacy](docs/privacy.md).

## Upgrade, disable and remove

Back up the relevant `DSH_HOME` before upgrading. Replace the installed bundle, retain its profile entry and restart the host. Update both hosts when they share data.

Disabling/removing the bundle stops the feature but preserves data. Disabling a project pauses ordinary recall, automatic writing and background work; its page remains readable and explicitly manageable. Global profile controls are independent. Uninstallation does not erase memory or logs. Default data paths are `$DSH_HOME/automemory`, `$DSH_HOME/USER.md` and the host's native session storage. Read the [deletion boundaries](docs/privacy.md) before clearing data.

## Development

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

Tests use declared public DSH dependencies, temporary synthetic projects and a deterministic local model adapter. No provider keys, paid calls or existing user home are required. A pinned public Context Lite package is a development-only dependency for the cross-plugin API test.

[Contributing](CONTRIBUTING.md) · [Specification](SPEC.md) · [Host adapter](HOST-API.md) · [UI/API](UI-API.md) · [Compatibility](docs/compatibility.md) · [Evaluation](docs/evaluation.md) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md)

[MIT](LICENSE). Bundled third-party code retains its own notices; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Maintainer conversations, memory databases, credentials and private acceptance logs are not part of this repository.
