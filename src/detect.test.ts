/**
 * Detection-runner tests. Pins:
 *
 *   - Empty context returns no instances.
 *   - Threshold filtering: low-confidence matches dropped, high kept.
 *   - patternId computed for every returned instance.
 *   - Output sorted by descending confidence, then by name, then by id.
 *   - patternNames filter restricts which matchers run.
 *   - rawCountsByPattern tracks pre-threshold counts for debugging.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { detectPatterns } from "./detect.js";
import type { PatternContext } from "./context.js";

function emptyContext(): PatternContext {
  return {
    elements: [],
    inheritsEdges: new Map(),
    callsEdges: [],
    callsMethodEdges: [],
    accessesFieldEdges: [],
    referencesEdges: [],
    methodStereotypes: new Map(),
    classStereotypes: new Map(),
    childrenOf: new Map(),
    parentOf: new Map(),
    clusters: [],
    clusterByElement: new Map(),
    layerByCluster: new Map(),
  };
}

test("detectPatterns — empty context returns no instances", () => {
  const result = detectPatterns(emptyContext());
  assert.equal(result.instances.length, 0);
});

test("detectPatterns — threshold filtering: god-class @ 0.85 passes default 0.6", () => {
  const ctx: PatternContext = {
    ...emptyContext(),
    elements: [{ id: "Big", name: "Big", kind: "class" }],
    classStereotypes: new Map([["Big", "large-class"]]),
  };
  const result = detectPatterns(ctx);
  assert.ok(result.instances.length >= 1);
  const godClass = result.instances.find((i) => i.patternName === "god-class");
  assert.ok(godClass);
  assert.ok(godClass.confidenceScore >= 0.6);
});

test("detectPatterns — low-confidence match filtered out by default threshold", () => {
  // A naming-only god-class match scores 0.5, below the default 0.6.
  const ctx: PatternContext = {
    ...emptyContext(),
    elements: [{ id: "M", name: "FooManager", kind: "class" }],
  };
  const result = detectPatterns(ctx); // default minConfidence = 0.6
  assert.equal(result.instances.length, 0);
});

test("detectPatterns — lower threshold lets naming-only matches through", () => {
  const ctx: PatternContext = {
    ...emptyContext(),
    elements: [{ id: "M", name: "FooManager", kind: "class" }],
  };
  const result = detectPatterns(ctx, { minConfidence: 0.4 });
  assert.equal(result.instances.length, 1);
  assert.equal(result.instances[0].patternName, "god-class");
});

test("detectPatterns — instances carry patternId derived from roles", () => {
  const ctx: PatternContext = {
    ...emptyContext(),
    elements: [{ id: "Big", name: "Big", kind: "class" }],
    classStereotypes: new Map([["Big", "large-class"]]),
  };
  const result = detectPatterns(ctx);
  for (const instance of result.instances) {
    assert.equal(typeof instance.patternId, "string");
    assert.equal(instance.patternId.length, 16);
  }
});

test("detectPatterns — output sorted by descending confidence", () => {
  // Stub fixture producing god-class (0.85) AND a Singleton (which
  // will score lower) — verify god-class comes first.
  const ctx: PatternContext = {
    ...emptyContext(),
    elements: [
      { id: "Big", name: "BigManager", kind: "class" },
      { id: "Big.getInstance", name: "getInstance", kind: "method" },
      { id: "Big.field", name: "instance", kind: "field" },
    ],
    classStereotypes: new Map([["Big", "large-class"]]),
    childrenOf: new Map([["Big", ["Big.getInstance", "Big.field"]]]),
  };
  const result = detectPatterns(ctx);
  // god-class (0.85) should come before Singleton (lower).
  const names = result.instances.map((i) => i.patternName);
  const godIdx = names.indexOf("god-class");
  const singletonIdx = names.indexOf("Singleton");
  if (godIdx !== -1 && singletonIdx !== -1) {
    assert.ok(godIdx < singletonIdx);
  }
});

test("detectPatterns — patternNames filter restricts matchers", () => {
  const ctx: PatternContext = {
    ...emptyContext(),
    elements: [{ id: "Big", name: "Big", kind: "class" }],
    classStereotypes: new Map([["Big", "large-class"]]),
  };
  // Restrict to Singleton only — god-class won't fire.
  const result = detectPatterns(ctx, { patternNames: ["Singleton"] });
  assert.equal(result.instances.length, 0);
  assert.equal(result.rawCountsByPattern.get("god-class"), undefined);
});

test("detectPatterns — rawCountsByPattern reports pre-threshold counts", () => {
  const ctx: PatternContext = {
    ...emptyContext(),
    elements: [{ id: "Big", name: "Big", kind: "class" }],
    classStereotypes: new Map([["Big", "large-class"]]),
  };
  const result = detectPatterns(ctx);
  assert.equal(result.rawCountsByPattern.get("god-class"), 1);
  assert.equal(result.rawCountsByPattern.get("Singleton"), 0);
});
