# What the evaluation establishes

The purpose of memory is to preserve useful information across work: decisions and their reasons, constraints that are easy to forget, progress that would otherwise need reconstructing, and corrections the user should not have to repeat.

Answer accuracy alone is insufficient. An agent can inspect a current source file and answer correctly with no memory benefit. An honest “unknown” can be correct when nothing reliable was saved. Choosing not to save an ephemeral or file-derived detail is not automatically a defect.

## Evidence tiers

| Question | Evidence |
|---|---|
| Was it saved? | Formal record, source references, version and committed receipt |
| Was it provided this turn? | Native admission, index/change bundle and actual tool result |
| Did the answer use it? | Request context, retrieved body and answer/action, with alternative sources considered |
| Did it help? | Less repeated instruction, preserved rationale, smoother continuation and reduced correction effort |

An index may already contain a useful summary, so absence of `memory_read` is not proof that memory had no effect. Conversely, a successful read is not proof of comprehension or benefit. Keep these measures separate.

## Maintainer observations before the first public release

Synthetic project workflows were exercised through normal DSH UI with Z.ai models and a smaller DeepSeek Flash sample. Tests included cross-session decisions, project isolation, changing source files, unresolved choices, editing through the memory page, consolidation/review and memory-enabled/disabled comparisons.

Early acceptance found failures in evidence access, source coverage, disabled-period enrollment and manager recovery. Those findings led to engineering repairs; they were not relabeled as passing historical runs. Later checks observed useful continuity for conversation-only decisions, their reasons and collaboration corrections. They also retained examples of overgeneralization, related entries not being updated together, and manual correction.

The0.3.5 release additionally made manager conversations natively persistent and repaired audit-entry compatibility. It did not rerun a new large benchmark or prove that those changes improve semantic memory quality. The public automated suite validates mechanics and invariants; private raw logs, project identifiers and personal screenshots are not distributed.

## A practical review case

Suppose the user decides that debug lines should be hidden in a handoff report, while raw logs stay intact. Later, the code still includes debug lines. Useful memory preserves the user's decision and reason; current files establish what is actually implemented. A good continuation distinguishes the two and identifies the remaining work. Merely memorizing the current code output, or claiming the decision is already implemented, misses the point.

For daily reviews, preserve the request, memory version, actual context/reads, result and the user's correction cost. Include successes, omissions and honest unknowns. Do not turn an unblinded handful of examples into an overall effectiveness percentage. Longer-term usefulness remains a question for ordinary use.
