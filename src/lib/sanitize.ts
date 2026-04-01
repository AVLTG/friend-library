// Strip HTML tags to prevent XSS in user-generated content
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

// Sanitize a general text input: trim, strip HTML, enforce max length
export function sanitizeText(input: string, maxLength: number = 500): string {
  return stripHtml(input).trim().slice(0, maxLength);
}

// Sanitize a name field: trim, strip HTML, enforce character set and length
export function sanitizeName(input: string): string {
  return stripHtml(input)
    .trim()
    .replace(/[^\p{L}\p{M}\s'-]/gu, "") // Allow Unicode letters, marks, spaces, hyphens, apostrophes
    .slice(0, 50);
}

// Sanitize a review: trim, strip HTML, enforce max length
export function sanitizeReview(input: string): string {
  return stripHtml(input).trim().slice(0, 5000);
}

// Validate rating value
export function validateRating(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (isNaN(num) || num < 0.5 || num > 5) return null;
  // Snap to nearest 0.5
  return Math.round(num * 2) / 2;
}
