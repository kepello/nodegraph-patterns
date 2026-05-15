/**
 * Detection-context input shape. The matchers operate over plain data
 * shapes the consumer assembles from L0 (analyzer output) + L1
 * (stereotype derivations) + L3 (cluster overlay) + L4 (layering).
 * This keeps the package decoupled from the substrate (no peer-deps
 * on `nodegraph-analysis` / `nodegraph-clusters` / `nodegraph-layering`).
 */

/** One L0 element participating in detection. */
export interface PatternElement {
  id: string;
  name: string;
  /** Structural kind from the wire: `"class"`, `"interface"`, `"method"`, `"field"`, `"function"`, etc. */
  kind: string;
  language?: string;
}

/** One directed edge between elements. */
export interface PatternEdge {
  source: string;
  target: string;
}

/** Minimal cluster info from L3. */
export interface ClusterInfo {
  clusterId: string;
  name: string;
  displayName?: string;
  memberCount: number;
}

export interface PatternContext {
  elements: readonly PatternElement[];
  /** Child element id → parent element ids (extends, implements, inherits). */
  inheritsEdges: ReadonlyMap<string, readonly string[]>;
  /** Cross-class call edges (`calls` in the wire protocol). */
  callsEdges: readonly PatternEdge[];
  /** Intra-class call edges (`callsMethod` in the wire protocol). */
  callsMethodEdges: readonly PatternEdge[];
  /** Field-access edges (`accessesField`). Bidirectional in v1 protocol. */
  accessesFieldEdges: readonly PatternEdge[];
  /** Identifier-mention edges (`references`). */
  referencesEdges: readonly PatternEdge[];
  /** L1 method stereotypes (`accessor-shaped`, `controller`, etc.). */
  methodStereotypes: ReadonlyMap<string, string>;
  /** L1 class stereotypes (`entity`, `large-class`, etc.). */
  classStereotypes: ReadonlyMap<string, string>;
  /**
   * Container's children: class id → method/field/etc. ids. Built from
   * `contains` edges in the analyzer graph.
   */
  childrenOf: ReadonlyMap<string, readonly string[]>;
  /** Inverse of `childrenOf`: child id → container id. */
  parentOf: ReadonlyMap<string, string>;
  /** L3 clusters (workspace-wide). */
  clusters: readonly ClusterInfo[];
  /** Element id → cluster id. */
  clusterByElement: ReadonlyMap<string, string>;
  /** L4 layer number per cluster (optional). */
  layerByCluster: ReadonlyMap<string, number>;
}
