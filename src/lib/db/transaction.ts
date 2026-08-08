export async function withSqliteBusyRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const isBusy =
        error instanceof Error &&
        "code" in error &&
        (error as Error & { code?: string }).code === "SQLITE_BUSY";
      if (!isBusy || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }

  throw new Error("SQLite transaction retry exhausted");
}
