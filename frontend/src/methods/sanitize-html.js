import DOMPurify from 'dompurify'

// For HTML written by users (markdown descriptions, calendar descriptions). Besides scripts,
// which DOMPurify always removes, this drops what could restyle or cover the page or show a
// fake form (for example asking for a password): <style>, form elements, and the style and
// class attributes (class would allow Bulma's full-screen modal or fixed navbar classes).
// Markdown never produces these.
const OPTIONS = {
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
  FORBID_ATTR: ['style', 'class']
}

export default function sanitizeHtml (html) {
  return DOMPurify.sanitize(html, OPTIONS)
}
