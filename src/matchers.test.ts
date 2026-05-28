/**
 * Per-matcher tests. Each pattern gets at least one positive fixture
 * (matcher fires with confidence > 0) and one negative (matcher
 * doesn't fire), per testing-standards Rule 6.
 *
 * Fixtures use synthetic `PatternContext` shapes — small enough to
 * hand-trace, dense enough to exercise the heuristic.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import type {
  ClusterInfo,
  PatternContext,
  PatternEdge,
  PatternElement,
} from "./context.js";
import {
  matchAdapter,
  matchCommand,
  matchDecorator,
  matchFactoryMethod,
  matchGodClass,
  matchHexagonal,
  matchLayered,
  matchObserver,
  matchSingleton,
} from "./matchers.js";

interface BuildOpts {
  elements?: PatternElement[];
  inheritsEdges?: ReadonlyMap<string, readonly string[]>;
  callsEdges?: PatternEdge[];
  callsMethodEdges?: PatternEdge[];
  accessesFieldEdges?: PatternEdge[];
  referencesEdges?: PatternEdge[];
  methodStereotypes?: ReadonlyMap<string, string>;
  classStereotypes?: ReadonlyMap<string, string>;
  childrenOf?: ReadonlyMap<string, readonly string[]>;
  parentOf?: ReadonlyMap<string, string>;
  clusters?: ClusterInfo[];
  clusterByElement?: ReadonlyMap<string, string>;
  layerByCluster?: ReadonlyMap<string, number>;
}

function buildContext(opts: BuildOpts = {}): PatternContext {
  return {
    elements: opts.elements ?? [],
    inheritsEdges: opts.inheritsEdges ?? new Map(),
    callsEdges: opts.callsEdges ?? [],
    callsMethodEdges: opts.callsMethodEdges ?? [],
    accessesFieldEdges: opts.accessesFieldEdges ?? [],
    referencesEdges: opts.referencesEdges ?? [],
    methodStereotypes: opts.methodStereotypes ?? new Map(),
    classStereotypes: opts.classStereotypes ?? new Map(),
    childrenOf: opts.childrenOf ?? new Map(),
    parentOf: opts.parentOf ?? new Map(),
    clusters: opts.clusters ?? [],
    clusterByElement: opts.clusterByElement ?? new Map(),
    layerByCluster: opts.layerByCluster ?? new Map(),
  };
}

// --- matchSingleton -------------------------------------------------------

test("matchSingleton — fires on class with getInstance method + field", () => {
  const ctx = buildContext({
    elements: [
      { id: "Logger", name: "Logger", kind: "class" },
      { id: "Logger.getInstance", name: "getInstance", kind: "method" },
      { id: "Logger.instance", name: "instance", kind: "field" },
    ],
    childrenOf: new Map([
      ["Logger", ["Logger.getInstance", "Logger.instance"]],
    ]),
  });
  const out = matchSingleton(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternName, "Singleton");
  assert.ok(out[0].confidenceScore > 0.5);
});

test("matchSingleton — doesn't fire on class without singleton method name", () => {
  const ctx = buildContext({
    elements: [
      { id: "Utility", name: "Utility", kind: "class" },
      { id: "Utility.normalize", name: "normalize", kind: "method" },
    ],
    childrenOf: new Map([["Utility", ["Utility.normalize"]]]),
  });
  assert.equal(matchSingleton(ctx).length, 0);
});

// --- matchFactoryMethod ---------------------------------------------------

test("matchFactoryMethod — fires when method has L1 'factory' stereotype", () => {
  const ctx = buildContext({
    elements: [
      { id: "UserBuilder", name: "UserBuilder", kind: "class" },
      { id: "UserBuilder.create", name: "create", kind: "method" },
    ],
    childrenOf: new Map([["UserBuilder", ["UserBuilder.create"]]]),
    methodStereotypes: new Map([["UserBuilder.create", "factory"]]),
  });
  const out = matchFactoryMethod(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternName, "Factory Method");
});

test("matchFactoryMethod — fires on naming convention even without stereotype", () => {
  const ctx = buildContext({
    elements: [
      { id: "Foo", name: "FooFactory", kind: "class" },
      { id: "Foo.makeThing", name: "makeThing", kind: "method" },
    ],
    childrenOf: new Map([["Foo", ["Foo.makeThing"]]]),
  });
  const out = matchFactoryMethod(ctx);
  assert.equal(out.length, 1);
  // Naming alone: 0.3 (method) + 0.2 (class) = 0.5
  assert.ok(out[0].confidenceScore >= 0.4);
});

test("matchFactoryMethod — doesn't fire on plain non-factory method", () => {
  const ctx = buildContext({
    elements: [
      { id: "Service", name: "Service", kind: "class" },
      { id: "Service.handleRequest", name: "handleRequest", kind: "method" },
    ],
    childrenOf: new Map([["Service", ["Service.handleRequest"]]]),
  });
  assert.equal(matchFactoryMethod(ctx).length, 0);
});

// --- matchAdapter ---------------------------------------------------------

test("matchAdapter — fires on Adapter-named class with inherits + references", () => {
  const ctx = buildContext({
    elements: [
      { id: "LegacyAdapter", name: "LegacyAdapter", kind: "class" },
      { id: "INewApi", name: "INewApi", kind: "interface" },
      { id: "LegacyService", name: "LegacyService", kind: "class" },
    ],
    inheritsEdges: new Map([["LegacyAdapter", ["INewApi"]]]),
    referencesEdges: [{ source: "LegacyAdapter", target: "LegacyService" }],
  });
  const out = matchAdapter(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternName, "Adapter");
});

test("matchAdapter — doesn't fire on class without Adapter naming", () => {
  const ctx = buildContext({
    elements: [
      { id: "Bridge", name: "Bridge", kind: "class" },
      { id: "INewApi", name: "INewApi", kind: "interface" },
    ],
    inheritsEdges: new Map([["Bridge", ["INewApi"]]]),
  });
  assert.equal(matchAdapter(ctx).length, 0);
});

// --- matchDecorator -------------------------------------------------------

test("matchDecorator — fires on Decorator-named class with inheritance + reference to inherited", () => {
  const ctx = buildContext({
    elements: [
      { id: "LoggingDecorator", name: "LoggingDecorator", kind: "class" },
      { id: "IService", name: "IService", kind: "interface" },
    ],
    inheritsEdges: new Map([["LoggingDecorator", ["IService"]]]),
    referencesEdges: [{ source: "LoggingDecorator", target: "IService" }],
  });
  const out = matchDecorator(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternName, "Decorator");
});

test("matchDecorator — doesn't fire on plain class without Decorator naming", () => {
  const ctx = buildContext({
    elements: [
      { id: "ServiceImpl", name: "ServiceImpl", kind: "class" },
      { id: "IService", name: "IService", kind: "interface" },
    ],
    inheritsEdges: new Map([["ServiceImpl", ["IService"]]]),
  });
  assert.equal(matchDecorator(ctx).length, 0);
});

// --- matchObserver --------------------------------------------------------

test("matchObserver — fires on class with listeners field + notify method", () => {
  const ctx = buildContext({
    elements: [
      { id: "Publisher", name: "Publisher", kind: "class" },
      { id: "Publisher.listeners", name: "listeners", kind: "field" },
      { id: "Publisher.notifyAll", name: "notifyAll", kind: "method" },
    ],
    childrenOf: new Map([
      ["Publisher", ["Publisher.listeners", "Publisher.notifyAll"]],
    ]),
  });
  const out = matchObserver(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternName, "Observer");
});

test("matchObserver — doesn't fire without both collection field AND notify method", () => {
  const ctx = buildContext({
    elements: [
      { id: "Bag", name: "Bag", kind: "class" },
      { id: "Bag.items", name: "items", kind: "field" },
      { id: "Bag.add", name: "add", kind: "method" },
    ],
    childrenOf: new Map([["Bag", ["Bag.items", "Bag.add"]]]),
  });
  assert.equal(matchObserver(ctx).length, 0);
});

// --- matchCommand ---------------------------------------------------------

test("matchCommand — fires on class with execute method", () => {
  const ctx = buildContext({
    elements: [
      { id: "SaveCommand", name: "SaveCommand", kind: "class" },
      { id: "SaveCommand.execute", name: "execute", kind: "method" },
    ],
    childrenOf: new Map([["SaveCommand", ["SaveCommand.execute"]]]),
  });
  const out = matchCommand(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternName, "Command");
});

test("matchCommand — fires on L1 classStereotype 'command' even without execute", () => {
  const ctx = buildContext({
    elements: [
      { id: "Op", name: "DoOp", kind: "class" },
      { id: "Op.invoke", name: "invoke", kind: "method" },
    ],
    childrenOf: new Map([["Op", ["Op.invoke"]]]),
    classStereotypes: new Map([["Op", "command"]]),
  });
  // `invoke` matches COMMAND_METHOD_PATTERNS so it'll match by name too;
  // both signals contribute to confidence.
  const out = matchCommand(ctx);
  assert.equal(out.length, 1);
  assert.ok(out[0].confidenceScore >= 0.8);
});

test("matchCommand — doesn't fire on plain class without execute or stereotype", () => {
  const ctx = buildContext({
    elements: [
      { id: "Foo", name: "Foo", kind: "class" },
      { id: "Foo.bar", name: "bar", kind: "method" },
    ],
    childrenOf: new Map([["Foo", ["Foo.bar"]]]),
  });
  assert.equal(matchCommand(ctx).length, 0);
});

// --- matchLayered ---------------------------------------------------------

test("matchLayered — fires when ≥3 layers with no back-edges", () => {
  // Layer 0 (data), Layer 1 (domain), Layer 2 (controllers). All deps
  // point down (lower layer numbers).
  const ctx = buildContext({
    clusters: [
      { clusterId: "data", name: "data", memberCount: 5 },
      { clusterId: "domain", name: "domain", memberCount: 5 },
      { clusterId: "controllers", name: "controllers", memberCount: 5 },
    ],
    layerByCluster: new Map([
      ["data", 0],
      ["domain", 1],
      ["controllers", 2],
    ]),
    clusterByElement: new Map([
      ["a", "controllers"],
      ["b", "domain"],
      ["c", "data"],
    ]),
    callsEdges: [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ],
  });
  const out = matchLayered(ctx);
  assert.equal(out.length, 1);
  assert.ok(out[0].confidenceScore > 0.7);
});

test("matchLayered — doesn't fire with fewer than 3 layers", () => {
  const ctx = buildContext({
    clusters: [
      { clusterId: "c1", name: "c1", memberCount: 1 },
      { clusterId: "c2", name: "c2", memberCount: 1 },
    ],
    layerByCluster: new Map([
      ["c1", 0],
      ["c2", 1],
    ]),
    callsEdges: [],
  });
  assert.equal(matchLayered(ctx).length, 0);
});

test("matchLayered — emits one role per cluster with layer-N role name", () => {
  // Two clusters per layer; roles disambiguate by layer number.
  const ctx = buildContext({
    clusters: [
      { clusterId: "data1", name: "data1", memberCount: 5 },
      { clusterId: "data2", name: "data2", memberCount: 5 },
      { clusterId: "domain1", name: "domain1", memberCount: 5 },
      { clusterId: "controllers1", name: "controllers1", memberCount: 5 },
    ],
    layerByCluster: new Map([
      ["data1", 0],
      ["data2", 0],
      ["domain1", 1],
      ["controllers1", 2],
    ]),
    clusterByElement: new Map([
      ["a", "controllers1"],
      ["b", "domain1"],
      ["c", "data1"],
    ]),
    callsEdges: [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ],
  });
  const out = matchLayered(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].roles.length, 4);
  const roleNames = new Set(out[0].roles.map((r) => r.role));
  assert.deepEqual([...roleNames].sort(), ["layer-0", "layer-1", "layer-2"]);
  const clusterIds = new Set(out[0].roles.map((r) => r.elementId));
  assert.equal(clusterIds.size, 4);
});

test("matchLayered — rejects degenerate emission (single cluster across all layer roles)", () => {
  // Fathom row 5.1.4.1.2: a substrate state where every cluster reports
  // the same clusterId yields role bindings whose distinct-cluster
  // cardinality is below the distinct-layer count. The guard should
  // drop the instance rather than emit a structurally-meaningless one.
  const ctx = buildContext({
    clusters: [
      { clusterId: "only", name: "only", memberCount: 5 },
      { clusterId: "only", name: "only", memberCount: 5 },
      { clusterId: "only", name: "only", memberCount: 5 },
    ],
    layerByCluster: new Map([["only", 0]]),
    clusterByElement: new Map([
      ["a", "only"],
      ["b", "only"],
    ]),
    callsEdges: [{ source: "a", target: "b" }],
  });
  assert.equal(matchLayered(ctx).length, 0);
});

// --- matchHexagonal -------------------------------------------------------

test("matchHexagonal — fires when domain core + ports + adapters present", () => {
  const ctx = buildContext({
    clusters: [
      { clusterId: "domain-core", name: "user-domain", memberCount: 5 },
      { clusterId: "user-port", name: "user-port", memberCount: 3 },
      { clusterId: "user-adapter", name: "user-adapter", memberCount: 4 },
    ],
  });
  const out = matchHexagonal(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternName, "Hexagonal Architecture");
});

test("matchHexagonal — single workspace-level instance when multiple domain clusters share ports/adapters (Fathom 5.1.4.1)", () => {
  // Regression: pre-5.1.4.1, the matcher emitted ONE instance per
  // domain cluster, each carrying ALL ports + ALL adapters. With
  // multiple domain-named clusters this produced a Cartesian-product
  // blowup of near-duplicate instances on the Fathom workspace
  // (10+ instances, only `domainCore` varying). The fix collapses
  // to ONE workspace-level instance with multi-element roles.
  const ctx = buildContext({
    clusters: [
      { clusterId: "domain-a", name: "user-domain", memberCount: 5 },
      { clusterId: "domain-b", name: "order-domain", memberCount: 5 },
      { clusterId: "domain-c", name: "billing-core", memberCount: 5 },
      { clusterId: "port1", name: "x-port", memberCount: 1 },
      { clusterId: "port2", name: "y-port", memberCount: 1 },
      { clusterId: "adapter1", name: "x-adapter", memberCount: 1 },
    ],
  });
  const out = matchHexagonal(ctx);
  assert.equal(out.length, 1, "must emit one instance per workspace, not per domain cluster");
  const domainRoles = out[0].roles.filter((r) => r.role === "domainCore");
  const portRoles = out[0].roles.filter((r) => r.role === "port");
  const adapterRoles = out[0].roles.filter((r) => r.role === "adapter");
  assert.equal(domainRoles.length, 3);
  assert.equal(portRoles.length, 2);
  assert.equal(adapterRoles.length, 1);
});

test("matchHexagonal — doesn't fire without domain-flavor cluster", () => {
  const ctx = buildContext({
    clusters: [
      { clusterId: "x-port", name: "x-port", memberCount: 1 },
      { clusterId: "x-adapter", name: "x-adapter", memberCount: 1 },
    ],
  });
  assert.equal(matchHexagonal(ctx).length, 0);
});

// Regression pin for Fathom row `l6-hexagonal-role-display` (3.2.5):
// hexagonal roles must carry human-readable `displayLabel`s — not the
// opaque clusterId hashes that drove the Phase 3 smoke output to render
// roles as unreadable strings. Cluster `displayName` wins over `name`
// when both are present.
test("matchHexagonal — roles carry cluster displayName / name as displayLabel", () => {
  const ctx = buildContext({
    clusters: [
      { clusterId: "abc123", name: "user-domain", displayName: "User Domain", memberCount: 5 },
      { clusterId: "def456", name: "user-port", memberCount: 3 },
      { clusterId: "ghi789", name: "user-adapter", memberCount: 4 },
    ],
  });
  const out = matchHexagonal(ctx);
  assert.equal(out.length, 1);
  const labelsByRole = new Map(out[0].roles.map((r) => [r.role + ":" + r.elementId, r.displayLabel]));
  assert.equal(labelsByRole.get("domainCore:abc123"), "User Domain");
  assert.equal(labelsByRole.get("port:def456"), "user-port");
  assert.equal(labelsByRole.get("adapter:ghi789"), "user-adapter");
});

// Same coverage on the element side — singleton roles should carry the
// element's `name`, not the opaque id (which often IS the name in
// fixtures, but won't be in real-world graphs where ids are hashed
// natural-keys).
test("matchSingleton — roles carry element name as displayLabel", () => {
  const ctx = buildContext({
    elements: [
      { id: "hash-A", name: "Logger", kind: "class" },
      { id: "hash-B", name: "getInstance", kind: "method" },
      { id: "hash-C", name: "instance", kind: "field" },
    ],
    childrenOf: new Map([["hash-A", ["hash-B", "hash-C"]]]),
  });
  const out = matchSingleton(ctx);
  assert.equal(out.length, 1);
  const labelsByRole = new Map(out[0].roles.map((r) => [r.role + ":" + r.elementId, r.displayLabel]));
  assert.equal(labelsByRole.get("singleton:hash-A"), "Logger");
  assert.equal(labelsByRole.get("accessor:hash-B"), "getInstance");
});

// --- matchGodClass --------------------------------------------------------

test("matchGodClass — fires on class with L1 classStereotype 'large-class'", () => {
  const ctx = buildContext({
    elements: [{ id: "BigClass", name: "BigClass", kind: "class" }],
    classStereotypes: new Map([["BigClass", "large-class"]]),
  });
  const out = matchGodClass(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternName, "god-class");
  assert.equal(out[0].patternFamily, "anti-pattern");
  assert.equal(out[0].confidenceScore, 0.85);
});

test("matchGodClass — fires on naming hint (Manager) at lower confidence", () => {
  const ctx = buildContext({
    elements: [{ id: "M", name: "UserManager", kind: "class" }],
  });
  const out = matchGodClass(ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].confidenceScore, 0.5);
});

test("matchGodClass — doesn't fire on plain non-large class", () => {
  const ctx = buildContext({
    elements: [{ id: "F", name: "Foo", kind: "class" }],
  });
  assert.equal(matchGodClass(ctx).length, 0);
});

// --- Fathom row 5.0.1.6: per-class helpers use an O(1) element index ------
//
// Pre-fix, methodNamesOfClass / fieldChildrenOfClass / elementLabel did
// a linear `ctx.elements.find((e) => e.id === id)` per child, inside
// per-class loops — O(classes × members × elements). On EnvisionWeb
// (85K elements, ~5000 classes) that made L6 the dominant L2-L7 phase
// at 45.6s. Post-fix the helpers resolve children through a
// once-built `elementById` Map (the `indexOf(ctx)` cache).
//
// Rule 4 pin: spy on the elements array's `.find`. The matcher hot
// path must NOT call it (the index is built via a for-of iteration, not
// .find). Pre-fix this count was O(members per matched class).

test("matchSingleton + matchFactoryMethod — per-class lookups use the index, not Array.find (Fathom 5.0.1.6)", () => {
  const elements: PatternElement[] = [
    { id: "Logger", name: "Logger", kind: "class" },
    { id: "Logger.getInstance", name: "getInstance", kind: "method" },
    { id: "Logger.instance", name: "instance", kind: "field" },
    { id: "UserFactory", name: "UserFactory", kind: "class" },
    { id: "UserFactory.create", name: "createUser", kind: "method" },
  ];
  // Decoy elements so a linear scan would be measurably wasteful.
  for (let i = 0; i < 200; i++) {
    elements.push({ id: `decoy${i}`, name: `decoy${i}`, kind: "function" });
  }

  let findCalls = 0;
  const origFind = elements.find.bind(elements);
  // Count any `.find` invocation on the elements array.
  (elements as unknown as { find: typeof elements.find }).find = function (...args: Parameters<typeof origFind>) {
    findCalls++;
    return origFind(...args);
  };

  const ctx = buildContext({
    elements,
    childrenOf: new Map([
      ["Logger", ["Logger.getInstance", "Logger.instance"]],
      ["UserFactory", ["UserFactory.create"]],
    ]),
  });

  // Run two matchers that iterate classes() and call the per-class
  // helpers. Correctness is covered by the dedicated matcher tests
  // above; here we only assert the lookup discipline.
  matchSingleton(ctx);
  matchFactoryMethod(ctx);

  assert.equal(
    findCalls,
    0,
    `matcher hot path must resolve children via the elementById index, not Array.find; got ${findCalls} find calls`,
  );
});
