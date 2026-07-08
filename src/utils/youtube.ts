/**
 * Extracts the YouTube Video ID from various YouTube URL formats.
 * Supported formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Handle youtu.be/VIDEO_ID
    if (hostname === 'youtu.be') {
      return parsedUrl.pathname.slice(1);
    }

    // Handle youtube.com
    if (hostname.includes('youtube.com')) {
      // Check for watch?v=
      if (parsedUrl.searchParams.has('v')) {
        return parsedUrl.searchParams.get('v');
      }

      // Check for /embed/, /v/, /live/ (Skip /shorts/ to reject shorts)
      const pathPaths = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathPaths.length >= 2 && pathPaths[0] === 'shorts') {
        return null; // Reject shorts
      }
      if (pathPaths.length >= 2 && ['embed', 'v', 'live'].includes(pathPaths[0])) {
        return pathPaths[1];
      }
    }
  } catch (error) {
    // If URL parsing fails, we'll fall back to RegExp
  }

  // Fallback regex (Modified to reject shorts)
  if (url.includes('/shorts/')) {
    return null; // Reject shorts
  }
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|live\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }

  return null;
}
