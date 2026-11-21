// Markdown written by users (event descriptions), rendered to sanitised HTML. Same rules as
// the Vue app (frontend/src/methods/sanitize-html.js): no scripts, styles, forms, style or
// class attributes, and only http(s), mailto: and tel: links.
import DOMPurify from 'dompurify';
import { marked } from 'marked';

const OPTIONS = {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
    FORBID_ATTR: ['style', 'class'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
};

export function renderMarkdown(value: unknown): string {
    // Sanitise the rendered HTML, not the source: marked turns [x](javascript:...) into a link.
    return DOMPurify.sanitize(marked.parse(value == null ? '' : String(value), { async: false }), OPTIONS);
}
