export function getSpineWidth(pageCount?: number | null): number {
  return Math.max(28, Math.min(55, (pageCount || 200) / 8));
}
