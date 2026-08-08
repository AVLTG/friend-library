CREATE TABLE `__migration_0003_integrity_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `__migration_0003_integrity_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1 FROM `books` AS child
	LEFT JOIN `users` AS parent ON parent.id = child.added_by
	WHERE parent.id IS NULL
	UNION ALL
	SELECT 1 FROM `invite_tokens` AS child
	LEFT JOIN `users` AS parent ON parent.id = child.created_by
	WHERE parent.id IS NULL
	UNION ALL
	SELECT 1 FROM `invite_tokens` AS child
	LEFT JOIN `users` AS parent ON parent.id = child.used_by
	WHERE child.used_by IS NOT NULL AND parent.id IS NULL
	UNION ALL
	SELECT 1 FROM `user_books` AS child
	LEFT JOIN `users` AS parent ON parent.id = child.user_id
	WHERE parent.id IS NULL
	UNION ALL
	SELECT 1 FROM `user_books` AS child
	LEFT JOIN `books` AS parent ON parent.id = child.book_id
	WHERE parent.id IS NULL
) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__migration_0003_integrity_guard`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invite_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`created_by` text NOT NULL,
	`used_by` text,
	`used_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invite_tokens_usage_check" CHECK((`used_by` IS NULL AND `used_at` IS NULL) OR (`used_by` IS NOT NULL AND `used_at` IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_invite_tokens`("id", "token", "created_by", "used_by", "used_at", "expires_at", "created_at") SELECT "id", "token", "created_by", "used_by", "used_at", "expires_at", "created_at" FROM `invite_tokens`;--> statement-breakpoint
DROP TABLE `invite_tokens`;--> statement-breakpoint
ALTER TABLE `__new_invite_tokens` RENAME TO `invite_tokens`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `invite_tokens_token_unique` ON `invite_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `invite_tokens_created_by_idx` ON `invite_tokens` (`created_by`);--> statement-breakpoint
CREATE INDEX `invite_tokens_used_by_idx` ON `invite_tokens` (`used_by`);--> statement-breakpoint
CREATE TABLE `__new_user_books` (
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "user_books_owned_check" CHECK("__new_user_books"."owned" IN (0, 1)),
	CONSTRAINT "user_books_read_check" CHECK("__new_user_books"."read" IN (0, 1)),
	CONSTRAINT "user_books_currently_reading_check" CHECK("__new_user_books"."currently_reading" IN (0, 1)),
	CONSTRAINT "user_books_annotated_check" CHECK("__new_user_books"."annotated" IN (0, 1)),
	CONSTRAINT "user_books_reading_state_check" CHECK(NOT ("__new_user_books"."read" = 1 AND "__new_user_books"."currently_reading" = 1)),
	CONSTRAINT "user_books_rating_check" CHECK("__new_user_books"."rating" IS NULL OR "__new_user_books"."rating" IN (0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5))
);
--> statement-breakpoint
INSERT INTO `__new_user_books`(
	"id", "user_id", "book_id", "owned", "read", "currently_reading",
	"annotated", "rating", "review", "created_at", "updated_at"
)
SELECT
	(
		SELECT latest.id FROM user_books AS latest
		WHERE latest.user_id = grouped.user_id AND latest.book_id = grouped.book_id
		ORDER BY latest.updated_at DESC, latest.id DESC LIMIT 1
	),
	grouped.user_id,
	grouped.book_id,
	MAX(CASE WHEN grouped.owned = 0 THEN 0 ELSE 1 END),
	CASE
		WHEN MAX(CASE WHEN grouped.currently_reading = 0 THEN 0 ELSE 1 END) = 1 THEN 0
		ELSE MAX(CASE WHEN grouped.read = 0 THEN 0 ELSE 1 END)
	END,
	MAX(CASE WHEN grouped.currently_reading = 0 THEN 0 ELSE 1 END),
	MAX(CASE WHEN grouped.annotated = 0 THEN 0 ELSE 1 END),
	(
		SELECT CASE
			WHEN latest.rating IS NULL OR latest.rating IN (0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5) THEN latest.rating
			ELSE NULL
		END
		FROM user_books AS latest
		WHERE latest.user_id = grouped.user_id
			AND latest.book_id = grouped.book_id
		ORDER BY latest.updated_at DESC, latest.id DESC LIMIT 1
	),
	(
		SELECT latest.review FROM user_books AS latest
		WHERE latest.user_id = grouped.user_id
			AND latest.book_id = grouped.book_id
		ORDER BY latest.updated_at DESC, latest.id DESC LIMIT 1
	),
	MIN(grouped.created_at),
	MAX(grouped.updated_at)
FROM user_books AS grouped
GROUP BY grouped.user_id, grouped.book_id;--> statement-breakpoint
DROP TABLE `user_books`;--> statement-breakpoint
ALTER TABLE `__new_user_books` RENAME TO `user_books`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_books_user_book_unique` ON `user_books` (`user_id`,`book_id`);--> statement-breakpoint
CREATE INDEX `user_books_book_id_idx` ON `user_books` (`book_id`);--> statement-breakpoint
CREATE INDEX `user_books_currently_reading_idx` ON `user_books` (`book_id`,`user_id`) WHERE "user_books"."currently_reading" = 1;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'member' NOT NULL CONSTRAINT "users_role_check" CHECK(`role` IN ('admin', 'member'));--> statement-breakpoint
UPDATE `users`
SET `role` = 'admin'
WHERE `id` = (
	SELECT `id` FROM `users` ORDER BY `created_at` ASC, `id` ASC LIMIT 1
);--> statement-breakpoint
CREATE INDEX `books_google_books_id_idx` ON `books` (`google_books_id`);--> statement-breakpoint
CREATE INDEX `books_isbn_idx` ON `books` (`isbn`);--> statement-breakpoint
CREATE INDEX `books_added_by_idx` ON `books` (`added_by`);
