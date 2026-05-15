# Changelog

All notable changes to `@kepello/nodegraph-patterns`. Format follows [Keep a Changelog](https://keepachangelog.com/).

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
