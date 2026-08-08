# Database Migrations

Production schema changes use reviewed Drizzle migrations. `db:push` is useful for inspecting a disposable database, but it is not the production deployment workflow.

## Creating A Migration

1. Update `src/lib/db/schema.ts`.
2. Run `npm run db:generate -- --name=<descriptive-name>`.
3. Review the generated SQL and snapshot.
4. Run the unit and end-to-end test suites against a fresh local database.
5. Test the migration against a current Turso production clone.
6. Back up production before running `npm run db:migrate` with production credentials.

## Adopting The Baseline

The baseline migration creates the schema for fresh databases. An existing BookShare database already has those tables and must be marked as having the baseline applied before `db:migrate` is used.

1. Create a Turso database clone from production.
2. Point the shell environment at the clone, overriding `.env.local`.
3. Verify independently that the clone contains the expected pre-migration BookShare schema.
4. Set `CONFIRM_BASELINE_ADOPTION=adopt-0000-baseline` and run `npm run db:adopt-baseline` against the clone.
5. Run `npm run db:migrate` against the clone. Only migrations after the baseline should execute.
6. Verify existing data, authentication, rate limiting, and application behavior on the clone.
7. Back up production and repeat the guarded adoption and migration commands there.

Never run the baseline migration directly against an existing database. It contains `CREATE TABLE` statements for tables that already exist.

The adoption script verifies required tables and columns, refuses partially applied Phase 2 schemas, and refuses unrelated migration history. It does not alter application tables.

Before deploying the security changes, also inventory existing `books.cover_url` values. The application now permits only HTTPS Google Books `/books/content` URLs and Open Library ISBN cover paths; unsupported legacy values will be returned as missing covers until corrected.

## Existing Data

SQLite and Turso require special care when adding non-null columns. Prefer migrations that add the column with a safe default, backfill existing rows, and only then introduce stricter constraints when needed.

## Roles And Integrity Migration

Migration `0003_roles-database-integrity` must be applied before deploying code that reads `users.role` or uses the `(user_id, book_id)` upsert target.

Before applying it to a current production clone and production itself:

1. Confirm `PRAGMA foreign_key_check` returns no rows.
2. Inventory duplicate `(user_id, book_id)` relationships, invalid boolean/rating values, and rows where both reading states are active.
3. Confirm which user has the earliest `created_at`, with `id` as the deterministic tie-breaker. That user is backfilled as admin.
4. Record row counts and create a fresh production backup.

The migration fails before changing application tables if legacy foreign-key violations exist. It consolidates duplicate relationships deterministically, prefers currently-reading over read, normalizes boolean values, preserves the newest rating and review clearing state, normalizes invalid ratings to null, installs role/state/rating/invite checks, adds relationship uniqueness and lookup indexes, and enables relationship cascades. Google Books IDs and ISBNs remain non-unique until migration `0004`.

After migration, repeat the row-count and foreign-key checks, verify exactly one existing admin, exercise member/admin deletion permissions, and smoke-test book creation plus invite generation before deployment.

## API Correctness Migration

Migration `0004_api-correctness` must be applied before deploying code that writes `book_google_ids` or relies on canonical ISBN uniqueness.

Before applying it:

1. Inventory exact and canonical ISBN collisions, duplicate Google Books IDs, blank reviews, and written reviews without ratings.
2. Confirm all non-null legacy ISBNs have valid ISBN-10 or ISBN-13 checksums.
3. Test the migration against a current Turso production clone and record row counts, alias counts, indexes, and `PRAGMA foreign_key_check` output.
4. Create a fresh production backup.

The migration converts valid ISBN-10 values to canonical ISBN-13, normalizes blank reviews to null, backfills every primary Google Books ID into the alias table, and adds partial unique indexes for canonical ISBNs and primary Google IDs. It fails closed and rolls back if an ISBN is invalid, canonical identities collide, or a written review lacks a rating.

After migration, confirm row counts are unchanged, every existing Google Books ID has an alias row, all ISBNs are canonical, the three new indexes exist, no invalid review state remains, and the foreign-key check is clean. Then smoke-test new-edition creation, ISBN attachment, Google-alias attachment, identity-conflict rejection, and rating/review clearing before deployment.
