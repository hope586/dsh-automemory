# Security

This is a community0.x plugin, not a security-audited boundary for DeepSeek Harness. Use least-privilege host settings and disposable workspaces for experiments. Follow DSH's own security guidance as well.

For a security issue, use the repository's **Security → Report a vulnerability** flow when available. If private reporting is unavailable, contact the maintainer through their GitHub profile before sharing exploit details or sensitive logs. Never include API keys, complete memory databases or unrelated conversations in a public issue.

Useful reports identify the affected plugin/host version, the violated scope or permission boundary, and a minimal synthetic reproduction. Distinguish project-memory isolation from provider trust: selected conversation and workspace evidence may be transmitted to the configured model provider.

Fixes target the current release on its documented host baseline. No promise of backports for every older0.x version or unsupported storage backend is made. Data retention and deletion boundaries are described in [privacy](docs/privacy.md).
