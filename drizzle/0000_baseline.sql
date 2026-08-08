CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`google_books_id` text,
	`title` text NOT NULL,
	`authors` text NOT NULL,
	`isbn` text,
	`description` text,
	`cover_url` text,
	`page_count` integer,
	`published_date` text,
	`categories` text,
	`spine_color` text NOT NULL,
	`added_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invite_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`created_by` text NOT NULL,
	`used_by` text,
	`used_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_tokens_token_unique` ON `invite_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `user_books` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`owned` integer DEFAULT false NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`currently_reading` integer DEFAULT false NOT NULL,
	`annotated` integer DEFAULT false NOT NULL,
	`rating` real,
	`review` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`avatar_color` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);