# Reproducible checks and optional CI

The public suite uses frozen dependencies and synthetic local models. It needs no provider credentials or existing DSH home. Use the commands in [CONTRIBUTING.md](../CONTRIBUTING.md) to reproduce source checks, all tests, dependency-notice validation, the exact staged-public-tree scan and archive smoke tests.

The initial publication credential has repository access but does not include permission to create/update GitHub Actions workflows. No broader account permission was requested. This release therefore does not claim a remote CI pass. A clean local checkout with frozen dependencies is checked before release, including byte-identical rebuild and archive behavior.

[ci-example.yml](ci-example.yml) is an optional workflow template. A maintainer with workflow-authoring permission may install it as `.github/workflows/ci.yml`. It requests only read access to repository contents and no model/API secrets. Action versions are explicit; review and update them through ordinary dependency maintenance.

Do not substitute a hosted CI badge for source/package privacy review. The public checks flag known private paths and credential patterns and restrict allowed file types; they cannot establish that arbitrary prose or images contain no sensitive information. This initial repository intentionally includes no screenshots or private test transcripts.
