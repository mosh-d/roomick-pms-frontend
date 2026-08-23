/**
 * Turns free text into a subdomain-shaped slug: lowercase, non-alphanumeric
 * runs collapsed to a single hyphen, no leading/trailing hyphen. Matches
 * the backend's subdomain regex (`^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`) for
 * any non-empty input, so a slugified group name always passes client
 * validation without a separate round of cleanup.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
