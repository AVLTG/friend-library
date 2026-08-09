type ParseResult<T> =
  | { success: true; data: T }
  | { success: false };

export type ResponseSchema<T> = {
  safeParse(value: unknown): ParseResult<T>;
  parse(value: unknown): T;
};

function responseSchema<T>(guard: (value: unknown) => value is T): ResponseSchema<T> {
  return {
    safeParse(value) {
      return guard(value)
        ? { success: true, data: value }
        : { success: false };
    },
    parse(value) {
      if (!guard(value)) throw new Error("Invalid response");
      return value;
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null ||
    (typeof value === "number" && Number.isInteger(value) && value > 0);
}

function isRating(value: unknown): value is number {
  return typeof value === "number" &&
    value >= 0.5 &&
    value <= 5 &&
    Number.isInteger(value * 2);
}

function isAverageRating(value: unknown): value is number {
  return typeof value === "number" && value >= 0.5 && value <= 5;
}

function isArrayOf<T>(
  value: unknown,
  guard: (entry: unknown) => entry is T,
): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export type ApiErrorBody = {
  error: string;
  code: string;
};

export type SuccessDto = { success: true };
export type SetupStatusDto = { needsSetup: boolean };
export type SetupSuccessDto = SuccessDto & {
  inviteToken: string;
  message: string;
};

export type PublicUserDto = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarColor: string;
};

export type RelationshipDto = {
  owned: boolean;
  read: boolean;
  currentlyReading: boolean;
  annotated: boolean;
  rating: number | null;
  review: string | null;
  updatedAt: string;
};

export type RatingDto = {
  user: PublicUserDto;
  rating: number;
  review: string | null;
  updatedAt: string;
};

export type BookDto = {
  id: string;
  googleBooksId: string | null;
  googleBooksIds: string[];
  title: string;
  authors: string[];
  isbn: string | null;
  description: string | null;
  coverUrl: string | null;
  pageCount: number | null;
  publishedDate: string | null;
  categories: string[];
  spineColor: string;
  addedBy: string;
  createdAt: string;
  owners: PublicUserDto[];
  readers: PublicUserDto[];
  annotators: PublicUserDto[];
  currentlyReading: PublicUserDto[];
  ratings: RatingDto[];
  averageRating: number | null;
  currentUserBook: RelationshipDto | null;
};

export type BookIdentityDto = Pick<
  BookDto,
  "id" | "googleBooksIds" | "isbn" | "title" | "authors"
>;

export type BookDetailDto = BookDto & {
  currentUser: PublicUserDto;
  permissions: {
    canDeleteGlobally: boolean;
    canRemoveRelationship: boolean;
  };
};

export type CreateBookDto = {
  bookId: string;
  bookCreated: boolean;
  relationshipCreated: boolean;
  owned: true;
};

export type SearchBookDto = {
  id: string;
  title: string;
  authors: string[];
  description: string | null;
  isbn: string | null;
  coverUrl: string | null;
  pageCount: number | null;
  publishedDate: string | null;
  categories: string[];
};

export type ReadingEntryDto = {
  book: Pick<
    BookDto,
    "id" | "title" | "authors" | "coverUrl" | "spineColor" | "pageCount"
  >;
  user: PublicUserDto;
};

export type InviteListItemDto = {
  id: string;
  token: string;
  createdBy: string;
  usedBy: string | null;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
};

export type CreateInviteDto = {
  token: string;
  expiresAt: string;
};

function isPublicUser(value: unknown): value is PublicUserDto {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.username === "string" &&
    typeof value.firstName === "string" &&
    typeof value.lastName === "string" &&
    typeof value.avatarColor === "string";
}

function isRelationship(value: unknown): value is RelationshipDto {
  return isRecord(value) &&
    typeof value.owned === "boolean" &&
    typeof value.read === "boolean" &&
    typeof value.currentlyReading === "boolean" &&
    typeof value.annotated === "boolean" &&
    (value.rating === null || isRating(value.rating)) &&
    isNullableString(value.review) &&
    typeof value.updatedAt === "string";
}

function isRatingDto(value: unknown): value is RatingDto {
  return isRecord(value) &&
    isPublicUser(value.user) &&
    isRating(value.rating) &&
    isNullableString(value.review) &&
    typeof value.updatedAt === "string";
}

function hasBookFields(value: Record<string, unknown>): boolean {
  return typeof value.id === "string" &&
    isNullableString(value.googleBooksId) &&
    isArrayOf(value.googleBooksIds, isString) &&
    typeof value.title === "string" &&
    isArrayOf(value.authors, isString) &&
    isNullableString(value.isbn) &&
    isNullableString(value.description) &&
    isNullableString(value.coverUrl) &&
    isNullablePositiveInteger(value.pageCount) &&
    isNullableString(value.publishedDate) &&
    isArrayOf(value.categories, isString) &&
    typeof value.spineColor === "string" &&
    typeof value.addedBy === "string" &&
    typeof value.createdAt === "string" &&
    isArrayOf(value.owners, isPublicUser) &&
    isArrayOf(value.readers, isPublicUser) &&
    isArrayOf(value.annotators, isPublicUser) &&
    isArrayOf(value.currentlyReading, isPublicUser) &&
    isArrayOf(value.ratings, isRatingDto) &&
    (value.averageRating === null || isAverageRating(value.averageRating)) &&
    (value.currentUserBook === null || isRelationship(value.currentUserBook));
}

function isBook(value: unknown): value is BookDto {
  return isRecord(value) && hasBookFields(value);
}

function isBookIdentity(value: unknown): value is BookIdentityDto {
  return isRecord(value) &&
    typeof value.id === "string" &&
    isArrayOf(value.googleBooksIds, isString) &&
    isNullableString(value.isbn) &&
    typeof value.title === "string" &&
    isArrayOf(value.authors, isString);
}

function isSearchResult(value: unknown): value is SearchBookDto {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isArrayOf(value.authors, isString) &&
    isNullableString(value.description) &&
    isNullableString(value.isbn) &&
    isNullableString(value.coverUrl) &&
    isNullablePositiveInteger(value.pageCount) &&
    isNullableString(value.publishedDate) &&
    isArrayOf(value.categories, isString);
}

export const apiErrorResponseSchema = /* @__PURE__ */ responseSchema<ApiErrorBody>(
  (value): value is ApiErrorBody =>
    isRecord(value) &&
    typeof value.error === "string" &&
    typeof value.code === "string",
);

export const successResponseSchema = /* @__PURE__ */ responseSchema<SuccessDto>(
  (value): value is SuccessDto =>
    isRecord(value) && value.success === true,
);

export const setupStatusResponseSchema = /* @__PURE__ */ responseSchema<SetupStatusDto>(
  (value): value is SetupStatusDto =>
    isRecord(value) &&
    typeof value.needsSetup === "boolean",
);

export const setupSuccessResponseSchema = /* @__PURE__ */ responseSchema<SetupSuccessDto>(
  (value): value is SetupSuccessDto =>
    isRecord(value) &&
    value.success === true &&
    typeof value.inviteToken === "string" &&
    typeof value.message === "string",
);

export const publicUserResponseSchema = /* @__PURE__ */ responseSchema(isPublicUser);
export const relationshipResponseSchema = /* @__PURE__ */ responseSchema(isRelationship);

export const bookDetailResponseSchema = /* @__PURE__ */ responseSchema<BookDetailDto>(
  (value): value is BookDetailDto =>
    isRecord(value) &&
    hasBookFields(value) &&
    isPublicUser(value.currentUser) &&
    isRecord(value.permissions) &&
    typeof value.permissions.canDeleteGlobally === "boolean" &&
    typeof value.permissions.canRemoveRelationship === "boolean",
);

export const createBookResponseSchema = /* @__PURE__ */ responseSchema<CreateBookDto>(
  (value): value is CreateBookDto =>
    isRecord(value) &&
    typeof value.bookId === "string" &&
    typeof value.bookCreated === "boolean" &&
    typeof value.relationshipCreated === "boolean" &&
    value.owned === true,
);

export const readingEntryResponseSchema = /* @__PURE__ */ responseSchema<ReadingEntryDto>(
  (value): value is ReadingEntryDto =>
    isRecord(value) &&
    isRecord(value.book) &&
    typeof value.book.id === "string" &&
    typeof value.book.title === "string" &&
    isArrayOf(value.book.authors, isString) &&
    isNullableString(value.book.coverUrl) &&
    typeof value.book.spineColor === "string" &&
    isNullablePositiveInteger(value.book.pageCount) &&
    isPublicUser(value.user),
);

export const inviteListItemResponseSchema = /* @__PURE__ */ responseSchema<InviteListItemDto>(
  (value): value is InviteListItemDto =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.token === "string" &&
    typeof value.createdBy === "string" &&
    isNullableString(value.usedBy) &&
    isNullableString(value.usedAt) &&
    typeof value.expiresAt === "string" &&
    typeof value.createdAt === "string",
);

export const createInviteResponseSchema = /* @__PURE__ */ responseSchema<CreateInviteDto>(
  (value): value is CreateInviteDto =>
    isRecord(value) &&
    typeof value.token === "string" &&
    typeof value.expiresAt === "string",
);

function arraySchema<T>(guard: (value: unknown) => value is T) {
  return responseSchema<T[]>((value): value is T[] => isArrayOf(value, guard));
}

export const booksResponseSchema = /* @__PURE__ */ arraySchema(isBook);
export const bookIdentitiesResponseSchema = /* @__PURE__ */ arraySchema(isBookIdentity);
export const searchResultsResponseSchema = /* @__PURE__ */ arraySchema(isSearchResult);
export const readingEntriesResponseSchema = /* @__PURE__ */ arraySchema(
  (value): value is ReadingEntryDto =>
    readingEntryResponseSchema.safeParse(value).success,
);
export const inviteListResponseSchema = /* @__PURE__ */ arraySchema(
  (value): value is InviteListItemDto =>
    inviteListItemResponseSchema.safeParse(value).success,
);
