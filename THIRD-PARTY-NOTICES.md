# Third-party notices

AutoMemory's own source is licensed under [MIT](LICENSE). Third-party components retain their respective copyrights and license terms.

## Code included in the bundle

The inventory is verified against esbuild's actual host and client input graphs by `pnpm run verify:licenses`, using the committed dependency lockfile. Development dependencies are not automatically treated as redistributed runtime code.

| Component | Version | License | Unmodified copy |
|---|---|---|---|
| [Ajv](https://github.com/ajv-validator/ajv) | 8.20.0 | MIT | [Ajv-MIT.txt](licenses/Ajv-MIT.txt) |
| [ajv-formats](https://github.com/ajv-validator/ajv-formats) | 3.0.1 | MIT | [Ajv-formats-MIT.txt](licenses/Ajv-formats-MIT.txt) |
| [fast-deep-equal](https://github.com/epoberezkin/fast-deep-equal) | 3.1.3 | MIT | [fast-deep-equal-MIT.txt](licenses/fast-deep-equal-MIT.txt) |
| [json-schema-traverse](https://github.com/epoberezkin/json-schema-traverse) | 1.0.0 | MIT | [json-schema-traverse-MIT.txt](licenses/json-schema-traverse-MIT.txt) |
| [fast-uri](https://github.com/fastify/fast-uri) | 3.1.9 | BSD-3-Clause | [fast-uri-BSD-3-Clause.txt](licenses/fast-uri-BSD-3-Clause.txt) |

The fast-uri license retains Gary Court's uri-js attribution and The Fastify team's attribution, redistribution conditions and disclaimer. License versions and SHA-256 hashes are recorded in [bundled-components.json](licenses/bundled-components.json); copies are compared byte-for-byte with the installed packages. Update this inventory when bundle inputs change.

Ajv declares require-from-string, but the current entry does not include that package in esbuild's input graph. If a future build starts including it, add its original license before distribution.

## Host-provided and development components

`@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-tools` and `@deepseek-ai/dsh-llm` remain external host imports. React and native client UI services are supplied by DSH's ModuleLoader. Node.js and its SQLite implementation belong to the host runtime. Those runtime distributions are not copied into the AutoMemory bundle.

esbuild and the declared DSH test dependencies are development tools, not bundled executables. The Context Lite compatibility test installs a pinned public MIT package as a development dependency and calls its public API; its code is not copied into AutoMemory's source or runtime bundle. The repository contains its own small synthetic host harness, not a vendored host runtime.

The client uses inline geometric paths and host-rendered UI components; no separate icon font or DeepSeek logo asset is shipped. User screenshots, credentials, databases, raw session logs and private acceptance reports are excluded from both this public source repository and the distribution archive.

The archive includes this notice and the full `licenses/` directory. Separate installation of a host or development dependency remains subject to that component's own license.
