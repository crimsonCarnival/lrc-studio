/**
 * Pure utility functions for the Player component.
 */

/**
 * Extract a YouTube video ID from a URL or bare ID string.
 * @param {string} url
 * @returns {string|null}
 */
export function extractVideoId(url) {
  if (typeof url !== 'string') return null;
  const patterns = [
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|watch\?.+&v=)|youtu\.be\/)([^&?/\s]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}
