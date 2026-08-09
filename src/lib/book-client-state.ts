import type {
  BookDetailDto,
  PublicUserDto,
  RatingDto,
  RelationshipDto,
} from "./api-types";

function reconcileUserList(
  users: PublicUserDto[],
  currentUser: PublicUserDto,
  included: boolean,
): PublicUserDto[] {
  const index = users.findIndex((user) => user.id === currentUser.id);
  if (!included) {
    return index === -1
      ? users
      : users.filter((_, userIndex) => userIndex !== index);
  }
  if (index === -1) return [...users, currentUser];
  return users.map((user, userIndex) =>
    userIndex === index ? currentUser : user,
  );
}

function reconcileRatings(
  ratings: RatingDto[],
  currentUser: PublicUserDto,
  relationship: RelationshipDto | null,
): RatingDto[] {
  const index = ratings.findIndex((rating) => rating.user.id === currentUser.id);
  if (!relationship || relationship.rating === null) {
    return index === -1
      ? ratings
      : ratings.filter((_, ratingIndex) => ratingIndex !== index);
  }

  const rating: RatingDto = {
    user: currentUser,
    rating: relationship.rating,
    review: relationship.review,
    updatedAt: relationship.updatedAt,
  };
  if (index === -1) return [...ratings, rating];
  return ratings.map((existing, ratingIndex) =>
    ratingIndex === index ? rating : existing,
  );
}

export function reconcileCurrentUserRelationship(
  book: BookDetailDto,
  relationship: RelationshipDto | null,
): BookDetailDto {
  const ratings = reconcileRatings(book.ratings, book.currentUser, relationship);

  return {
    ...book,
    owners: reconcileUserList(
      book.owners,
      book.currentUser,
      relationship?.owned ?? false,
    ),
    readers: reconcileUserList(
      book.readers,
      book.currentUser,
      relationship?.read ?? false,
    ),
    annotators: reconcileUserList(
      book.annotators,
      book.currentUser,
      relationship?.annotated ?? false,
    ),
    currentlyReading: reconcileUserList(
      book.currentlyReading,
      book.currentUser,
      relationship?.currentlyReading ?? false,
    ),
    ratings,
    averageRating:
      ratings.length === 0
        ? null
        : ratings.reduce((sum, rating) => sum + rating.rating, 0) /
          ratings.length,
    currentUserBook: relationship,
    permissions: {
      ...book.permissions,
      canRemoveRelationship: relationship !== null,
    },
  };
}
