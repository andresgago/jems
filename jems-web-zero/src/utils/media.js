const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1')
  .replace(/\/api\/v1\/?$/, '');

// File/image fields come back either absolute (object storage) or relative
// (/media/...). Relative paths must be prefixed with the API origin so they do
// not resolve against the frontend dev server.
export function mediaUrl(value) {
  if (!value) return null;
  return /^https?:\/\//.test(value) ? value : `${API_ORIGIN}${value}`;
}
