import { describe, expect, it } from "vitest";
import {
  RelationshipStateError,
  resolveRelationshipState,
} from "./relationship-state";

const existing = {
  owned: true,
  read: false,
  currentlyReading: true,
  annotated: true,
  rating: 4,
  review: "Worth reading",
};

describe("relationship state", () => {
  it("keeps reading states mutually exclusive", () => {
    expect(resolveRelationshipState(existing, { read: true })).toMatchObject({
      read: true,
      currentlyReading: false,
    });
    expect(
      resolveRelationshipState(existing, { currentlyReading: true }),
    ).toMatchObject({ read: false, currentlyReading: true });
  });

  it("ignores omitted fields represented as undefined", () => {
    expect(
      resolveRelationshipState(existing, {
        owned: undefined,
        read: true,
        currentlyReading: undefined,
        annotated: undefined,
        rating: undefined,
        review: undefined,
      }),
    ).toMatchObject({
      owned: true,
      read: true,
      currentlyReading: false,
      annotated: true,
      rating: 4,
      review: "Worth reading",
    });
  });

  it("rejects explicitly conflicting reading states", () => {
    expect(() =>
      resolveRelationshipState(existing, {
        read: true,
        currentlyReading: true,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RelationshipStateError>>({
        code: "INVALID_READING_STATE",
      }),
    );
  });

  it("requires a rating for a written review", () => {
    expect(() =>
      resolveRelationshipState(existing, { rating: null }),
    ).toThrowError(
      expect.objectContaining<Partial<RelationshipStateError>>({
        code: "INVALID_REVIEW_STATE",
      }),
    );
    expect(() =>
      resolveRelationshipState(null, { review: "Review without rating" }),
    ).toThrowError(RelationshipStateError);
  });

  it("supports explicit review and rating clearing", () => {
    expect(
      resolveRelationshipState(existing, { rating: null, review: null }),
    ).toMatchObject({ rating: null, review: null });
    expect(resolveRelationshipState(existing, { review: null })).toMatchObject({
      rating: 4,
      review: null,
    });
  });

  it("normalizes an empty review to null", () => {
    expect(resolveRelationshipState(existing, { review: "  " }).review).toBeNull();
  });
});
