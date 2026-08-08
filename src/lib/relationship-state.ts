export type RelationshipState = {
  owned: boolean;
  read: boolean;
  currentlyReading: boolean;
  annotated: boolean;
  rating: number | null;
  review: string | null;
};

export type RelationshipChanges = Partial<RelationshipState>;

export class RelationshipStateError extends Error {
  constructor(
    public readonly code: "INVALID_READING_STATE" | "INVALID_REVIEW_STATE",
    message: string,
  ) {
    super(message);
  }
}

const emptyRelationship: RelationshipState = {
  owned: false,
  read: false,
  currentlyReading: false,
  annotated: false,
  rating: null,
  review: null,
};

export function resolveRelationshipState(
  current: RelationshipState | null,
  changes: RelationshipChanges,
): RelationshipState {
  if (changes.read === true && changes.currentlyReading === true) {
    throw new RelationshipStateError(
      "INVALID_READING_STATE",
      "A book cannot be read and currently reading at the same time",
    );
  }

  const definedChanges = Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  ) as RelationshipChanges;
  const next = { ...(current || emptyRelationship), ...definedChanges };
  if (changes.read === true) next.currentlyReading = false;
  if (changes.currentlyReading === true) next.read = false;
  if (typeof next.review === "string") next.review = next.review.trim() || null;

  if (next.review && next.rating === null) {
    throw new RelationshipStateError(
      "INVALID_REVIEW_STATE",
      "A written review requires a rating",
    );
  }

  return next;
}
