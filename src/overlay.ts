/**
 * Pattern-instance overlay implementation. Writes one node per detected
 * pattern, with outgoing `role` edges (subtype = role name) to every
 * filled role's element.
 */

import type { Edge, GraphLayer, Node } from "@kepello/nodegraph-core";
import {
  PATTERN_DOMAIN,
  PATTERN_INDEXES,
  PATTERN_METADATA_KIND,
  PATTERN_METADATA_SCHEMA,
} from "./schema.js";
import {
  ROLE_EDGE_TYPE,
  type PatternInput,
  type PatternMetadata,
  type PatternNode,
  type PatternOverlay,
} from "./types.js";

export class PatternOverlayImpl implements PatternOverlay {
  constructor(private readonly graph: GraphLayer) {
    try {
      this.graph.registerOverlay({
        domain: PATTERN_DOMAIN,
        metadataSchema: PATTERN_METADATA_SCHEMA,
        indexes: PATTERN_INDEXES,
      });
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes("already registered for domain")
      ) {
        throw err;
      }
    }
  }

  insertPattern(input: PatternInput): PatternNode {
    return this.graph.transaction(
      {
        kind: "insert-pattern",
        producerDomain: PATTERN_DOMAIN,
        summary: `insert pattern ${input.patternId} (${input.patternName})`,
      },
      () => this.doInsertPattern(input),
    ).result;
  }

  private doInsertPattern(input: PatternInput): PatternNode {
    const metadata = buildMetadata(input);
    const existing = this.graph.getLiveNodeByNaturalKey(
      PATTERN_DOMAIN,
      input.patternId,
    );
    let node: Node;
    if (existing === undefined) {
      node = this.graph.insertNode({
        domain: PATTERN_DOMAIN,
        naturalKey: input.patternId,
        contentHash: input.contentHash,
        metadata: metadata as unknown,
      });
    } else if (existing.contentHash === input.contentHash) {
      node = existing;
    } else {
      node = this.graph.supersedeNode(existing.id, {
        contentHash: input.contentHash,
        metadata: metadata as unknown,
      });
    }

    // Write role edges (one per filled role). Edge `subtype` carries
    // the role name so consumers can recover the binding from the edge
    // metadata alone (cheap reads). Deduplicate against existing.
    const existingRole = this.graph.edgesFrom(node.id, {
      type: ROLE_EDGE_TYPE,
      includeDangling: true,
    });
    const existingPairs = new Set<string>();
    for (const e of existingRole) {
      const tgt = e.targetId ?? e.targetRef ?? "";
      existingPairs.add(`${e.subtype ?? ""}::${tgt}`);
    }
    for (const role of input.roles) {
      const key = `${role.role}::${role.elementId}`;
      if (existingPairs.has(key)) continue;
      const byId = this.graph.getNodeById(role.elementId);
      if (byId !== undefined) {
        this.graph.insertEdge({
          sourceId: node.id,
          targetId: role.elementId,
          type: ROLE_EDGE_TYPE,
          subtype: role.role,
        });
      } else {
        this.graph.insertEdge({
          sourceId: node.id,
          targetRef: role.elementId,
          type: ROLE_EDGE_TYPE,
          subtype: role.role,
        });
      }
    }

    return asPattern(node);
  }

  tombstonePattern(patternId: string): void {
    this.graph.transaction(
      {
        kind: "tombstone-pattern",
        producerDomain: PATTERN_DOMAIN,
        summary: `tombstone pattern ${patternId}`,
      },
      () => {
        const existing = this.graph.getLiveNodeByNaturalKey(
          PATTERN_DOMAIN,
          patternId,
        );
        if (existing === undefined) return;
        this.graph.tombstoneNode(existing.id);
      },
    );
  }

  listPatterns(): PatternNode[] {
    return this.graph
      .queryNodes({ domain: PATTERN_DOMAIN, lifecycleState: "live" })
      .map(asPattern);
  }

  getPattern(patternId: string): PatternNode | undefined {
    const node = this.graph.getLiveNodeByNaturalKey(PATTERN_DOMAIN, patternId);
    return node === undefined ? undefined : asPattern(node);
  }

  patternsByName(patternName: string): PatternNode[] {
    return this.listPatterns().filter(
      (n) => n.metadata.patternName === patternName,
    );
  }

  patternsForElement(elementId: string): PatternNode[] {
    const seen = new Set<string>();
    const out: PatternNode[] = [];
    const collect = (edges: readonly Edge[]) => {
      for (const edge of edges) {
        if (seen.has(edge.sourceId)) continue;
        seen.add(edge.sourceId);
        const node = this.graph.getNodeById(edge.sourceId);
        if (
          node !== undefined &&
          node.lifecycleState === "live" &&
          node.domain === PATTERN_DOMAIN
        ) {
          out.push(asPattern(node));
        }
      }
    };
    collect(this.graph.edgesTo(elementId, { type: ROLE_EDGE_TYPE }));
    collect(this.graph.queryEdges({ targetRef: elementId, type: ROLE_EDGE_TYPE }));
    return out;
  }

  rolesOf(patternId: string): Edge[] {
    const node = this.graph.getLiveNodeByNaturalKey(PATTERN_DOMAIN, patternId);
    if (node === undefined) return [];
    return this.graph.edgesFrom(node.id, {
      type: ROLE_EDGE_TYPE,
      includeDangling: true,
    });
  }
}

function buildMetadata(input: PatternInput): PatternMetadata {
  const meta: PatternMetadata = {
    kind: PATTERN_METADATA_KIND,
    patternId: input.patternId,
    patternName: input.patternName,
    patternFamily: input.patternFamily,
    confidenceScore: input.confidenceScore,
    roles: [...input.roles],
  };
  if (input.language !== undefined) meta.language = input.language;
  return meta;
}

function asPattern(node: Node): PatternNode {
  return node as PatternNode;
}

export function makePatternOverlay(graph: GraphLayer): PatternOverlay {
  return new PatternOverlayImpl(graph);
}
