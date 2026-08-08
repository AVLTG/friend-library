export type ApiErrorBody = {
  error: string;
  code: string;
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

export type BookDetailDto = BookDto & {
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
