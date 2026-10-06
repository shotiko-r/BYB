function validateApiUrl(value) {
  let url;
  try { url = new URL(value); } catch { /* Report configuration name, never its value. */ }
  if (!url || url.protocol !== 'https:' || url.origin !== value ||
      url.username || url.password || (['localhost', '0.0.0.0', '[::]', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost') || /^127\./.test(url.hostname))) {
    throw new Error('Production NEXT_PUBLIC_API_URL must be an explicit public HTTPS origin (no path or trailing slash)');
  }
  return value;
}
module.exports = { validateApiUrl };
