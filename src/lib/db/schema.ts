import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // nanoid
  username: text("username").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarColor: text("avatar_color").notNull(), // hex color for avatar
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const inviteTokens = sqliteTable("invite_tokens", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  usedBy: text("used_by").references(() => users.id),
  usedAt: integer("used_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const books = sqliteTable("books", {
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
});

export const userBooks = sqliteTable("user_books", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id),
  owned: integer("owned", { mode: "boolean" }).notNull().default(false),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  annotated: integer("annotated", { mode: "boolean" }).notNull().default(false),
  rating: real("rating"), // 0.5 - 5 in 0.5 increments
  review: text("review"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type UserBook = typeof userBooks.$inferSelect;
export type InviteToken = typeof inviteTokens.$inferSelect;
