# @kepello/nodegraph-patterns

Design + architectural pattern detection for [`@kepello/nodegraph`](https://github.com/kepello/nodegraph-core). Sixth layer of the Layered Code Abstraction arc (L6 in [Fathom's roadmap](https://github.com/kepello/Fathom/blob/main/docs/code_abstraction.md#l6--pattern-detection)).

Constraint-relaxation matching over the typed L1 (stereotypes) + L3 (clusters) + L4 (layers) facts produced by upstream layers. Each pattern instance comes with a `confidenceScore ∈ [0, 1]` — operator-tunable filtering.

## v1 catalog

- **GoF patterns** (6): Observer, Factory Method, Singleton, Decorator, Adapter, Command.
- **Architectural patterns** (2): Layered, Hexagonal.
- **Anti-patterns** (1): god-class.

Each matcher is a hardcoded function in `src/matchers.ts`. Adding patterns means adding a function; no DSL yet (parked as Fathom `l6-declarative-pattern-dsl` 3.1.6.4).

## Quick start

```ts
import { detectPatterns, makePatternOverlay } from "@kepello/nodegraph-patterns";

const overlay = makePatternOverlay(graph);
const result = detectPatterns({
  elements: [...],
  inheritsEdges: new Map([...]),
  callsEdges: [...],
  callsMethodEdges: [...],
  accessesFieldEdges: [...],
  referencesEdges: [...],
  methodStereotypes: new Map([...]),
  classStereotypes: new Map([...]),
  childrenOf: new Map([...]),
  parentOf: new Map([...]),
  clusters: [...],
  clusterByElement: new Map([...]),
  layerByCluster: new Map([...]),
}, { minConfidence: 0.6 });

for (const instance of result.instances) {
  overlay.insertPattern(instance);
}
```

## Surface

- `detectPatterns(context, options?)` — runs all matchers, applies confidence threshold (default 0.6), returns ordered `PatternInstance[]`.
- Per-pattern matcher functions (`matchSingleton`, `matchFactoryMethod`, `matchAdapter`, `matchDecorator`, `matchObserver`, `matchCommand`, `matchLayered`, `matchHexagonal`, `matchGodClass`) — invokable individually for testing or custom pipelines.
- `computePatternId(patternName, roleIds)` — stable content-hash identity helper.
- `makePatternOverlay(graph)` — registers the `"pattern-instance"` domain + indexes; exposes write / read API.

## Trade-offs

- **Heuristic confidence scores** are internal ranks, not calibrated against external pattern-detection benchmarks (DPB, P-MARt). Operator audit may reveal calibration is required; parked as Fathom `l6-confidence-calibration` (3.1.6.5).
- **Dispatch-dependent GoF patterns** (Strategy, Template Method, State, Visitor) deferred — the wire protocol doesn't yet surface virtual-dispatch info. Parked as Fathom `l6-dispatch-dependent-patterns` (3.1.6.1), gated on `l2-virtual-dispatch-protocol-extension` (3.1.2.1).
- **Architectural pattern coverage limited to Layered + Hexagonal** in v1. MVC, Pipe-Filter, CQRS, Event-Driven, Microkernel parked as `l6-architectural-pattern-extension` (3.1.6.2).
- **Additional anti-patterns** (shotgun surgery, blob, dispersed coupling, lazy class) parked as `l6-additional-anti-patterns` (3.1.6.3); v1 only ships god-class.
- **Hardcoded matchers** — adding new patterns requires code changes. Declarative DSL parked as `l6-declarative-pattern-dsl` (3.1.6.4).
- **Body-level analysis absent** — matchers use L0 structure + L1 labels + naming heuristics; no AST body parsing. Some patterns (Decorator delegation, Observer notify-loop) score low without it.
