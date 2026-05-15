/**
 * Composite pattern-detection runner. Invokes every catalog matcher
 * against the supplied context, applies a confidence threshold (default
 * 0.6), and returns ordered `PatternInstance[]`.
 *
 * Each returned instance also carries the content-hash `patternId`
 * computed from the role-fillers; consumers can pass the result
 * directly to `PatternOverlay.insertPattern` (after adding a
 * `contentHash`, typically equal to the sorted-role-id join).
 */

import type { PatternContext } from "./context.js";
import { computePatternId } from "./identity.js";
import { ALL_MATCHERS } from "./matchers.js";
import type { PatternInstance } from "./types.js";

export interface DetectPatternsOptions {
  /**
   * Minimum confidence ∈ [0, 1] for an instance to be returned. Defaults
   * to 0.6. Lower values surface noisier matches; higher values are
   * stricter. Operator-tunable via `.fathom/fathom.config.json`
   * `patterns.minConfidence`.
   */
  minConfidence?: number;
  /**
   * Limit detection to a specific pattern name list. Useful for
   * incremental adoption (e.g., "just run god-class and Singleton").
   */
  patternNames?: readonly string[];
}

export interface DetectPatternsResult {
  /** Ordered by descending confidence, then by patternName, then by patternId. */
  instances: ReadonlyArray<PatternInstance & { patternId: string }>;
  /** Per-matcher counts before threshold filtering — useful for debugging. */
  rawCountsByPattern: ReadonlyMap<string, number>;
}

export function detectPatterns(
  context: PatternContext,
  options: DetectPatternsOptions = {},
): DetectPatternsResult {
  const minConfidence = options.minConfidence ?? 0.6;
  const allowedNames =
    options.patternNames === undefined ? undefined : new Set(options.patternNames);

  const rawCountsByPattern = new Map<string, number>();
  const filtered: Array<PatternInstance & { patternId: string }> = [];

  for (const { name, fn } of ALL_MATCHERS) {
    if (allowedNames !== undefined && !allowedNames.has(name)) continue;
    const matches = fn(context);
    rawCountsByPattern.set(name, matches.length);
    for (const m of matches) {
      if (m.confidenceScore < minConfidence) continue;
      const patternId = computePatternId(
        m.patternName,
        m.roles.map((r) => r.elementId),
      );
      filtered.push({ ...m, patternId });
    }
  }

  filtered.sort((a, b) => {
    if (b.confidenceScore !== a.confidenceScore) {
      return b.confidenceScore - a.confidenceScore;
    }
    const byName = a.patternName.localeCompare(b.patternName);
    if (byName !== 0) return byName;
    return a.patternId.localeCompare(b.patternId);
  });

  return { instances: filtered, rawCountsByPattern };
}
