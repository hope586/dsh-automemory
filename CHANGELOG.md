# Changelog

## 0.3.7 — 2026-11-05

Performance and robustness patch release. It also ships the previously unreleased 0.3.6 model-selection changes; 0.3.6 was not published separately, so 0.3.7 is the first public release containing them. No data or settings migration is required from 0.3.5.

- Serve the UI-API `models` field of `/state` and `/global` from a server-side cache (30-second TTL, immediate invalidation when the provider list changes, parallel enumeration, bounded per-provider wait). The response shape is unchanged; values may lag host configuration by up to the TTL. The settings model picker reads the live native catalog and is unaffected.
- Replace one open-issue subquery per memory in browse and index rendering with a single grouped query. Output is identical, including per-issue reference ordering.
- Skip write transactions for duplicate or out-of-order session events; genuinely new events keep one write transaction each. Workspace enable/disable state is re-read under the write lock, so a switch flipped by another host between the pre-check and the transaction is honored.
- Release per-session controller bookkeeping (tool-call sequences, pending reads, session bindings, turn snapshots) when the host disposes a session.
- Sweep job-evidence directories left behind by crashed workers or replaced leases once the task reaches a terminal state; running tasks keep their evidence and plugin cleanup never touches host data.
- Guard model-route enumeration races: a stale enumeration cannot overwrite a newer cache entry, and a hung provider listing returns a bounded empty result and recovers after the TTL.
- Add `scripts/bench.mjs` so measurements can be reproduced on local synthetic fixtures. See [0.3.7 release notes](docs/RELEASE-NOTES-v0.3.7.md) for what those measurements do and do not establish.

## 0.3.6 — 2026-11-04 (not published separately; first shipped in 0.3.7)

- Replace separate provider/model text fields with a provider-grouped selector backed by the same native model catalog as conversations, using the host Menu component.
- Select the exact provider, model and supported reasoning effort together; G2 has an explicit “Follow originating session” option.
- Refresh model choices when host configuration changes; expose catalog failures without dropping saved routes from another host.

## 0.3.5 — 2026-11-02

First public MIT release of dsh-automemory.

- Project-scoped records, provenance, versions and transactional receipts; shared USER.md with independent controls.
- Workspace-based memory page with current memory, activity, themes/issues and a dedicated management chat; centralized settings and retained-workspace history.
- Native DSH management Agent/Session, tool execution and full logs. Successful requests resume within a visit; failed branches remain auditable and recovery starts from a successful boundary.
- Native role ownership, audit retention and explicit cleanup of plugin-controlled copies, with incomplete cleanup reported honestly.
- Stage audit, independent review and idle consolidation with model routing, evidence restrictions and rolling budgets.
- Compatibility with Context Lite 0.3.1 native admission provenance; no mandatory Context Lite runtime dependency.
- Public dependency-based test fixtures, pinned cross-plugin API test, clean-package smoke checks and distribution/license verification.

Earlier 0.1–0.3.4 builds were local development iterations, not public releases from this repository. Their failures informed the fixes; no historical logs or personal data are included. See [evaluation](docs/evaluation.md) for the limits of the real-model observations.
