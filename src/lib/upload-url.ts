/** Public URL of a stored upload (served by /api/uploads after the auth check). */
export function uploadUrl(relative: string) {
  return `/api/uploads/${relative}`;
}
