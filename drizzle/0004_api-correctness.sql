CREATE TABLE `__migration_0004_isbn_normalized` (
	`book_id` text PRIMARY KEY NOT NULL,
	`compact` text NOT NULL,
	`canonical_isbn` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__migration_0004_isbn_normalized` (`book_id`, `compact`, `canonical_isbn`)
WITH normalized AS (
	SELECT
		`id`,
		REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(`isbn`), '-', ''), ' ', ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), ''), CHAR(160), '') AS `compact`
	FROM `books`
	WHERE `isbn` IS NOT NULL
), converted AS (
	SELECT `id`, `compact`, '978' || SUBSTR(`compact`, 1, 9) AS `first_twelve`
	FROM normalized
)
SELECT
	`id`,
	`compact`,
	CASE WHEN LENGTH(`compact`) = 13 THEN `compact` ELSE
		`first_twelve` || CAST((10 - (
			CAST(SUBSTR(`first_twelve`, 1, 1) AS INTEGER)
			+ 3 * CAST(SUBSTR(`first_twelve`, 2, 1) AS INTEGER)
			+ CAST(SUBSTR(`first_twelve`, 3, 1) AS INTEGER)
			+ 3 * CAST(SUBSTR(`first_twelve`, 4, 1) AS INTEGER)
			+ CAST(SUBSTR(`first_twelve`, 5, 1) AS INTEGER)
			+ 3 * CAST(SUBSTR(`first_twelve`, 6, 1) AS INTEGER)
			+ CAST(SUBSTR(`first_twelve`, 7, 1) AS INTEGER)
			+ 3 * CAST(SUBSTR(`first_twelve`, 8, 1) AS INTEGER)
			+ CAST(SUBSTR(`first_twelve`, 9, 1) AS INTEGER)
			+ 3 * CAST(SUBSTR(`first_twelve`, 10, 1) AS INTEGER)
			+ CAST(SUBSTR(`first_twelve`, 11, 1) AS INTEGER)
			+ 3 * CAST(SUBSTR(`first_twelve`, 12, 1) AS INTEGER)
		) % 10) % 10 AS TEXT)
	END
FROM converted;--> statement-breakpoint
CREATE TABLE `__migration_0004_identity_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `__migration_0004_identity_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1 FROM `__migration_0004_isbn_normalized`
	WHERE NOT (
		(
			LENGTH(`compact`) = 13
			AND SUBSTR(`compact`, 1, 3) IN ('978', '979')
			AND `compact` NOT GLOB '*[^0-9]*'
			AND (
				CAST(SUBSTR(`compact`, 1, 1) AS INTEGER)
				+ 3 * CAST(SUBSTR(`compact`, 2, 1) AS INTEGER)
				+ CAST(SUBSTR(`compact`, 3, 1) AS INTEGER)
				+ 3 * CAST(SUBSTR(`compact`, 4, 1) AS INTEGER)
				+ CAST(SUBSTR(`compact`, 5, 1) AS INTEGER)
				+ 3 * CAST(SUBSTR(`compact`, 6, 1) AS INTEGER)
				+ CAST(SUBSTR(`compact`, 7, 1) AS INTEGER)
				+ 3 * CAST(SUBSTR(`compact`, 8, 1) AS INTEGER)
				+ CAST(SUBSTR(`compact`, 9, 1) AS INTEGER)
				+ 3 * CAST(SUBSTR(`compact`, 10, 1) AS INTEGER)
				+ CAST(SUBSTR(`compact`, 11, 1) AS INTEGER)
				+ 3 * CAST(SUBSTR(`compact`, 12, 1) AS INTEGER)
				+ CAST(SUBSTR(`compact`, 13, 1) AS INTEGER)
			) % 10 = 0
		)
		OR
		(
			LENGTH(`compact`) = 10
			AND SUBSTR(`compact`, 1, 9) NOT GLOB '*[^0-9]*'
			AND SUBSTR(`compact`, 10, 1) GLOB '[0-9X]'
			AND (
				10 * CAST(SUBSTR(`compact`, 1, 1) AS INTEGER)
				+ 9 * CAST(SUBSTR(`compact`, 2, 1) AS INTEGER)
				+ 8 * CAST(SUBSTR(`compact`, 3, 1) AS INTEGER)
				+ 7 * CAST(SUBSTR(`compact`, 4, 1) AS INTEGER)
				+ 6 * CAST(SUBSTR(`compact`, 5, 1) AS INTEGER)
				+ 5 * CAST(SUBSTR(`compact`, 6, 1) AS INTEGER)
				+ 4 * CAST(SUBSTR(`compact`, 7, 1) AS INTEGER)
				+ 3 * CAST(SUBSTR(`compact`, 8, 1) AS INTEGER)
				+ 2 * CAST(SUBSTR(`compact`, 9, 1) AS INTEGER)
				+ CASE SUBSTR(`compact`, 10, 1)
					WHEN 'X' THEN 10
					ELSE CAST(SUBSTR(`compact`, 10, 1) AS INTEGER)
				END
			) % 11 = 0
		)
	)
	UNION ALL
	SELECT 1 FROM `user_books`
	WHERE `review` IS NOT NULL AND TRIM(`review`) <> '' AND `rating` IS NULL
) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__migration_0004_identity_guard`;--> statement-breakpoint
UPDATE `books`
SET `isbn` = (
	SELECT normalized.`canonical_isbn`
	FROM `__migration_0004_isbn_normalized` AS normalized
	WHERE normalized.`book_id` = `books`.`id`
)
WHERE `isbn` IS NOT NULL;--> statement-breakpoint
UPDATE `user_books` SET `review` = NULL WHERE `review` IS NOT NULL AND TRIM(`review`) = '';--> statement-breakpoint
CREATE TABLE `book_google_ids` (
	`google_books_id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `book_google_ids` (`google_books_id`, `book_id`)
SELECT `google_books_id`, `id` FROM `books` WHERE `google_books_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `book_google_ids_book_id_idx` ON `book_google_ids` (`book_id`);--> statement-breakpoint
DROP INDEX `books_google_books_id_idx`;--> statement-breakpoint
DROP INDEX `books_isbn_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `books_google_books_id_unique` ON `books` (`google_books_id`) WHERE "books"."google_books_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `books_isbn_unique` ON `books` (`isbn`) WHERE "books"."isbn" IS NOT NULL;--> statement-breakpoint
DROP TABLE `__migration_0004_isbn_normalized`;
