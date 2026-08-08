export function isSqliteUniqueConstraint(
  error: unknown,
  targets: string[],
): boolean {
  const seen = new Set<unknown>();
  let current = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    const message = current instanceof Error ? current.message : "";
    if (
      /unique constraint failed:/i.test(message) &&
      targets.some((target) => message.includes(target))
    ) {
      return true;
    }
    current =
      typeof current === "object" && "cause" in current
        ? (current as { cause?: unknown }).cause
        : null;
  }

  return false;
}
