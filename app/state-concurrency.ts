// Pure helpers for the /api/state optimistic concurrency on `shared_state`.
// Kept free of Worker/D1 imports so they can be unit-tested under plain Node.

export function normalizeExpectedRevision(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

export function isRevisionConflict(
  expectedRevision: number | null,
  newRevision: number,
): boolean {
  return (
    expectedRevision !== null && newRevision !== expectedRevision + 1
  );
}
