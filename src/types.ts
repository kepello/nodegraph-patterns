/**
 * Pattern-instance overlay public types.
 */

import type { Edge, Node } from "@kepello/nodegraph-core";
import { PATTERN_METADATA_KIND } from "./schema.js";

export type PatternFamily = "gof" | "architectural" | "anti-pattern";

/**
 * One filled role in a pattern instance. `role` is pattern-specific
 * (`"subject"`, `"observer"`, `"product"`, `"adapter"`, etc.) — used
 * as the edge subtype on outgoing `role` edges so consumers can
 * recover the role binding from edge metadata alone.
 */
export interface PatternInstanceRole {
  role: string;
  elementId: string;
}

/**
 * A detected pattern occurrence. Produced by the `detectPatterns` API
 * and consumed by `PatternOverlay.insertPattern`.
 */
export interface PatternInstance {
  patternName: string;
  patternFamily: PatternFamily;
  language?: string;
  confidenceScore: number;
  roles: readonly PatternInstanceRole[];
}

export interface PatternMetadata {
  kind: typeof PATTERN_METADATA_KIND;
  patternId: string;
  patternName: string;
  patternFamily: PatternFamily;
  language?: string;
  confidenceScore: number;
  roles: readonly PatternInstanceRole[];
}

export interface PatternInput extends PatternInstance {
  patternId: string;
  contentHash: string;
}

export interface PatternNode extends Omit<Node, "metadata"> {
  metadata: PatternMetadata;
}

export interface PatternOverlay {
  insertPattern(input: PatternInput): PatternNode;
  tombstonePattern(patternId: string): void;
  listPatterns(): PatternNode[];
  getPattern(patternId: string): PatternNode | undefined;
  /** All patterns with the given name. */
  patternsByName(patternName: string): PatternNode[];
  /** All patterns whose role bindings reference the given element. */
  patternsForElement(elementId: string): PatternNode[];
  /** Outgoing role edges — one per filled role (subtype carries role name). */
  rolesOf(patternId: string): Edge[];
}

export const ROLE_EDGE_TYPE = "role";
