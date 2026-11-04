# Changelog

## 0.3.6 — 2026-11-04

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
