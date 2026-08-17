import test from "node:test";
import assert from "node:assert/strict";
import {
  isRevisionConflict,
  normalizeExpectedRevision,
} from "../app/state-concurrency.ts";

test("normalizes the expected revision strictly", () => {
  assert.equal(normalizeExpectedRevision(3), 3);
  assert.equal(normalizeExpectedRevision(0), 0);
  assert.equal(normalizeExpectedRevision(3.5), null);
  assert.equal(normalizeExpectedRevision(-1), null);
  assert.equal(normalizeExpectedRevision(NaN), null);
  assert.equal(normalizeExpectedRevision("3"), null);
  assert.equal(normalizeExpectedRevision(undefined), null);
  assert.equal(normalizeExpectedRevision(null), null);
});

test("detects a lost-update conflict", () => {
  // No expectation: the write is unconditional and always succeeds.
  assert.equal(isRevisionConflict(null, 5), false);
  // Client at revision 4, server advanced to 5: success.
  assert.equal(isRevisionConflict(4, 5), false);
  // Client at revision 4, server still at 4: the conditional update was rejected.
  assert.equal(isRevisionConflict(4, 4), true);
  // Client at revision 4, server jumped to 6: another writer won in between.
  assert.equal(isRevisionConflict(4, 6), true);
});
