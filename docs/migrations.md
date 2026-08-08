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
