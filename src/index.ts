/**
 * Public API surface for `@kepello/nodegraph-patterns`.
 */

// Schema
export {
  PATTERN_DOMAIN,
  PATTERN_INDEXES,
  PATTERN_METADATA_KIND,
  PATTERN_METADATA_SCHEMA,
  PATTERN_SCHEMA_VERSION,
} from "./schema.js";

// Types
export {
  ROLE_EDGE_TYPE,
  type PatternFamily,
  type PatternInput,
  type PatternInstance,
  type PatternInstanceRole,
  type PatternMetadata,
  type PatternNode,
  type PatternOverlay,
} from "./types.js";

// Detection context
export type {
  ClusterInfo,
  PatternContext,
  PatternEdge,
  PatternElement,
} from "./context.js";

// Identity
export { computePatternId } from "./identity.js";

// Matchers
export {
  ALL_MATCHERS,
  matchAdapter,
  matchCommand,
  matchDecorator,
  matchFactoryMethod,
  matchGodClass,
  matchHexagonal,
  matchLayered,
  matchObserver,
  matchSingleton,
  type Matcher,
} from "./matchers.js";

// Detection runner
export {
  detectPatterns,
  type DetectPatternsOptions,
  type DetectPatternsResult,
} from "./detect.js";

// Overlay
export {
  PatternOverlayImpl,
  makePatternOverlay,
} from "./overlay.js";
