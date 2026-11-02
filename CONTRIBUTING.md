# Contributing

Use a supported Node version, pnpm10.33.0 and the committed lockfile. The exact tested baseline is in [compatibility](docs/compatibility.md).

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
pnpm run check
pnpm test
pnpm run verify:licenses
pnpm run verify:public
pnpm run verify:package
pnpm run test:package
```

The prebuilt `lib/` is committed for installation without lifecycle scripts. Rebuild it when source, prompts, schemas or package metadata change, and review the resulting diff. `verify:public` checks the exact Git index, so stage the intended public changes before running it. It does not automatically approve arbitrary untracked files.

Tests live in `test/`, with synthetic helpers under `test/fixtures/`. They use declared official DSH packages, temporary directories and a local deterministic LLM adapter. The optional-in-production Context Lite API compatibility test pins a public commit as a development dependency. It never needs a sibling repository, credentials, a personal DSH_HOME or a real model subscription. Initial dependency installation requires network access; test execution should not.

Keep behavior changes focused. Add meaningful regressions for source/scope/version boundaries, replay recovery or user-visible failures rather than tests that simply repeat implementation details. Preserve accepted/committed/cleanup-incomplete distinctions and explicit user intent for clearing. Do not make unknown usage or missing provenance appear known.

If a change affects real provider output, separately describe the model, fixture, observed result and limits. Do not commit raw personal transcripts. For public issues, include plugin/build/host versions and a small synthetic reproduction; redact secrets and unrelated material from screenshots.

See [SPEC.md](SPEC.md), [HOST-API.md](HOST-API.md), [UI-API.md](UI-API.md) and [core contracts](https://github.com/hope586/dsh-automemory/blob/v0.3.5/src/core/CORE-API.md). Native host APIs are preferred; version-sensitive adapters must document what is verified and refuse unsupported behavior. Public protocol compatibility is more useful than silent private-path fallbacks.

Contributions are under the repository's MIT license. Include original license notices for copied third-party material. Update the bundle inventory if build inputs change. No separate contributor agreement is required by this repository.
