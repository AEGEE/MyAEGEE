import DOMPurify from 'dompurify'

// For HTML written by users (markdown descriptions, calendar descriptions). Besides scripts,
// which DOMPurify always removes, this drops what could restyle or cover the page or show a
// fake form (for example asking for a password): <style>, form elements, and the style and
// class attributes (class would allow Bulma's full-screen modal or fixed navbar classes).
// Markdown never produces these.
// Links and images may only use http(s), mailto: and tel: (or be relative), like the links
// in other fields (see safe-url.js); DOMPurify's default also allows ftp:, sms:, xmpp: and more.
const OPTIONS = {
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
  FORBID_ATTR: ['style', 'class'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
}

export default function sanitizeHtml (html) {
  return DOMPurify.sanitize(html, OPTIONS)
}
