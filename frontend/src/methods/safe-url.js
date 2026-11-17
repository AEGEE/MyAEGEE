// Links typed in by users are only rendered as links when they're http(s) links,
// so a stored javascript: or data: link can't run anything when clicked.
// A link without a scheme (like www.example.org) is opened as https;
// the backend validates links with the same rule.
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
