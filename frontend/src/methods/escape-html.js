// Escapes text for places that render HTML, such as Buefy dialog and toast messages.
const replacements = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export default function escapeHtml (value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => replacements[character])
}
