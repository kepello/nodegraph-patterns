/**
 * Pattern-overlay tests. Pins:
 *
 *   - registerOverlay idempotent.
 *   - insertPattern persists metadata + role edges (subtype = role name).
 *   - insertPattern idempotent on identical content-hash.
 *   - tombstonePattern removes from listPatterns.
 *   - patternsByName / patternsForElement read paths.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { GraphLayerImpl, type GraphLayer } from "@kepello/nodegraph-core";
import { InMemoryBackend } from "@kepello/nodegraph-core/in-memory";
import { PATTERN_DOMAIN, PATTERN_METADATA_KIND } from "./schema.js";
import { ROLE_EDGE_TYPE } from "./types.js";
import { PatternOverlayImpl, makePatternOverlay } from "./overlay.js";

function makeGraph(): GraphLayer {
  return new GraphLayerImpl(new InMemoryBackend());
}

test("registerOverlay — idempotent on repeated construction", () => {
  const graph = makeGraph();
  const overlay = makePatternOverlay(graph);
  assert.doesNotThrow(() => new PatternOverlayImpl(graph));
  assert.ok(overlay);
});

test("insertPattern — persists metadata + role edges with subtype", () => {
  const graph = makeGraph();
  const overlay = makePatternOverlay(graph);
  const node = overlay.insertPattern({
    patternId: "p1",
    patternName: "Singleton",
    patternFamily: "gof",
    confidenceScore: 0.9,
    contentHash: "ch1",
    roles: [
      { role: "singleton", elementId: "Logger", displayLabel: "Logger" },
      { role: "accessor", elementId: "Logger.getInstance", displayLabel: "getInstance" },
    ],
  });
  assert.equal(node.metadata.kind, PATTERN_METADATA_KIND);
  assert.equal(node.metadata.patternName, "Singleton");
  assert.equal(node.metadata.confidenceScore, 0.9);
  // 2 role edges with subtype-as-role-name.
  const edges = overlay.rolesOf("p1");
  assert.equal(edges.length, 2);
  const subtypes = edges.map((e) => e.subtype).sort();
  assert.deepEqual(subtypes, ["accessor", "singleton"]);
});

test("insertPattern — idempotent on identical content-hash", () => {
  const graph = makeGraph();
  const overlay = makePatternOverlay(graph);
  const a = overlay.insertPattern({
    patternId: "p",
    patternName: "Adapter",
    patternFamily: "gof",
    confidenceScore: 0.7,
    contentHash: "h",
    roles: [{ role: "adapter", elementId: "x", displayLabel: "x" }],
  });
  const b = overlay.insertPattern({
    patternId: "p",
    patternName: "Adapter",
    patternFamily: "gof",
    confidenceScore: 0.7,
    contentHash: "h",
    roles: [{ role: "adapter", elementId: "x", displayLabel: "x" }],
  });
  assert.equal(a.id, b.id);
  assert.equal(overlay.rolesOf("p").length, 1);
});

test("tombstonePattern — removes from listPatterns", () => {
  const graph = makeGraph();
  const overlay = makePatternOverlay(graph);
  overlay.insertPattern({
    patternId: "doomed",
    patternName: "god-class",
    patternFamily: "anti-pattern",
    confidenceScore: 0.85,
    contentHash: "h",
    roles: [{ role: "godClass", elementId: "Big", displayLabel: "Big" }],
  });
  assert.equal(overlay.listPatterns().length, 1);
  overlay.tombstonePattern("doomed");
  assert.equal(overlay.listPatterns().length, 0);
});

test("patternsByName — filters by pattern name", () => {
  const graph = makeGraph();
  const overlay = makePatternOverlay(graph);
  overlay.insertPattern({
    patternId: "a",
    patternName: "Singleton",
    patternFamily: "gof",
    confidenceScore: 0.8,
    contentHash: "h1",
    roles: [{ role: "singleton", elementId: "A", displayLabel: "A" }],
  });
  overlay.insertPattern({
    patternId: "b",
    patternName: "Singleton",
    patternFamily: "gof",
    confidenceScore: 0.7,
    contentHash: "h2",
    roles: [{ role: "singleton", elementId: "B", displayLabel: "B" }],
  });
  overlay.insertPattern({
    patternId: "c",
    patternName: "Adapter",
    patternFamily: "gof",
    confidenceScore: 0.6,
    contentHash: "h3",
    roles: [{ role: "adapter", elementId: "C", displayLabel: "C" }],
  });
  assert.equal(overlay.patternsByName("Singleton").length, 2);
  assert.equal(overlay.patternsByName("Adapter").length, 1);
  assert.equal(overlay.patternsByName("Observer").length, 0);
});

test("patternsForElement — finds patterns whose roles reference the element", () => {
  const graph = makeGraph();
  const overlay = makePatternOverlay(graph);
  overlay.insertPattern({
    patternId: "p1",
    patternName: "Observer",
    patternFamily: "gof",
    confidenceScore: 0.7,
    contentHash: "h1",
    roles: [
      { role: "subject", elementId: "Publisher", displayLabel: "Publisher" },
      { role: "observerCollection", elementId: "Publisher.listeners", displayLabel: "listeners" },
    ],
  });
  const patterns = overlay.patternsForElement("Publisher");
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].metadata.patternName, "Observer");
});

test("PATTERN_DOMAIN — domain identifier", () => {
  assert.equal(PATTERN_DOMAIN, "pattern-instance");
});

test("rolesOf — empty list for unknown pattern", () => {
  const graph = makeGraph();
  const overlay = makePatternOverlay(graph);
  assert.deepEqual(overlay.rolesOf("missing"), []);
});
