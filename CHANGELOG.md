# Changelog

All notable changes to `@kepello/nodegraph-patterns`. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.7.0] — 2026-05-28

Adopt the per-overlay schema-version stamp (Fathom row 1.12.3). Exports `PATTERN_SCHEMA_VERSION` (= 1, V1 baseline) and declares it on the overlay's `OverlayRegistration`.

### Changed

- Registration now passes the mandatory `schemaVersion` field added in substrate 1.12.2. Peer dependency on `@kepello/nodegraph-core` retargeted to `^3.0.0`. No behavior change beyond the version stamp.

## [0.6.0] — 2026-05-28

O(N²)→O(N) pattern-matcher element lookups. Fathom row `perf-l6-pattern-matcher-linear-element-lookup` (5.0.1.6).

### Fixed

- The matcher helpers `methodNamesOfClass`, `fieldChildrenOfClass`, and `elementLabel` did a linear `ctx.elements.find((e) => e.id === id)` per child, inside per-class loops (`matchSingleton` / `matchFactoryMethod` / `matchObserver` / `matchCommand` / etc. iterate every class and call these). `classes()` also re-`filter`ed the whole element array once per matcher. On the EnvisionWeb .NET workspace (85,353 elements, ~5000 classes) this made L6 the dominant L2-L7 sub-phase at **45.6s — 53% of the 86.8s abstractions compute** (it was 161ms on the small Fathom workspace, so the cost only surfaced at scale).
- New `indexOf(ctx)` builds — once per `detectPatterns` run, cached by context identity in a `WeakMap` — an `elementById: Map` and a `classList`. The per-child helpers resolve through the Map (O(1)); `classes()` returns the precomputed list. No `PatternContext` type change and no caller change: `detectPatterns` passes the same context object to every matcher, so the index builds once and is reused across all matchers + helpers.

### Expected impact

L6 45.6s → low single-digit seconds; whole EnvisionWeb abstractions 86.8s → ~45s. The adapter/decorator matchers' `referencesEdges` loops are bounded by a name-hint pre-filter (few classes) and were left as-is. Sibling follow-on: L7b (`recoverDomainModel`, 14.7s / 20%) likely has the same linear-lookup shape — to be confirmed + filed separately.

### Tests

1 new Rule-4 pin in `matchers.test.ts` (spy on the elements array's `.find`): the matcher hot path does ZERO `Array.find` calls — children resolve via the index. Existing 43 cases unchanged; 44/44.

## [0.4.1] — 2026-05-17

Fix — `matchLayered` role naming disambiguates by layer number and guards against degenerate emissions. Closes Fathom row 5.1.4.1.2 (round-4 Opus pilot F4).

### Fixed

- Previous behavior emitted one role per cluster, all with role name `"layer"` — a Layered Architecture instance with 442 clusters produced 442 role entries with the same role name, and any substrate state that surfaced the same `clusterId` across `ctx.clusters` would collapse all bindings to a single elementId while still emitting an instance.
- Round-4 Opus pilot F4 surfaced one such degenerate emission on the Fathom workspace: all 40+ `layer` role bindings pointed to a single cluster `d553b7edc0d32005`, inflating the "1 architectural pattern detected" metric to look like coverage exists.
- New behavior: (a) role name encodes the layer number (`layer-0`, `layer-1`, `layer-2`, ...) so downstream consumers can read the per-layer distribution; (b) clusters without a known layer assignment are skipped; (c) degenerate-emission guard rejects instances where `distinctClusterCount < distinctLayerRoles` — a substrate state that can't fill distinct layers with distinct clusters is not architecturally meaningful.

### Tests

- New test pinning `layer-N` role-name shape with 4 clusters across 3 layers (4 distinct role bindings, 3 distinct layer role names).
- New test pinning the degenerate-emission guard (3 clusters all reporting the same `clusterId` → no instance emitted).
- All 43/43 package tests pass.

## [0.4.0] — 2026-05-17

Fix — `matchHexagonal` collapses to a single workspace-level instance with multi-element roles. Closes Fathom row 5.1.4.1 (F4 sub-finding).

### Fixed

- Previous behavior emitted one Hexagonal Architecture instance per domain-flavor cluster, with each instance carrying ALL detected ports + ALL detected adapters. With N domain clusters this produced N near-duplicate instances — the same port set + adapter set, only `domainCore` varying. On the Fathom workspace the L6 pattern surface returned 10+ such instances and overflowed the MCP response budget (168 kB) on `family=architectural` queries.
- New behavior: ONE instance per workspace. The `domainCore` role list aggregates every domain-flavor cluster; the `port` role list aggregates every port-flavor cluster; the `adapter` role list aggregates every adapter-flavor cluster. Score reflects which of the three role kinds are populated, not how many clusters in each.
- "Hexagonal Architecture" is by definition a workspace-level shape — multiple domain cores in a multi-bounded-context system aren't separate architectural patterns; they're domain faces of the same hexagonal arrangement.

### Tests

- New regression test `matchHexagonal — single workspace-level instance when multiple domain clusters share ports/adapters (Fathom 5.1.4.1)`: 3 domain + 2 port + 1 adapter clusters → 1 instance with 3+2+1 role bindings (was 3 instances pre-fix).
- Existing single-domain tests still pass (the change is purely additive aggregation when N > 1; same behavior at N = 1). 41/41 matcher tests pass.

## [0.3.0] — 2026-05-15

Closes Fathom row `l6-role-edge-collapse` (3.3.3). `PatternOverlayImpl.insertPattern` now collapses role bindings that target the same elementId before emitting role edges — the substrate's edge identity is `(source, target, type)` (subtype is NOT part of the uniqueness key), so prior versions tripped `edges_live_unique_dangling` on patterns like Hexagonal Architecture where one cluster fills both `port` and `adapter` roles.

### Changed

- `insertPattern` deduplicates roles by `(target)` at insert time. First role wins on the edge surface. The pattern node's `metadata.roles` array still carries every role entry — consumers reading the full binding via `getPattern(id).metadata.roles` see all roles; consumers reading via `rolesOf(id)` (edge surface) see one edge per target.
- Pre-`0.3.0` dedup logic keyed `existingPairs` by `(subtype, target)`, which allowed same-target different-subtype to pass through and then collide at substrate insert time. The new logic keys by `(target)` only — matching the substrate's actual uniqueness constraint.

### Fixed

- Surfaced 2026-05-15 by the first end-to-end `fathom analyze` run after `fathom-analyze-runs-phase-3` (3.3.2) shipped. The Hexagonal Architecture matcher emits both `port` and `adapter` roles targeting the same cluster when port-flavor and adapter-flavor names overlap — every Hexagonal detection tripped the UNIQUE constraint and surfaced as a warning in the analyze output. Post-fix, Hexagonal patterns persist cleanly with collapsed role edges.

### Tests

- 40/40 pass (was 39; +1 regression test in `overlay.test.ts` pinning the collapse behavior + verifying metadata.roles preserves the full binding list).

## [0.2.0] — 2026-05-15

Closes Fathom row `l6-hexagonal-role-display` (3.2.5) — first Tier-1 Phase 3 fix shipped from the 2026-05-14 smoke output. Pattern roles now carry human-readable labels so consumers (MCP output, inspect viewer, audit reports) can render role bindings without dereferencing the role target.

### Changed (breaking)

- `PatternInstanceRole` adds required `displayLabel: string`. Every matcher populates it: element-targeted roles use the element's `name`; cluster-targeted roles (`matchHexagonal` `domainCore`/`port`/`adapter` + `matchLayered` `layer`) use `cluster.displayName ?? cluster.name`. Pre-`0.2.0` callers constructing `PatternInstance`s directly must add the field; consumers reading persisted `PatternMetadata.roles` see the new field on every freshly-detected node. Existing graph nodes from `0.1.x` runs lack `displayLabel` — Fathom is pre-prod, accepted operator workflow is to delete + rebuild `.fathom/graph.db`.

### Added

- `matchers.test.ts` regression test pinning hexagonal role `displayLabel`s to cluster names (cluster `displayName` wins over `name`).
- Same coverage for `matchSingleton` confirming element-side labels resolve through `name`, not `id`.

### Rationale

Phase 3 smoke output against the Fathom workspace 2026-05-14 surfaced opaque hash-shaped `clusterId`s in hexagonal role lists. The fix is structural: the role binding carries enough information to format itself, so the MCP wrapper (`phase-3-mcp-surface`, 3.3.1) can render role lists without a second graph round-trip.

## [0.1.0] — 2026-05-14

Initial publish. Sixth layer of the workspace Layered Code Abstraction arc (Fathom work row `l6-pattern-overlay` 3.1.6, per `docs/code_abstraction.md` L6).

### Added

- `PATTERN_DOMAIN` + `PATTERN_METADATA_SCHEMA` + indexes (`patterns_by_pattern_id` unique, `patterns_by_pattern_name`, `patterns_by_language`).
- `PatternInstance`, `PatternInstanceRole`, `PatternMetadata`, `PatternInput`, `PatternNode`, `PatternOverlay` interfaces; `ROLE_EDGE_TYPE` constant.
- `makePatternOverlay(graph)` factory — registers domain + indexes; exposes `insertPattern`, `tombstonePattern`, `listPatterns`, `getPattern`, `patternsByName`, `patternsForElement` (incoming role edges).
- `detectPatterns(context, options?)` — runs all matchers, applies a confidence threshold (default 0.6), returns ordered `PatternInstance[]`.
- Per-pattern matcher functions: `matchSingleton`, `matchFactoryMethod`, `matchAdapter`, `matchDecorator`, `matchObserver`, `matchCommand`, `matchLayered`, `matchHexagonal`, `matchGodClass`. Each is invokable individually for testing or custom pipelines.
- `computePatternId(patternName, roleIds)` — stable content-hash identity helper.

### v1 catalog

| Family | Pattern | Inputs |
| --- | --- | --- |
| GoF | Observer | class with collection field + notify-named method |
| GoF | Factory Method | L1 method-stereotype `factory` or create-named method |
| GoF | Singleton | class with `getInstance`-named method + private/static field hint |
| GoF | Decorator | class name + inheritance + same-interface field |
| GoF | Adapter | class name + inheritance + reference to second interface |
| GoF | Command | class with `execute`-named method or L1 classStereotype `command` |
| Architectural | Layered | L4 layer assignments with low back-edge ratio |
| Architectural | Hexagonal | clusters with port/adapter naming around a domain core |
| Anti-pattern | god-class | L1 classStereotype `large-class` |

### Trade-offs (v1 — documented limitations)

- **Confidence scores are heuristic ranks**, not calibrated against external pattern-detection benchmarks (DPB, P-MARt). Calibration parked as Fathom `l6-confidence-calibration` (3.1.6.5).
- **Dispatch-dependent GoF patterns** (Strategy, Template Method, State, Visitor) deferred — gated on Fathom `l2-virtual-dispatch-protocol-extension` (3.1.2.1).
- **Architectural pattern coverage limited** to Layered + Hexagonal in v1. MVC / Pipe-Filter / CQRS / Event-Driven / Microkernel parked as `l6-architectural-pattern-extension` (3.1.6.2).
- **Additional anti-patterns** (shotgun surgery, blob, dispersed coupling, lazy class) parked as `l6-additional-anti-patterns` (3.1.6.3).
- **Hardcoded matchers**; declarative DSL parked as `l6-declarative-pattern-dsl` (3.1.6.4).
- **Body-level analysis absent** — matchers rely on L0 structure + L1 labels + naming heuristics. Some GoF patterns score low without AST body inspection; trade-off accepted for v1.

### Schema-versioning note

Registers without `schemaVersion` because `nodegraph-core@1.1.1` doesn't yet enforce the field. Will declare `schemaVersion: 1` when Fathom row `overlay-version-and-migration-substrate` (1.12.2) ships. Same posture as the other Phase-3 packages.
