// Links typed in by users are only rendered as links when they're http(s) links,
// so a stored javascript: or data: link can't run anything when clicked.
// The backend only accepts new links starting with http:// or https://; older
// links without a scheme (like www.example.org) are opened as https.
export default function safeUrl (value) {
  if (typeof value !== 'string') return null

  const link = value.trim()
  if (!link) return null

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(link) ? link : `https://${link}`)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch (err) {
    return null
  }
}
