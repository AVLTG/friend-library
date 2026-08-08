import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const USER_ROLES = ["admin", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // nanoid
    username: text("username").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    avatarColor: text("avatar_color").notNull(), // hex color for avatar
    role: text("role", { enum: USER_ROLES }).notNull().default("member"),
    sessionVersion: integer("session_version").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    check("users_role_check", sql`${table.role} IN ('admin', 'member')`),
  ],
);

export const inviteTokens = sqliteTable(
  "invite_tokens",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    usedBy: text("used_by").references(() => users.id),
    usedAt: integer("used_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("invite_tokens_created_by_idx").on(table.createdBy),
    index("invite_tokens_used_by_idx").on(table.usedBy),
    check(
      "invite_tokens_usage_check",
      sql`(${table.usedBy} IS NULL AND ${table.usedAt} IS NULL) OR (${table.usedBy} IS NOT NULL AND ${table.usedAt} IS NOT NULL)`,
    ),
  ],
);

export const books = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(),
    googleBooksId: text("google_books_id"),
    title: text("title").notNull(),
    authors: text("authors").notNull(), // JSON array
    isbn: text("isbn"),
    description: text("description"),
    coverUrl: text("cover_url"),
    pageCount: integer("page_count"),
    publishedDate: text("published_date"),
    categories: text("categories"), // JSON array
    spineColor: text("spine_color").notNull(), // assigned color for bookshelf
    addedBy: text("added_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("books_google_books_id_unique")
      .on(table.googleBooksId)
      .where(sql`${table.googleBooksId} IS NOT NULL`),
    uniqueIndex("books_isbn_unique")
      .on(table.isbn)
      .where(sql`${table.isbn} IS NOT NULL`),
    index("books_added_by_idx").on(table.addedBy),
  ],
);

export const bookGoogleIds = sqliteTable(
  "book_google_ids",
  {
    googleBooksId: text("google_books_id").primaryKey(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
  },
  (table) => [index("book_google_ids_book_id_idx").on(table.bookId)],
);

export const userBooks = sqliteTable("user_books", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  owned: integer("owned", { mode: "boolean" }).notNull().default(false),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  currentlyReading: integer("currently_reading", { mode: "boolean" }).notNull().default(false),
  annotated: integer("annotated", { mode: "boolean" }).notNull().default(false),
  rating: real("rating"), // 0.5 - 5 in 0.5 increments
  review: text("review"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("user_books_user_book_unique").on(table.userId, table.bookId),
    index("user_books_book_id_idx").on(table.bookId),
    index("user_books_currently_reading_idx")
      .on(table.bookId, table.userId)
      .where(sql`${table.currentlyReading} = 1`),
    check("user_books_owned_check", sql`${table.owned} IN (0, 1)`),
    check("user_books_read_check", sql`${table.read} IN (0, 1)`),
    check(
      "user_books_currently_reading_check",
      sql`${table.currentlyReading} IN (0, 1)`,
    ),
    check("user_books_annotated_check", sql`${table.annotated} IN (0, 1)`),
    check(
      "user_books_reading_state_check",
      sql`NOT (${table.read} = 1 AND ${table.currentlyReading} = 1)`,
    ),
    check(
      "user_books_rating_check",
      sql`${table.rating} IS NULL OR ${table.rating} IN (0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)`,
    ),
  ],
);

export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    id: text("id").primaryKey(),
    count: integer("count").notNull(),
    resetAt: integer("reset_at").notNull(),
  },
  (table) => [index("rate_limit_reset_at_idx").on(table.resetAt)],
);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Book = typeof books.$inferSelect;
export type BookGoogleId = typeof bookGoogleIds.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type UserBook = typeof userBooks.$inferSelect;
export type InviteToken = typeof inviteTokens.$inferSelect;
