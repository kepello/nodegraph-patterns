/**
 * Pattern-instance overlay domain + IndexSpecs + JSON Schema.
 * Mirrors the existing Phase-3 overlay shapes.
 */

import type { IndexSpec, MetadataSchema } from "@kepello/nodegraph-core";

export const PATTERN_DOMAIN = "pattern-instance";

export const PATTERN_METADATA_KIND = "pattern-instance";

export const PATTERN_METADATA_SCHEMA: MetadataSchema = {
  type: "object",
  title: "Detected pattern instance",
  description:
    "One occurrence of a known design / architectural / anti-pattern in the codebase, with role bindings + a heuristic confidence score in [0, 1].",
  required: ["kind", "patternId", "patternName", "patternFamily", "confidenceScore"],
  properties: {
    kind: {
      type: "string",
      enum: ["pattern-instance"],
      title: "Discriminator",
    },
    patternId: {
      type: "string",
      title: "Stable pattern-instance id",
      description:
        "Content-hash identity: `hash(patternName || sorted role.elementId joined by \\n)`. Same set of role-fillers always produces the same id.",
    },
    patternName: {
      type: "string",
      title: "Pattern name",
      description:
        "Human-readable name (e.g. 'Observer', 'Singleton', 'Layered Architecture', 'god-class').",
    },
    patternFamily: {
      type: "string",
      enum: ["gof", "architectural", "anti-pattern"],
      title: "Pattern family",
    },
    language: {
      type: "string",
      title: "Language",
      description:
        "Source language. Set when all role-fillers share the same language; absent for cross-language matches (not produced in v1).",
    },
    confidenceScore: {
      type: "number",
      title: "Heuristic confidence",
      description:
        "Internal rank ∈ [0, 1]. Not calibrated against external benchmarks; intended for relative ordering + filtering via `patterns.minConfidence`.",
    },
    roles: {
      type: "array",
      title: "Role bindings",
      description:
        "List of `{role, elementId}` entries naming which L0 / L3 element fills each pattern role (e.g. Observer's `subject`, `observer`).",
    },
  },
};

export const PATTERN_INDEXES: IndexSpec[] = [
  {
    name: "patterns_by_pattern_id",
    fields: ["metadata.patternId"],
    scope: {
      domain: PATTERN_DOMAIN,
      lifecycleState: "live",
      nonNull: ["metadata.patternId"],
    },
    unique: true,
  },
  {
    name: "patterns_by_pattern_name",
    fields: ["metadata.patternName"],
    scope: {
      domain: PATTERN_DOMAIN,
      lifecycleState: "live",
      nonNull: ["metadata.patternName"],
    },
  },
  {
    name: "patterns_by_language",
    fields: ["metadata.language"],
    scope: {
      domain: PATTERN_DOMAIN,
      lifecycleState: "live",
      nonNull: ["metadata.language"],
    },
  },
];
