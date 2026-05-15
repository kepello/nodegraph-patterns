# Changelog

All notable changes to `@kepello/nodegraph-patterns`. Format follows [Keep a Changelog](https://keepachangelog.com/).

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
