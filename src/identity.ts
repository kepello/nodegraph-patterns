/**
 * Pattern-instance identity. `patternId = sha256(patternName || '\n'
 * || sorted role.elementId joined by '\n')` truncated to 16 hex
 * chars. Same set of role-fillers in the same pattern always
 * produces the same id — useful for upsert semantics on re-detection.
 */

import { createHash } from "node:crypto";

const SHORT_HASH_LENGTH = 16;

export function computePatternId(
  patternName: string,
  roleElementIds: Iterable<string>,
): string {
  const sorted = [...roleElementIds].sort();
  const hasher = createHash("sha256");
  hasher.update(patternName);
  for (const id of sorted) {
    hasher.update("\n");
    hasher.update(id);
  }
  return hasher.digest("hex").slice(0, SHORT_HASH_LENGTH);
}
