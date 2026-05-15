/**
 * Hardcoded matcher functions, one per v1 catalog entry. Each takes
 * a `PatternContext` and returns zero or more `PatternInstance`s with
 * heuristic confidence scores ∈ [0, 1].
 *
 * Matchers are intentionally shallow — they consume L0 structure +
 * L1 stereotype labels + L3 cluster info + L4 layer numbers + naming
 * heuristics, and do not parse method bodies. Some classical patterns
 * (Decorator delegation, Observer notify-loops) score modestly without
 * body-level analysis; v1 accepts this and exposes the score so
 * operators can filter via `patterns.minConfidence`.
 */

import type { PatternContext, PatternElement } from "./context.js";
import type { PatternFamily, PatternInstance, PatternInstanceRole } from "./types.js";

export type Matcher = (ctx: PatternContext) => PatternInstance[];

const CLASS_KINDS: ReadonlySet<string> = new Set(["class", "struct"]);
const INTERFACE_KINDS: ReadonlySet<string> = new Set(["interface"]);
const METHOD_KINDS: ReadonlySet<string> = new Set([
  "method", "function", "constructor", "accessor", "operator",
]);
const FIELD_KINDS: ReadonlySet<string> = new Set(["field", "property"]);

// --- helpers --------------------------------------------------------------

function elementsByKind(
  ctx: PatternContext,
  predicate: (e: PatternElement) => boolean,
): PatternElement[] {
  return ctx.elements.filter(predicate);
}

function classes(ctx: PatternContext): PatternElement[] {
  return elementsByKind(ctx, (e) => CLASS_KINDS.has(e.kind));
}

function methodNamesOfClass(ctx: PatternContext, classId: string): { id: string; name: string }[] {
  const children = ctx.childrenOf.get(classId) ?? [];
  const out: { id: string; name: string }[] = [];
  for (const childId of children) {
    const child = ctx.elements.find((e) => e.id === childId);
    if (child === undefined) continue;
    if (METHOD_KINDS.has(child.kind)) out.push({ id: child.id, name: child.name });
  }
  return out;
}

function fieldChildrenOfClass(
  ctx: PatternContext,
  classId: string,
): PatternElement[] {
  const children = ctx.childrenOf.get(classId) ?? [];
  return children
    .map((id) => ctx.elements.find((e) => e.id === id))
    .filter((e): e is PatternElement => e !== undefined && FIELD_KINDS.has(e.kind));
}

function buildInstance(
  patternName: string,
  patternFamily: PatternFamily,
  confidence: number,
  roles: PatternInstanceRole[],
  language?: string,
): PatternInstance {
  return {
    patternName,
    patternFamily,
    confidenceScore: Math.max(0, Math.min(1, confidence)),
    roles,
    ...(language !== undefined ? { language } : {}),
  };
}

const SINGLETON_METHOD_PATTERNS = [/^getInstance$/i, /^instance$/i, /^sharedInstance$/i, /^default$/i];
const FACTORY_METHOD_PATTERNS = [/^create/i, /^make/i, /^build/i, /^from/i, /^new[A-Z]/];
const COMMAND_METHOD_PATTERNS = [/^execute$/i, /^run$/i, /^perform$/i, /^invoke$/i, /^apply$/i, /^do$/i];
const OBSERVER_COLLECTION_NAMES = [/listener/i, /observer/i, /subscriber/i, /handler/i, /watcher/i];
const OBSERVER_NOTIFY_PATTERNS = [/^notify/i, /^publish/i, /^emit/i, /^fire/i, /^dispatch/i, /^broadcast/i];
const ADAPTER_NAME_HINT = /adapter$/i;
const DECORATOR_NAME_HINT = /decorator$/i;
const PORT_NAME_HINT = /^I?[A-Z]?(.+)?(port|gateway)$/i;
const HEX_ADAPTER_NAME_HINT = /(adapter|gateway|client|repository)$/i;
const HEX_DOMAIN_HINT = /(domain|core|model)/i;

// --- matchers -------------------------------------------------------------

/**
 * Singleton — class with a `getInstance`-shaped method (or `instance`
 * accessor) plus at least one field of its own type or a private/static
 * field. Confidence weights: method-name match (0.4), class name
 * containing "Singleton" (0.2), having a field (0.2), having only one
 * method-shaped constructor (0.1), having stereotype hint (0.1).
 */
export function matchSingleton(ctx: PatternContext): PatternInstance[] {
  const out: PatternInstance[] = [];
  for (const cls of classes(ctx)) {
    const methods = methodNamesOfClass(ctx, cls.id);
    const singletonMethods = methods.filter((m) =>
      SINGLETON_METHOD_PATTERNS.some((re) => re.test(m.name)),
    );
    if (singletonMethods.length === 0) continue;
    const fields = fieldChildrenOfClass(ctx, cls.id);
    const classStereo = ctx.classStereotypes.get(cls.id);
    let score = 0.4; // method-name match
    if (/singleton$/i.test(cls.name)) score += 0.2;
    if (fields.length > 0) score += 0.2;
    if (classStereo === "minor-class" || classStereo === "lazy-class") score += 0.1;
    if (methods.length <= 3) score += 0.1;
    const roles: PatternInstanceRole[] = [
      { role: "singleton", elementId: cls.id },
      ...singletonMethods.map((m) => ({ role: "accessor", elementId: m.id })),
    ];
    out.push(buildInstance("Singleton", "gof", score, roles, cls.language));
  }
  return out;
}

/**
 * Factory Method — a method with L1 method-stereotype `factory`, OR a
 * method on a class whose name matches the factory naming convention
 * (`create*`/`make*`/`build*`/`new*`/`from*`).
 */
export function matchFactoryMethod(ctx: PatternContext): PatternInstance[] {
  const out: PatternInstance[] = [];
  for (const cls of classes(ctx)) {
    const methods = methodNamesOfClass(ctx, cls.id);
    for (const m of methods) {
      const stereo = ctx.methodStereotypes.get(m.id);
      const isFactoryStereotype = stereo === "factory";
      const nameMatch = FACTORY_METHOD_PATTERNS.some((re) => re.test(m.name));
      if (!isFactoryStereotype && !nameMatch) continue;
      let score = 0;
      if (isFactoryStereotype) score += 0.5;
      if (nameMatch) score += 0.3;
      // Class-level signal: if the class itself names a factory.
      if (/factory$/i.test(cls.name)) score += 0.2;
      const roles: PatternInstanceRole[] = [
        { role: "creator", elementId: cls.id },
        { role: "factoryMethod", elementId: m.id },
      ];
      out.push(buildInstance("Factory Method", "gof", score, roles, cls.language));
    }
  }
  return out;
}

/**
 * Adapter — class with `Adapter` in its name AND inherits one element
 * AND references at least one other element (the adaptee). Confidence
 * leans heavily on naming; weak without dispatch info.
 */
export function matchAdapter(ctx: PatternContext): PatternInstance[] {
  const out: PatternInstance[] = [];
  for (const cls of classes(ctx)) {
    if (!ADAPTER_NAME_HINT.test(cls.name)) continue;
    const inherits = ctx.inheritsEdges.get(cls.id) ?? [];
    const inheritedTargets = new Set(inherits);
    // Look at field accesses + references for adaptee candidates.
    const referenced = new Set<string>();
    for (const e of ctx.referencesEdges) {
      if (e.source === cls.id && !inheritedTargets.has(e.target)) {
        referenced.add(e.target);
      }
    }
    // Adapter needs at least one inherited target (the target interface)
    // and one adaptee referenced separately.
    if (inherits.length === 0 || referenced.size === 0) continue;
    let score = 0.4; // name match
    if (inherits.length >= 1) score += 0.2;
    if (referenced.size >= 1) score += 0.2;
    if (inherits.length === 1 && referenced.size === 1) score += 0.2; // clean adapter shape
    const roles: PatternInstanceRole[] = [
      { role: "adapter", elementId: cls.id },
      ...inherits.map((id) => ({ role: "target", elementId: id })),
      ...[...referenced].slice(0, 3).map((id) => ({ role: "adaptee", elementId: id })),
    ];
    out.push(buildInstance("Adapter", "gof", score, roles, cls.language));
  }
  return out;
}

/**
 * Decorator — class with `Decorator` in its name + inheritance to an
 * interface + a field of the same interface type (delegation). v1
 * can't directly check field type, so this approximates: name match +
 * inheritance + at least one field-access edge that targets the same
 * inherited interface.
 */
export function matchDecorator(ctx: PatternContext): PatternInstance[] {
  const out: PatternInstance[] = [];
  for (const cls of classes(ctx)) {
    if (!DECORATOR_NAME_HINT.test(cls.name)) continue;
    const inherits = ctx.inheritsEdges.get(cls.id) ?? [];
    if (inherits.length === 0) continue;
    const inheritedSet = new Set(inherits);
    // Does the class reference (or use as field type) any of its inherited targets?
    let referencesInheritedTarget = false;
    for (const e of ctx.referencesEdges) {
      if (e.source === cls.id && inheritedSet.has(e.target)) {
        referencesInheritedTarget = true;
        break;
      }
    }
    let score = 0.4;
    if (inherits.length >= 1) score += 0.2;
    if (referencesInheritedTarget) score += 0.3;
    if (inherits.length === 1) score += 0.1;
    const roles: PatternInstanceRole[] = [
      { role: "decorator", elementId: cls.id },
      ...inherits.map((id) => ({ role: "component", elementId: id })),
    ];
    out.push(buildInstance("Decorator", "gof", score, roles, cls.language));
  }
  return out;
}

/**
 * Observer — class with a field whose name matches collection-of-
 * listeners naming AND at least one method named like a notify
 * operation. Confidence built on naming alone (no body inspection).
 */
export function matchObserver(ctx: PatternContext): PatternInstance[] {
  const out: PatternInstance[] = [];
  for (const cls of classes(ctx)) {
    const fields = fieldChildrenOfClass(ctx, cls.id);
    const collectionFields = fields.filter((f) =>
      OBSERVER_COLLECTION_NAMES.some((re) => re.test(f.name)),
    );
    if (collectionFields.length === 0) continue;
    const methods = methodNamesOfClass(ctx, cls.id);
    const notifyMethods = methods.filter((m) =>
      OBSERVER_NOTIFY_PATTERNS.some((re) => re.test(m.name)),
    );
    if (notifyMethods.length === 0) continue;
    let score = 0.4;
    if (collectionFields.length >= 1) score += 0.2;
    if (notifyMethods.length >= 1) score += 0.2;
    if (collectionFields.length >= 1 && notifyMethods.length >= 1) score += 0.1;
    const roles: PatternInstanceRole[] = [
      { role: "subject", elementId: cls.id },
      ...collectionFields.map((f) => ({ role: "observerCollection", elementId: f.id })),
      ...notifyMethods.map((m) => ({ role: "notifyMethod", elementId: m.id })),
    ];
    out.push(buildInstance("Observer", "gof", score, roles, cls.language));
  }
  return out;
}

/**
 * Command — class with an `execute`-shaped method OR L1 classStereotype
 * `command`. Confidence highest when both match.
 */
export function matchCommand(ctx: PatternContext): PatternInstance[] {
  const out: PatternInstance[] = [];
  for (const cls of classes(ctx)) {
    const methods = methodNamesOfClass(ctx, cls.id);
    const executeMethods = methods.filter((m) =>
      COMMAND_METHOD_PATTERNS.some((re) => re.test(m.name)),
    );
    const classStereo = ctx.classStereotypes.get(cls.id);
    const stereotypeMatch = classStereo === "command";
    if (executeMethods.length === 0 && !stereotypeMatch) continue;
    let score = 0;
    if (executeMethods.length > 0) score += 0.4;
    if (stereotypeMatch) score += 0.4;
    if (/command$/i.test(cls.name)) score += 0.2;
    const roles: PatternInstanceRole[] = [
      { role: "command", elementId: cls.id },
      ...executeMethods.map((m) => ({ role: "executeMethod", elementId: m.id })),
    ];
    out.push(buildInstance("Command", "gof", score, roles, cls.language));
  }
  return out;
}

/**
 * Layered Architecture — workspace-level pattern. Emits ONE instance
 * when ≥3 distinct layer numbers exist and the back-edge ratio
 * (clusters depending UP the stack vs. total cluster deps) is low.
 * Confidence: 1 minus the back-edge ratio, clamped to [0, 1], scaled
 * by layer-count.
 *
 * "Back-edges" detected here are the ones L4 would have surfaced as
 * violations; we don't need L4's full result, just a per-cluster
 * layer number + cluster dependency edges (which we infer from
 * elements + their cluster assignments + calls edges).
 */
export function matchLayered(ctx: PatternContext): PatternInstance[] {
  if (ctx.layerByCluster.size === 0) return [];
  const distinctLayers = new Set(ctx.layerByCluster.values());
  if (distinctLayers.size < 3) return [];
  let totalClusterDeps = 0;
  let backEdges = 0;
  // Build cluster-to-cluster dep counts from L0 call edges + clusterByElement.
  for (const edge of ctx.callsEdges) {
    const srcCluster = ctx.clusterByElement.get(edge.source);
    const tgtCluster = ctx.clusterByElement.get(edge.target);
    if (srcCluster === undefined || tgtCluster === undefined) continue;
    if (srcCluster === tgtCluster) continue;
    totalClusterDeps += 1;
    const srcLayer = ctx.layerByCluster.get(srcCluster);
    const tgtLayer = ctx.layerByCluster.get(tgtCluster);
    if (srcLayer === undefined || tgtLayer === undefined) continue;
    if (tgtLayer > srcLayer) backEdges += 1;
  }
  if (totalClusterDeps === 0) return [];
  const backRatio = backEdges / totalClusterDeps;
  const layerDepthBonus = Math.min(0.2, (distinctLayers.size - 3) * 0.05);
  const confidence = (1 - backRatio) * 0.7 + 0.1 + layerDepthBonus;
  const roles: PatternInstanceRole[] = ctx.clusters.map((c) => ({
    role: "layer",
    elementId: c.clusterId,
  }));
  return [buildInstance("Layered Architecture", "architectural", confidence, roles)];
}

/**
 * Hexagonal Architecture — workspace-level. Detects clusters with
 * `Port`-/`Gateway`-flavor names + clusters with `Adapter`-flavor
 * names + a `Domain`-/`Core`-/`Model`-flavor cluster. Returns one
 * instance per domain-core cluster surrounded by ports + adapters.
 */
export function matchHexagonal(ctx: PatternContext): PatternInstance[] {
  if (ctx.clusters.length === 0) return [];
  const portClusters = ctx.clusters.filter((c) => PORT_NAME_HINT.test(c.name));
  const adapterClusters = ctx.clusters.filter((c) =>
    HEX_ADAPTER_NAME_HINT.test(c.name),
  );
  const domainClusters = ctx.clusters.filter((c) => HEX_DOMAIN_HINT.test(c.name));
  if (domainClusters.length === 0) return [];
  if (portClusters.length === 0 && adapterClusters.length === 0) return [];
  const out: PatternInstance[] = [];
  for (const domain of domainClusters) {
    let score = 0.3;
    if (portClusters.length > 0) score += 0.3;
    if (adapterClusters.length > 0) score += 0.3;
    if (portClusters.length > 0 && adapterClusters.length > 0) score += 0.1;
    const roles: PatternInstanceRole[] = [
      { role: "domainCore", elementId: domain.clusterId },
      ...portClusters.map((c) => ({ role: "port", elementId: c.clusterId })),
      ...adapterClusters.map((c) => ({ role: "adapter", elementId: c.clusterId })),
    ];
    out.push(buildInstance("Hexagonal Architecture", "architectural", score, roles));
  }
  return out;
}

/**
 * god-class anti-pattern — class with L1 classStereotype `large-class`.
 * Confidence: fixed 0.85 when L1 fires (L1's `large-class` rule is
 * threshold-based and already filtered for high signal); 0.5 when only
 * a naming hint (e.g. `Manager`/`Helper`/`Utility`) matches.
 */
export function matchGodClass(ctx: PatternContext): PatternInstance[] {
  const out: PatternInstance[] = [];
  const NAME_HINT = /(manager|helper|utility|util|controller)$/i;
  for (const cls of classes(ctx)) {
    const stereo = ctx.classStereotypes.get(cls.id);
    const stereotypeMatch = stereo === "large-class";
    const nameMatch = NAME_HINT.test(cls.name);
    if (!stereotypeMatch && !nameMatch) continue;
    let score = 0;
    if (stereotypeMatch) score = 0.85;
    else if (nameMatch) score = 0.5;
    out.push(
      buildInstance(
        "god-class",
        "anti-pattern",
        score,
        [{ role: "godClass", elementId: cls.id }],
        cls.language,
      ),
    );
  }
  return out;
}

export const ALL_MATCHERS: ReadonlyArray<{ name: string; fn: Matcher }> = [
  { name: "Singleton", fn: matchSingleton },
  { name: "Factory Method", fn: matchFactoryMethod },
  { name: "Adapter", fn: matchAdapter },
  { name: "Decorator", fn: matchDecorator },
  { name: "Observer", fn: matchObserver },
  { name: "Command", fn: matchCommand },
  { name: "Layered Architecture", fn: matchLayered },
  { name: "Hexagonal Architecture", fn: matchHexagonal },
  { name: "god-class", fn: matchGodClass },
];
