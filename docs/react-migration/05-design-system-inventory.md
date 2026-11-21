# 05 · Design system inventory

What the Vue frontend uses today (components, patterns, colours), what the new React component
library needs to contain, the accessibility requirements for each piece, and the decisions to
make before building it. The library itself is out of scope for the spike (see
[00-spike-charter.md](00-spike-charter.md)). This document is the starting point for it.

All counts come from two scripts in `docs/react-migration/tools/` (see
[How the numbers were produced](#how-the-numbers-were-produced)). File references are relative to
`frontend/src/` unless they say otherwise.

## Summary

1. **The UI vocabulary is small.** Most of the UI is raw Bulma markup, not Buefy components:
   2,329 Bulma pattern uses against 493 Buefy component uses. Buefy is used for 16 components, and
   `b-table` (47 tables in 44 files, 282 columns) plus programmatic dialogs, modals and toasts
   account for most of it. About 40 library components cover the whole app (list below), and the
   events browse + apply slice needs 27 of them, most of them small.
2. **Forms are the biggest accessibility problem.** 333 of the 365 `<label>` elements are not tied
   to a control (no `for`, no nested control), and 309 native inputs/selects/textareas have no id,
   `aria-label` or wrapping label. Required fields are marked only with a red `*`. Errors are not
   linked to their fields, and error summaries are neither focused nor announced. The events apply
   form (`views/events/Apply.vue`) has all of these problems. Field, Label, Description and Error
   wiring therefore has to be built into the library's form components, not left to each view.
3. **Clickable things are often not buttons.** There are 125 `<a>` elements with a click handler
   and no `href` (39 files). They can't be reached with Tab and aren't announced as buttons. They
   include the navbar user menu and logout, sidebar group toggles, the "Display past events"
   toggle, and most admin actions. The navbar dropdown opens only on hover (`is-hoverable`).
4. **The colour system fails AA in predictable places.** Bulma 0.9's `findColorInvert` picks
   white text for any colour whose (approximated) luminance is below 0.55. The WCAG crossover is
   about 0.18, so mid-tone brand colours get white text. White on `is-info` (#4ca0ff) is 2.7:1 and
   white on `is-success` (#a0c514) is 2.0:1. **Every success toast (113 `showSuccess` calls) is
   1.9:1** and the 58 `notification is-info` blocks are 2.7:1. Input borders are 1.38:1, the
   placeholder is 1.77:1 and the button focus ring is 1.44:1. Event-type tags hard-code white text
   on #FBBA00 (1.73:1) and #A0C514 (2.0:1). 27 of the app-wide pairs fail (42 when the
   statutory-stats chart colours are counted).
5. **Cheap fix in Vue now:** set `$info-invert`, `$success-invert` (and the `-dark` shades) in
   `main.scss` before the Bulma import, and stop hard-coding `color: #FFFFFF` on event-type tags.
   This fixes most failing text pairs without changing the brand colours, and the React tokens can
   start from the same corrected values so both apps look the same during coexistence.
6. **Headless foundation: React Aria Components (RAC).** It is the only option that covers
   everything we need, including DatePicker/DateRangePicker with time fields, ComboBox, TagGroup,
   an accessible Table, Toast and FileTrigger/DropZone, with locale-aware date handling
   (`@internationalized/date`). Base UI is a good second choice for the simpler widgets but has no
   date picker. Radix is maintained only slowly and lacks combobox, date picker and table.
7. **Styling: CSS Modules + CSS custom properties** for design tokens, styled against RAC's
   `data-*` state attributes. Don't take Bulma into React. Tailwind v4 is an acceptable alternative
   if the team prefers it. [02-target-stack.md](02-target-stack.md) adopts this.
8. **Third-party widgets:** keep FullCalendar (React adapter) and add an agenda list. Move maps
   from vue-mapbox / mapbox-gl 0.53 to MapLibre with `react-map-gl`, always with a text list of
   locations. Move charts to Chart.js 4 + `react-chartjs-2` (or SVG charts), always with a data
   table. Replace flatpickr, vue-multiselect and vue-input-tag with RAC components. Replace moment
   with `@internationalized/date` / `Intl`. Drop `animate.css`, `vue-bulma-collapse` and
   `vue-infinite-loading`, which are declared but never imported.

## How the numbers were produced

| Script | Output | What it does |
|---|---|---|
| `docs/react-migration/tools/component-usage.mjs` | `docs/react-migration/data/component-usage.json` | Dependency-free tag tokenizer over the top-level `<template>` of every `frontend/src/**/*.vue` (136 files), plus a regex scan of `<script>` blocks and `frontend/src/**/*.js` (26 files). Records Buefy tags with props and variants, `$buefy.*` calls with their option keys and `type`, the toast helpers in `methods/index.js`, third-party tags/directives/imports, local components, Bulma class families with modifiers and host elements, and a set of a11y heuristics (anchors used as buttons, unassociated labels, icon-only buttons, `v-html`, images without alt, headings). Each entry has counts, the file list and up to 12 `file:line` examples. |
| `docs/react-migration/tools/contrast-audit.mjs` | `docs/react-migration/data/contrast-audit.json` | Rebuilds the Bulma 0.9.4 colour variables: Bulma defaults, then the `main.scss` overrides, then Bulma's `findColorInvert` / `findLightColor` / `findDarkColor` re-implemented in JS. Collects hard-coded colours from `.vue` files, then computes WCAG 2.x contrast (sRGB linearisation, alpha composited over the real background) for 119 foreground/background pairs, with pass/fail for AA normal text, AA large text and non-text UI, and a suggested nearest passing colour. If `sass` is resolvable it also compiles `main.scss` and checks 26 selectors against the compiled CSS. Current run: 0 mismatches. |

Re-run from the repo root (Node 20+; the repo uses Node 26):

```sh
node docs/react-migration/tools/component-usage.mjs
node docs/react-migration/tools/contrast-audit.mjs   # reads component-usage.json if present
```

Both outputs are deterministic (no timestamps), so a diff shows real changes. The template scan
is a heuristic. Class names built from variables (`:class="criterionTagType(...)"`) are not
resolved, and the a11y signals over-count in places (a `<label>` next to a Buefy control that sets
its own `aria-label`, for example). Use them as a guide, not as a conformance result. The axe
baseline in [06-a11y-baseline.md](06-a11y-baseline.md) is the measured result.

**Baseline vs current tree.** The counts and line references in this document come from the Vue
source at the branch point (`4be73ec71`). While this was being written, the spike's separate
a11y-fix commits started changing the events views (`events/List.vue`, `events/Apply.vue`,
`events/Single.vue`): search and apply-form labels, `<button>` for the past-events toggle and
organiser actions, `role="heading"` on page titles, and `alertdialog` on the event status
dialogs. The scripts read the working tree, so a re-run after those commits shows slightly
lower numbers (for example 117 instead of 125 click-only `<a>`, and 330 instead of 333
unassociated labels). The patterns described here are still repeated across the other ~130
files.

## Component inventory

### Buefy components (16 types, 493 uses)

| Component | Uses | Files | Observed props / variants |
|---|---:|---:|---|
| `b-table` | 47 | 44 | `data`, `loading` (39), `default-sort` (12), `narrowed` (11), `paginated` + `per-page` (9), `backend-pagination` + `backend-sorting` + `total` (6), `row-class` (6), `selected.sync` (2), `scrollable`, `sticky-header`, `mobile-cards`. Empty state through `<template slot="empty"><empty-table-stub/>` |
| `b-table-column` | 282 | 44 | `sortable` (120), `centered` (76), `numeric` (28), `label`, `field`; content via `v-slot="props"` |
| `b-field` | 46 | 6 | `grouped` (10), `horizontal` (9), `expanded`, `label` (28 without `label-for`) |
| `b-input` | 33 | 5 | `type="textarea"` (13), `expanded` (13) |
| `b-loading` | 32 | 30 | `:active.sync`, `is-full-page` (passed as the string `"false"` in 31 places, which is truthy, e.g. `views/events/Single.vue:328`) |
| `b-tag` | 13 | 2 | `size="is-medium"` (9), `type="is-info"` (4), bound `type` (6, `network/AntennaCriteriaCheck.vue`) |
| `b-autocomplete` | 12 | 10 | `data`, `loading`, `open-on-focus` (9), `field`, `expanded`. Body/member/circle pickers in edit forms and add-member modals |
| `b-select` | 9 | 1 | `network/AntennaCriteriaModal.vue` only |
| `b-datepicker` | 5 | 4 | date of birth / dates in `auth/Register.vue`, `core/bodies/CreateMember.vue`, `core/bodies/Edit.vue`, `core/members/Edit.vue` |
| `b-button` | 4 | 2 | used as icon-only buttons with classes `is-link` / `is-warning` / `is-danger` |
| `b-switch` | 2 | 2 | `rounded` (events list view toggle) |
| `b-message` | 2 | 1 | `type="is-info"`, `type="is-success"` |
| `b-checkbox` | 2 | 1 | `required` |
| `b-radio-button` | 2 | 1 | |
| `b-collapse` | 1 | 1 | card accordion in `core/bodies/ViewBoards.vue` |
| `b-icon` | 1 | 1 | `EmptyTableStub.vue` |

Programmatic Buefy (all go through `this.$buefy` or `this.$root.show*`):

| Call | Calls | Files | Notes |
|---|---:|---:|---|
| `$buefy.dialog.confirm` | 33 | 21 | `type`: is-danger (21), is-warning (5), is-info (2), is-primary (2). `hasIcon`, `confirmText`. The message is an **HTML string** (`'<b>leave</b>'`, `escapeHtml(...)` interpolations) rendered with `v-html` |
| `$buefy.modal.open` | 33 | 18 | opens view-level modal components: PictureModal (4), AddMemberModal (3), ChangeBoardModal (3), ViewParticipantModal (3), Edit*Modal … `trapFocus: true` set explicitly in 4 |
| `$buefy.dialog.prompt` | 7 | 6 | `inputAttrs.type`: number, date, email |
| `$buefy.dialog.alert` | 1 | 1 | calendar event details (`dashboard/Calendar.vue:84`) |
| `$buefy.toast.open` | 1 | 1 | only inside `methods/index.js`, wrapped by the helpers below; default duration 3,000 ms |
| `showError()` | 393 | 109 | → danger toast. By far the most-called UI function in the app |
| `showSuccess()` | 113 | 76 | → success toast (1.9:1, see contrast) |
| `showWarning()` / `showInfo()` / `showDanger()` / `showNotification()` | 17 / 12 / 3 / 4 | 8 / 7 / 1 / 1 | |

### Raw Bulma patterns (2,329 uses)

| Pattern | Uses | Files | Host elements | Modifiers seen |
|---|---:|---:|---|---|
| `field` (+ `control`, `label`, `help`) | 528 | 88 | div | `is-grouped` (91), `is-fullwidth` (46), `has-addons` (44) |
| `button` | 369 | 98 | **a (144)**, button (122), router-link (81), input (18), b-button (4) | `is-primary` (145), `is-fullwidth` (108), `is-danger` (63), `is-small` (50), `is-warning` (40), `is-info` (39), `is-loading` (17), `is-static` (17), `is-link`, `is-success`; typo `is-statuc` (1) |
| `tile` | 333 | 88 | div (275), article (58) | `is-child` (127), `is-parent` (104), `is-ancestor` (87), `is-vertical` (56), widths `is-3/4/6/12`. Used as the page layout grid on almost every view |
| `input` | 199 | 56 | input (169), flat-pickr (30) | none |
| `title` / `subtitle` | 163 | 80 | **div (98)**, p (25), span (8), h4 (29), h2 (2), h3 (1) | `has-text-centered` (33), `is-4` (11) |
| `content` | 141 | 49 | div | mostly wraps `v-html` markdown |
| `icon` | 114 | 24 | span | `is-small` (18), `is-left` (12) |
| `notification` | 109 | 34 | div | `is-info` (58), `is-warning` (24), `is-danger` (15), `is-success` (11) |
| `select` | 78 | 35 | div wrapper | `is-loading` (17), `is-small` (3) |
| `textarea` | 49 | 19 | textarea | |
| `table` | 48 | 27 | table | `is-narrow` (34), `is-fullwidth` (25), `is-bordered` (5), `is-striped` (5); typo `is-stripped` (4) |
| `tag` (+ `tags`) | 38 | 20 | span (29), a (6), router-link (3) | `is-danger` (11), `is-info` (6), `is-primary` (6), `is-small`/`is-medium` (6), `is-light` (4), `is-success`, `is-warning` |
| `delete` | 32 | 30 | button | modal close buttons, most with `aria-label="close"` |
| `modal-card` | 26 | 26 | div | every view-level modal component |
| `checkbox` | 23 | 16 | label (12), **input (11)** | the class is put on the `<input>` in 11 places, where Bulma expects it on the label |
| `media` | 18 | 13 | div | event/member cards |
| `box` / `image` / `card` | 12 / 12 / 11 | 9 / 10 / 6 | | card used in the event lists and `ViewBoards.vue` |
| `columns` | 8 | 8 | div | `is-multiline` (event grid), `is-vcentered` |
| `file` | 7 | 7 | div | `has-name`: all PictureModals and BugReport |
| `message` / `tabs` / `level` / `navbar` / `menu` | 3 / 1 / 1 / 1 / 1 | | | tabs only in `statutory/BoardView.vue:37`; level = Levelbar; navbar/menu = layout |

Not used at all: `dropdown`, `pagination`, `breadcrumb`, `panel`, `progress`, `hero`. Pagination
exists only inside `b-table paginated`. Lists use a **"Load more"** button
(`views/events/List.vue:198`). Helper classes: `has-text-danger` (133, almost all required-field
asterisks), `has-text-centered` (42), `has-text-weight-bold` (30), `has-text-pre-wrap` (13).

### Local components (`components/**`)

| Component | Uses | Files | Role |
|---|---:|---:|---|
| `empty-table-stub` | 48 | 45 | "Nothing here." empty state for `b-table` (grey icon + text) |
| `markdown-tooltip` / `url-tooltip` / `timezone-tooltip` / `tooltip` | 20 / 13 / 8 / 12 | 10 / 3 / 2 / 8 | info-icon tooltips built on `v-tooltip`; content is rendered markdown HTML |
| `password-toggle` | 6 | 3 | password field with show/hide icon button |
| `pie-chart` / `line-chart` | 6 / 2 | 1 | vue-chartjs wrappers registered inside `views/statutory/Stats.vue:109` |
| `event-no-body-notification` / `timezone-notification` | 4 / 3 | 4 / 3 | canned `notification` blocks |
| `select-or-custom` | 2 | 2 | select with a "Custom…" option that reveals a text input |
| `navbar`, `sidebar`, `app-main`, `levelbar`, `footer-bar`, `nprogress-container` | 1 each | | app shell |

### Third-party UI libraries

| Library | Uses | Where |
|---|---|---|
| `@fortawesome/vue-fontawesome` | 141 icons, 40 files | ~80 solid icons registered in `fontawesome.js` |
| `vue-router` | 177 `router-link` | 81 of them styled as `.button` |
| `vue-flatpickr-component` | 30 `<flat-pickr>`, 8 files | `events/Edit`, `statutory/Edit`, `statutory/EditCandidate`, `statutory/EditPlenaryModal`, `statutory/EditPositionModal`, `summeruniversity/Edit`, `core/bodies/AddFeePaymentModal`, `core/bodies/ChangeBoardModal`; date-time with `enableTime` |
| `vue-mapbox` + `mapbox-gl` 0.53 | 24 tags, 7 files | `events/Single`, `events/Edit`, `statutory/Single`, `statutory/Edit`, `summeruniversity/Single`, `summeruniversity/Edit`, `summeruniversity/EditSecond` |
| marked + DOMPurify (`markdown` filter) | 55 calls, 36 files | 54 `v-html` sinks in 33 files |
| moment | imported in 23 files | plus the global `date`/`datetime` filters |
| `v-tooltip` | 10 directive uses | the four tooltip components |
| `vue-multiselect` | 4, 4 files | `core/bodies/List`, `network/BoardListing`, `statutory/Applications`, `statutory/BoardView` (column pickers) |
| `vue-input-tag` | 3, 3 files | `events/Edit`, `statutory/Edit`, `statutory/EditCandidate` |
| `@fullcalendar/vue` 6 | 1 | `dashboard/Calendar.vue` |
| `vue-chartjs` 3 / Chart.js 2 | 8 charts | `statutory/Stats.vue` |
| `nprogress`, `vue2-touch-events` | 1 each | route progress bar; swipe to open the sidebar (`App.vue:2`) |
| `animate.css`, `vue-bulma-collapse`, `vue-infinite-loading` | **0** | declared in `frontend/package.json`, never imported. `Navbar.vue:2` uses `slideInDown`/`slideOutDown` classes that have no CSS behind them |

### Proposed component list

Priority: **P0** = needed for the first migrated slice (events list + filters, event detail,
application form), **P1** = needed for the next route groups (profiles, bodies, statutory,
SU), **P2** = single-use or admin-only. "APG" = WAI-ARIA Authoring Practices pattern. Every
interactive component also gets these shared requirements, which aren't repeated in each row:
visible focus ring (token below, ≥3:1, not only colour change), target ≥24×24 CSS px
(SC 2.5.8) or enough spacing, no focus obscured by the fixed navbar or toasts (SC 2.4.11,
via `scroll-padding-top`), works at 320 px width / 400 % zoom (SC 1.4.10), honours
`prefers-reduced-motion`, and the name is visible text or `aria-label` (SC 2.5.3: label in name).

| Component | Replaces today | Pri | a11y requirements checklist |
|---|---|---|---|
| **AppShell** (skip link, header, nav, `<main>`, footer) | `App.vue`, `AppMain.vue`, `FooterBar.vue` | P0 | "Skip to content" first focusable; landmarks `header`/`nav`/`main`/`footer` (today `<section class="app-main">`); `<html lang="en">` (missing in `public/index.html`); on route change move focus to the page `<h1>` and update `document.title`; announce route changes politely |
| **Navbar** + **UserMenu** | `Navbar.vue` | P0 | burger and sidebar toggles are `<button>` with name and `aria-expanded`/`aria-controls`; user menu = APG Menu Button (Enter/Space/↓ open, arrows, Esc closes and returns focus) instead of hover-only `is-hoverable`; logo link has alt text |
| **SidebarNav** | `Sidebar.vue`, `menu.json` | P0 | `<nav aria-label>`; group toggles are `<button aria-expanded>` (today `<a>` without href, `Sidebar.vue:16`); current page `aria-current="page"`; on mobile, a modal drawer with focus trap and Esc; don't rely on swipe (SC 2.5.1) |
| **PageHeader** (h1 + actions) | `Levelbar.vue` (`h3.subtitle`) and `div.title` | P0 | exactly one `<h1>` per page (there is **no `<h1>` anywhere today**: 6 h2, 1 h3, 29 h4, and 131 `.title`/`.subtitle` on non-headings); heading levels don't skip |
| **Button** | `.button` on a/button/router-link/input, `b-button` | P0 | native `<button type>`; `isPending` keeps the name and sets `aria-busy`/live text (today `is-loading` hides the label); `isDisabled` via `aria-disabled` when it needs to stay focusable; variants: primary, secondary, danger, warning, ghost; sizes sm/md (sm still ≥24 px) |
| **LinkButton** / **Link** | `router-link class="button"` (81), `<a>` | P0 | real `<a href>` for navigation, never `@click` on `<a>`; external `target=_blank` links get a visible or SR "opens in new tab" hint (63 today); underline inline links in body text (SC 1.4.1, link vs text is 1.82:1) |
| **IconButton** | icon-only `<a>`/`b-button` (e.g. `PasswordToggle.vue:17`, `statutory/PositionsList.vue:88`, `network/AntennaCriteriaCheck.vue:128-140`), `.delete` | P0 | required `aria-label` prop (type-enforced); icon `aria-hidden`; optional tooltip shows the same label; 24×24 minimum (Bulma `.delete.is-small` is 16 px) |
| **Field** primitives (Label, Description, FieldError, RequiredMarker) | `.field/.label/.help`, `b-field` | P0 | label associated by id; description and error via `aria-describedby`; `aria-invalid` on error; required = `required`/`aria-required` plus visible "(required)" text, not only a red `*`; errors in text, not only colour |
| **TextField** (+ search, email, password with toggle) | `input.input`, `b-input`, `password-toggle` | P0 | see Field; `type="search"` for the events search with a visible label; password toggle is a `<button aria-pressed>` with a name; correct `autocomplete` tokens (SC 1.3.5) |
| **TextArea** | `textarea.textarea`, `b-input type=textarea` | P0 | see Field; optional character count announced politely |
| **NumberField** | `input type=number` (apply form, fees) | P0 | APG Spinbutton; locale-aware parsing; increment buttons have names |
| **Select** (single, native-like) | `div.select > select`, `b-select` | P0 | APG Select-only Combobox (RAC Select) or native `<select>`; label associated (the apply form's "Body" select isn't, `events/Apply.vue:22`); placeholder option isn't a value |
| **Checkbox** / **CheckboxGroup** | `input.checkbox`, `b-checkbox`, event-type filter | P0 | group in `fieldset`/`legend` (RAC CheckboxGroup); the label wraps or references the input; 24 px hit area; indeterminate supported |
| **Switch** | `b-switch` | P0 | `role="switch"` with label text; state not only by colour (off track is 1.71:1 today) |
| **Card** (EventCard) | `.card`, `.media`, tiles | P0 | card is an `<article>` with a heading; one primary link per card (whole-card click via pseudo-element, not nested interactive elements); images have meaningful or empty alt (22 `<img>` without alt today) |
| **Tag / Badge** | `.tag`, `b-tag`, event-type colour tags | P0 | static text, not interactive (6 `a.tag` should become links styled as tags, or buttons); colour plus text (event type name); token-based colours that meet 4.5:1 |
| **Alert** (inline notification) | `.notification`, `b-message`, `*-notification` components | P0 | `role="status"` for info/success and `role="alert"` only for errors that appear after an action; icon + text label for severity; dismiss button with a name |
| **ErrorSummary** | `notification is-danger` lists in forms (`events/Apply.vue:32`) | P0 | on submit failure, focus the summary (`tabindex=-1`) with a heading; each item links to its field |
| **Spinner / LoadingOverlay** | `b-loading` (32), `is-loading` | P0 | `role="status"` with text ("Loading events…"); overlay blocks interaction with `inert`; restores focus; no spinner-only states longer than needed |
| **LoadMore** (+ result count) | "Load more events" button | P0 | real button; after loading, announce "30 more events loaded" politely and keep focus sensible (on the first new item or the button) |
| **EmptyState** | `empty-table-stub`, "No events found." card | P0 | text, not only an icon; `has-text-grey` today is 4.27:1 → use `--color-text-subtle` |
| **Markdown** renderer | `markdown` filter + 54 `v-html` | P0 | sanitised (keep DOMPurify); render to React elements (e.g. `react-markdown`) so links get the same Link styling and new-tab hint; heading levels in user content shifted under the page heading |
| **Tooltip** / **Toggletip** | `v-tooltip`, `tooltip`/`*-tooltip` | P0 | APG Tooltip only for short plain labels on focusable triggers (shows on focus and hover, Esc dismisses, hoverable per SC 1.4.13); info icons with rich content (markdown, links) become a **Toggletip** (button + non-modal popover); today's info icon isn't focusable at all (`components/Tooltip.vue:2`) |
| **Toast** | `$buefy.toast` via `showError/showSuccess/...` (542 calls) | P0 | polite region for success/info, assertive for errors; **errors don't auto-dismiss** (3 s today fails SC 2.2.1 for slow readers), or persist with a close button; pause on hover/focus; doesn't cover focused content (SC 2.4.11); plain-text content (no HTML strings) |
| **Table** (simple, read-only) | `table.table` (48) | P0 | native `<table>` with `<caption>` or `aria-labelledby`, `<th scope>`; no layout tables (`events/List.vue:133`, `summeruniversity/List.vue:157` → description list) |
| **Map** (+ LocationList) | `MglMap` | P0 (event detail) | the map is supplementary; the location list with names/addresses is the primary content; map container labelled; marker popups keyboard reachable or omitted; `scrollZoom` off (already) |
| **Image** / **Avatar** | `figure.image` | P0 | required `alt` prop (empty allowed explicitly); intrinsic sizes to avoid layout shift |
| **DataTable** (sortable, paginated, selectable, empty, loading) | `b-table` (47) + `b-table-column` (282) | P1 | sort buttons in `<th>` with `aria-sort`; pagination as `<nav aria-label>` with current page; loading announced; row selection with checkboxes (RAC Table / APG Grid only where rows are selectable); horizontal scroll container is focusable and labelled; mobile "card" mode keeps header/value association |
| **Dialog** / **ConfirmDialog** / **PromptDialog** | `$buefy.dialog.confirm/prompt/alert` (41) | P1 | APG Dialog (Modal): `role="dialog"`/`alertdialog` for destructive confirms, `aria-labelledby` title, initial focus on the least destructive action, Esc closes, focus returns to the trigger, background `inert`; message is React content, not HTML strings |
| **Modal** (form modals) | `$buefy.modal.open` + 26 `modal-card` components | P1 | as Dialog; Buefy today sets no `role`/`aria-modal`/label by default and **doesn't return focus** to the opener on close (`node_modules/buefy/src/components/modal/Modal.vue:8-17`) |
| **ComboBox / Autocomplete** (async) | `b-autocomplete` (12) | P1 | APG Combobox with listbox popup; async loading state announced; "no results" announced; selected value shown as text |
| **MultiSelect / TagInput** | `vue-multiselect` (4), `vue-input-tag` (3) | P1 | ComboBox in multi-select mode + TagGroup (APG Grid-like keyboard: arrows between tags, Delete removes); each tag's remove button named "Remove <tag>"; count announced |
| **DatePicker / DateTimePicker / DateRangePicker** | `flat-pickr` (30), `b-datepicker` (5), `dialog.prompt type=date` | P1 | segmented date field typeable without the popup (RAC DateField/TimeField); calendar popup is APG Dialog + Grid; time zone shown in text (today's `timezone-tooltip`); min/max validation errors in text; locale-aware week start (`firstDay: 1` today) |
| **FileUpload** | `.file` (7, PictureModals, BugReport) | P1 | native file input or RAC FileTrigger/DropZone with a visible label; selected file name announced; size/type errors in text (5 MB limit exists server-side) |
| **RadioGroup** / **SegmentedControl** | `b-radio-button` (2) | P1 | `fieldset`/`legend`, APG Radio Group (arrow keys) |
| **Tabs** | `.tabs` (`statutory/BoardView.vue:37`) | P1 | APG Tabs (arrows, Home/End, roving tabindex) or, if each tab is a route, a nav with `aria-current` |
| **Disclosure / Accordion** | `b-collapse` (`core/bodies/ViewBoards.vue:24`), sidebar groups | P1 | `<button aria-expanded aria-controls>` as the header (today an `<a>` without href) |
| **Menu / Dropdown** | navbar dropdown, column pickers | P1 | APG Menu Button / Menu; not hover-only |
| **Pagination** | `b-table paginated` | P1 | `<nav aria-label="Pagination">`, `aria-current="page"`, prev/next named |
| **Calendar** (month + agenda) | FullCalendar | P2 | legend with text; agenda/list view as an accessible alternative; event colour also conveyed by text |
| **Chart** + data table | vue-chartjs Pie/Line | P2 | every chart has a visible or toggleable `<table>` of the same data and a text summary; series not only by colour; ≥3:1 slice colours |
| **ProgressBar** (route) | nprogress | P2 | decorative bar `aria-hidden`; the route announcer does the SR job |

That's 42 rows, but several are thin compositions (Field primitives, LinkButton, LoadMore,
ErrorSummary). 27 are P0, 12 are P1 and 3 are P2.

## Accessibility problems observed in today's markup

These are spot checks with real lines (at `4be73ec71`, see above), not an exhaustive audit. The numbers in brackets come from
`a11ySignals` in `component-usage.json`.

**Forms**

- Labels not associated with controls (333 labels, 309 unlabelled native controls). Events list:
  `<label class="label">Search by name or description</label>` sits next to an input with no id
  (`views/events/List.vue:7-10`). The input's only accessible name is its placeholder, which is
  1.77:1. Apply form: "Body" label (`views/events/Apply.vue:22`) and every dynamic question label
  (`Apply.vue:52-53`) are siblings of their controls. Shared components have the same problem:
  `components/PasswordToggle.vue:3`, `components/SelectOrCustom.vue:3`.
- Groups without `fieldset`/`legend`: the "Event types" checkboxes (`views/events/List.vue:21-25`)
  have a `<label>` as a group heading. The Bulma `.checkbox` class is on the `<input>`
  (`List.vue:23`, 11 places).
- `b-field label="…"` without `label-for` (28, e.g. `core/bodies/ChangeBoardModal.vue:37`). Buefy
  0.9 renders the `<label>` without a `for` unless `label-for` is set
  (`node_modules/buefy/src/components/field/Field.vue:7-11`), so wrapped native inputs and
  `flat-pickr` stay unlabelled.
- Required fields are marked only by a red `*` (`has-text-danger`, 133 uses). There is no visible
  "required" text, and only some controls set `required`.
- Errors are not linked to fields: `<p class="help is-danger">` (`Apply.vue:99`) has no
  `aria-describedby`. The error summary (`Apply.vue:32`) appears without focus or announcement.
- Dead AngularJS attribute: `ng-show="field.required"` (`Apply.vue:127`,
  `summeruniversity/Apply.vue:461`), so the asterisk always shows.

**Buttons, links and keyboard access**

- 125 `<a>` with `@click` and no `href`. These aren't in the tab order and aren't announced as
  buttons. Examples: "Display past events" (`views/events/List.vue:13`), the user menu and logout
  (`components/layout/Navbar.vue:26,33`), sidebar group toggles (`Sidebar.vue:16`), every
  organiser action on the event page (`views/events/Single.vue:51-120`), the upload button in
  picture modals (`views/events/PictureModal.vue:30`, which also sets `:disabled` on an `<a>`,
  where it has no effect).
- Hover-only navigation: the user dropdown is `has-dropdown is-hoverable`
  (`Navbar.vue:23`), so keyboard and touch users can't open it.
- Icon-only controls without names (9): sidebar toggle (`Navbar.vue:4`), the user "burger"
  (`Navbar.vue:10-18`, `role="button"` but the only content is an `aria-hidden` icon, with no
  `aria-expanded`), password show/hide (`PasswordToggle.vue:17`), delete/edit/view icon buttons in
  tables (`statutory/PositionsList.vue:88`, `network/AntennaCriteriaCheck.vue:128,134,140`), and
  the collapse chevron (`core/bodies/ViewBoards.vue:24`).
- The tooltip trigger is a bare SVG icon (`components/Tooltip.vue:2`). It can't be focused, so the
  timezone and markdown help is mouse-only.

**Structure and landmarks**

- No `lang` on `<html>` (`frontend/public/index.html:2`), no skip link, no `<main>`
  (`AppMain.vue:2` is a `<section>`), and the sidebar is an `<aside>` without a nav landmark.
- No `<h1>` anywhere. The route name is an `h3.subtitle` in `Levelbar.vue`, and page titles are
  `div.title` (`Apply.vue:9-11`, `events/Single.vue:131`). 131 `.title`/`.subtitle` on
  non-headings.
- Tile-based layouts (333 `.tile`) make DOM order follow the visual columns, which is mostly fine,
  but the nesting (`tile is-ancestor > tile is-parent > article.tile is-child`) gives no semantics
  and makes headings inconsistent. Layout tables: `views/events/List.vue:133` (icon/value rows).
- Route changes don't move focus or announce anything (vue-router default). The `route-fade`
  transition (`AppMain.vue`, 0.377 s) and sidebar transitions ignore `prefers-reduced-motion`.
  There are no `prefers-reduced-motion` or `:focus-visible` rules anywhere in `frontend/src`.
- `rainbow-text` runs an infinite colour animation on one body name on the dashboard
  (`views/dashboard/index.vue:229`, keyframes in `styles/main.scss`). It has no pause control
  (SC 2.2.2).

**Dynamic content**

- Toasts: Buefy renders `role="alert"` for every toast, including success, and the message goes
  through `v-html` (`node_modules/buefy/src/components/toast/Toast.vue:12,17`). Messages are now
  escaped first (`methods/index.js:8`). All toasts disappear after 3 s (`methods/index.js:9`),
  including error toasts with server messages.
- Dialogs: messages are built as HTML strings with `escapeHtml` interpolations
  (`views/events/Single.vue:451`, `core/bodies/ListFeePaymentsModal.vue:76`) and rendered with
  `v-html`. The calendar dialogs inject rendered markdown and event descriptions
  (`dashboard/Calendar.vue:72-90`). The
  React replacements take React nodes, which removes this class of bug.
- Buefy modals and dialogs trap focus (default `trapFocus: true`) but set no `role="dialog"`,
  `aria-modal` or accessible name unless asked (no `ariaRole` was passed anywhere in the app at the baseline), and
  don't return focus to the element that opened them.
- `b-loading is-full-page="false"` passes the string `"false"` (31 places, e.g.
  `views/events/Single.vue:328`), so these overlays cover the full page. The overlay isn't
  announced.

**Colour-only information**

- Event type shown only by tag/calendar colour in the calendar (`dashboard/Calendar.vue:5-14`
  legend, events coloured by type). The list tags do include the type name.
- Missing profile data shown only in red text (`summeruniversity/Apply.vue:345,351`).
- Links are distinguished from body text only by colour (1.82:1 against body text, needs 3:1 or
  an underline).

## Design tokens

### Palette in use today

Brand colours come from "VI 2.0" in `styles/main.scss:4-23` (light / standard / dark per hue).
Bulma semantic colours map onto them in `main.scss:34-44`:

| Bulma variable | Value | Source | Bulma invert | Invert ratio | White / black text | Better text |
|---|---|---|---|---:|---|---|
| `$primary`, `$link` | #1468c5 | `$blue-standard` | #fff | 5.50 | 5.50 / 3.82 | white |
| `$info` | #4ca0ff | `$cyan: $blue-light` | #fff | **2.70** | 2.70 / 7.78 | black |
| `$success` | #a0c514 | `$green-standard` | #fff | **2.00** | 2.00 / 10.49 | black |
| `$warning` | #fbba00 | `$yellow-standard` | rgba(0,0,0,.7) | 6.51 | 1.73 / 12.13 | black |
| `$danger` | #c51c13 | `$red-standard` | #fff | 5.92 | 5.92 / 3.55 | white |
| `$dark`, `$text` | #434242 | `$grey-dark` | #fff | 10.02 | | |
| `$text-strong` | #363636 | Bulma default | | | 12.17 on white | |
| `$text-light`, `$grey` | #7a7a7a | Bulma default | | | **4.27** on white | |
| `$background` | #c5c6c6 | `$grey-light` (override) | | | default tag/notification bg | |
| `$border` | #dbdbdb | Bulma default | | | **1.38** on white | |

The page background is #fafafa (`App.vue`, `AppMain.vue`), and boxes, cards, navbar and sidebar
are white. The nprogress gradient uses #981991, which looks like a typo for `$purple-standard`
#931991 (`App.vue:88`). Hard-coded colours (37 distinct, all listed with locations in
`contrast-audit.json → hardCodedColours`) are mostly the brand hexes repeated in
`events/List.vue:237-243`, `dashboard/Calendar.vue:46-52` (event types),
`summeruniversity/List.vue:266-269`, and a 25-colour chart palette in `statutory/Stats.vue:157-170`.

**Why mid-tones get white text:** Bulma 0.9 computes luminance with squares instead of the
WCAG 2.4 exponent and switches to dark text only above 0.55. With WCAG luminance, white and black
give equal contrast at about 0.18, so every colour between about 0.18 and 0.55 (here #4ca0ff
0.34, #a0c514 0.47, #c44bc2 0.21, #898989 0.25) gets white text where black would pass.

### Contrast audit results

From `contrast-audit.json` (119 pairs). Requirement: 4.5:1 for normal text, 3:1 for non-text UI.
All text here is under 18.66 px bold / 24 px, so the large-text threshold doesn't apply.

| Pair | Ratio | Req. | Result | Suggested fix |
|---|---:|---|---|---|
| body text #434242 on #fafafa / white | 9.60 / 10.02 | 4.5 | pass | |
| link #1468c5 on white / #fafafa | 5.50 / 5.27 | 4.5 | pass | |
| link vs body text (no underline) | 1.82 | 3 | **fail** | underline links in text |
| `.has-text-grey` / `.menu-label` #7a7a7a on white | 4.27 | 4.5 | **fail** | #6b6b6b (5.33; 5.11 on #fafafa) |
| `.help.is-success` / `.is-warning` / `.is-info` on white | 2.00 / 1.73 / 2.70 | 4.5 | **fail** | use the dark shades below for text |
| `.has-text-danger` / `.help.is-danger` #c51c13 | 5.92 | 4.5 | pass | |
| input placeholder rgba(#363636,.3) | 1.77 | 4.5 | **fail** | #6b6b6b, and never use placeholder as label |
| `.is-primary` / `.is-link` solid (white on #1468c5) | 5.50 | 4.5 | pass | |
| `.is-info` solid (white on #4ca0ff): 39 buttons, 58 notifications, info toasts | 2.70 (toast 2.50) | 4.5 | **fail** | text #1f1f1f (6.11), or bg #0063d1 with white (5.67) |
| `.is-success` solid (white on #a0c514): success notifications/tags | 2.00 | 4.5 | **fail** | text #1f1f1f (8.23), or bg #5c740c (5.31) |
| **success toast** (white on #a0c514 @ 92 % over #fafafa) | **1.90** | 4.5 | **fail** | as above. Affects all 113 `showSuccess` calls |
| `.is-warning` solid (rgba(0,0,0,.7) on #fbba00) | 6.51 | 4.5 | pass | |
| `.is-danger` solid (white on #c51c13), danger toast | 5.92 / 5.38 | 4.5 | pass | |
| `.is-*.is-light` (Bulma dark-on-light): primary/link, success, warning, danger | 4.23, 4.00, 4.49, 4.10 | 4.5 | **fail** (narrowly) | #0f4f99 on #ecf4fd (7.28), #a51710 on #fdedec (6.78) |
| `.is-info.is-light` | 6.26 | 4.5 | pass | |
| default `.tag`/`.notification` (#434242 on #c5c6c6) | 5.85 | 4.5 | pass | |
| tooltip (white on #1468c5) | 5.50 | 4.5 | pass | |
| white on event type: training #A0C514 | 2.00 | 4.5 | **fail** | dark text (8.23) or #5c740c |
| white on event type: NWM #FBBA00 | 1.73 | 4.5 | **fail** | dark text #1f1f1f (9.52) |
| white on event type: thematic #c44bc2 | 4.09 | 4.5 | **fail** | #a8329f (5.80) |
| white on SU / pilot #00BBD8 | 2.31 | 4.5 | **fail** | dark text (7.14) or #00788a (5.18) |
| white on online event #898989 | 3.50 | 4.5 | **fail** | #6b6b6b (5.33) |
| white on conference #931991 / cultural #C51C13 / statutory #1468C5 | 7.53 / 5.92 / 5.50 | 4.5 | pass | |
| "Applications are open!" #647A16 on white | 4.84 | 4.5 | pass | |
| event colours as calendar blocks on white: #A0C514, #FBBA00, #00BBD8 | 2.00 / 1.73 / 2.31 | 3 | **fail** | darker block colours + text label |
| input / select border #dbdbdb on white | 1.38 | 3 | **fail** | #898989 (`$grey-standard`, 3.50) |
| `.input:focus` border #1468c5 | 5.50 | 3 | pass | |
| coloured `.button:focus` ring rgba(#1468c5,.25) | 1.44 | 3 | **fail** | 2 px solid ring, offset 2 px |
| `b-switch` off track #c5c6c6 on white | 1.71 | 3 | **fail** | #898989 + thumb border |
| `b-checkbox` border #7a7a7a | 4.27 | 3 | pass | |
| Stats chart colours on white (25) | 13 below 3:1 | 3 | **fail** | new categorical palette + data table |
| Stats legend cells (text on colour) | 2 of 25 below 4.5 | 4.5 | **fail** | compute text colour, don't hand-pick |

**Colours that must change** (in the new tokens, and ideally in Vue's `main.scss` now):
`$info` text pairing, `$success` text pairing, the `-dark` text shades of the light variants,
`$text-light`/`has-text-grey`, placeholder colour, control borders, the focus ring, the switch
track, and the hard-coded white text on #A0C514, #FBBA00, #c44bc2, #00BBD8 and #898989. The
brand fills themselves can mostly stay if the text on them changes.

Minimal Vue fix (one SCSS block before `@import '~bulma/sass/utilities/_all'`, which works
because Bulma's derived variables are `!default`):

```scss
$info-invert: #1f1f1f;          // 6.1:1 on #4ca0ff instead of 2.7:1
$success-invert: #1f1f1f;       // 8.2:1 on #a0c514 instead of 2.0:1
$text-light: #6b6b6b;           // menu labels, disabled text
$grey: #6b6b6b;                 // .has-text-grey (EmptyTableStub)
$input-border-color: #898989;   // input/select/textarea borders, 3.5:1 (leaves card/table borders alone)
$input-placeholder-color: #6b6b6b;
```

The toast, button, tag and notification success/info colours follow from `$*-invert`.
`.help.is-success`/`.is-info`/`.is-warning` text still uses the fill colour and needs its own
rule (or a darker `$*-dark` used for help text). Event-type tags need their inline
`color: '#FFFFFF'` replaced with a per-type text colour. This is a separate small PR if the team
wants it. It isn't part of the spike's a11y-name fixes.

### Proposed token set

Tokens are defined once (JSON, e.g. W3C Design Tokens format, or plain TS) and emitted as CSS
custom properties on `:root`. Components only use semantic tokens.

**Colour primitives** (brand VI 2.0 plus AA-derived steps):

| Hue | 300 (light) | 500 (standard) | 700 (text-safe on white) | 900 (dark) |
|---|---|---|---|---|
| blue | #4ca0ff | #1468c5 | #0f4f99 | #163e7a |
| red | #ff5543 | #c51c13 | #a51710 | #7a1e16 |
| green | #c2de5d | #a0c514 | #5c740c | #647a16 → use 700 |
| purple | #c44bc2 | #931991 | #a8329f (for white text) | #70086e |
| yellow | #ffdb4c | #fbba00 | #8a6400 | #cf9800 (fill only) |
| cyan (SU) | | #00bbd8 | #00788a | |
| grey | #c5c6c6 | #898989 | #6b6b6b | #434242, #363636, #1f1f1f |

The 700 values are computed to give ≥5:1 with white (`contrast-audit.mjs` suggestions, rounded
for margin). They're proposals for the brand owner to confirm (see open questions).

**Semantic colour tokens** (light theme):

| Token | Value | Notes |
|---|---|---|
| `--color-bg-page` / `--color-bg-surface` / `--color-bg-subtle` | #fafafa / #ffffff / #f5f5f5 | |
| `--color-text` / `--color-text-strong` / `--color-text-subtle` | #434242 / #363636 / #6b6b6b | subtle ≥5:1 on page and surface |
| `--color-text-inverse` | #ffffff | |
| `--color-link` / `--color-link-hover` | #1468c5 / #0f4f99 | underline in running text |
| `--color-border` / `--color-border-control` | #dbdbdb / #898989 | decorative vs control boundary (3.5:1) |
| `--color-focus-ring` | #1468c5 (+ #ffffff inner ring on dark fills) | |
| `--color-action-primary-bg` / `-fg` | #1468c5 / #ffffff | 5.50 |
| `--color-action-danger-bg` / `-fg` | #c51c13 / #ffffff | 5.92 |
| `--color-status-info-bg` / `-fg` / `-border` | #ecf4fd / #0f4f99 / #4ca0ff | |
| `--color-status-success-bg` / `-fg` / `-border` | #f4f9e0 / #4a5c09 / #a0c514 | 6.89 |
| `--color-status-warning-bg` / `-fg` / `-border` | #fff6d6 / #6b4f00 / #fbba00 | 7.07 |
| `--color-status-danger-bg` / `-fg` / `-border` | #fdedec / #a51710 / #c51c13 | 6.78 |
| `--color-event-<type>-bg` / `-fg` | per type, fg chosen by contrast | training #a0c514/#1f1f1f, conference #931991/#fff, NWM #fbba00/#1f1f1f, cultural #c51c13/#fff, thematic #a8329f/#fff, statutory #1468c5/#fff, SU #00bbd8/#1f1f1f, online #6b6b6b/#fff |

Solid-fill toasts and notifications become **tinted** (status bg + fg + left border + icon),
which passes in every severity and doesn't depend on mid-tone brand fills.

**Other tokens**

| Group | Proposal | Today |
|---|---|---|
| Font | `--font-sans: "Open Sans", system-ui, sans-serif`, **self-hosted** woff2 for 400/600/700 | Google Fonts CSS `@import` (`main.scss:2`; GDPR concern under recent EU rulings on remote Google Fonts, and the CSS `@import` is render-blocking) |
| Type scale | 0.875 / 1 / 1.125 / 1.25 / 1.5 / 2 / 2.5 rem; body 1 rem / line-height 1.5; UI minimum 0.875 rem | Bulma 0.75–3 rem; tags and `is-small` at 0.75 rem (12 px) |
| Spacing | 4 px base: 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4 rem | Bulma `$block-spacing` 1.5 rem, ad-hoc inline styles |
| Radius | 2 / 4 / 6 / 9999 px | same (Bulma) |
| Shadow | `--shadow-1` = Bulma `$shadow`; `--shadow-overlay` for popovers/dialogs | Bulma + `rgba(17,17,17,.1)` in Navbar/Sidebar |
| Focus | `outline: 2px solid var(--color-focus-ring); outline-offset: 2px` on `:focus-visible` (RAC `[data-focus-visible]`) | Bulma 0.125 em box-shadow at 25 % alpha (1.44:1) |
| Breakpoints | 768 / 1024 / 1216 / 1408 px (Bulma-compatible, so both apps switch layout together) | Bulma 769/1024/1216/1408 + `App.vue` 768 |
| Z-index | base 0, sticky 100, sidebar 200, navbar 300, dropdown/popover 400, overlay/modal 500, toast 600, tooltip 700 | sidebar 1, navbar 30, modal 40, nprogress 2048, tooltip 10000 |
| Motion | `--duration-fast: 100ms`, `--duration-base: 200ms`, `--easing: ease-out`; all transitions inside `@media (prefers-reduced-motion: no-preference)` | 0.377 s fades/slides, infinite rainbow animation, no reduced-motion handling |
| Layout | `--navbar-height: 52px` and `scroll-padding-top: calc(var(--navbar-height) + 1rem)` on `html` so focused elements aren't hidden under the fixed navbar (SC 2.4.11) | fixed navbar, no scroll padding |

## Headless foundation evaluation

Status checked on 2026-11-21. Version numbers move fast, so treat them as "at least".

| Criterion | React Aria Components | Radix Primitives | Base UI | Ark UI | Headless UI |
|---|---|---|---|---|---|
| Maintainer / licence | Adobe (React Spectrum team), Apache-2.0 | WorkOS, MIT | MUI (team includes ex-Radix and Floating UI authors), MIT | Chakra UI team, MIT | Tailwind Labs, MIT |
| Status | 1.x, frequent releases (v1.20 seen); sub-path imports since v1.17 | maintained but slow; 2025–26 releases mostly fixes (Toast a11y fixes June 2026) | 1.0 stable on 2025-12-11, 1.6 by June 2026 | 5.x (5.38 in Aug 2026), built on Zag.js state machines | 2.x, small and stable |
| APG coverage / a11y quality | Most thorough: tested with screen readers across platforms, handles mobile/touch, virtual focus, live announcements, `inert` handling | good for what it covers | good, modern (Floating UI positioning) | good; generated from state machines | good for what it covers |
| Date/time pickers | **yes**: DateField, TimeField, DatePicker, DateRangePicker, Calendar, RangeCalendar, time zones | no | no (I couldn't confirm any; MUI's pickers are in MUI X, a separate styled product) | yes (DatePicker) | no |
| Combobox / autocomplete / multi | ComboBox, Autocomplete, TagGroup; multi-select support should be checked against the current docs | no combobox | Combobox, Autocomplete (incl. multiple) | Combobox, TagsInput | Combobox (single/multiple) |
| Table | **Table** (sorting, selection, column resizing, virtualisation, drag and drop) | no | no | no | no |
| Toast | yes (check whether still marked beta) | yes | yes | yes | no |
| File upload | FileTrigger, DropZone | no | no | FileUpload | no |
| i18n | locale-aware formatting, RTL, `@internationalized/date` calendars, translated built-in strings | minimal | some | locale props on date/number | minimal |
| Styling freedom | unstyled; render props + `data-*` state attrs (`data-focus-visible`, `data-selected`); official Tailwind plugin | unstyled; `data-state` attrs | unstyled; `data-*` attrs | unstyled; `data-*` attrs | unstyled; built for Tailwind |
| Bundle | largest per component (shared hooks); tree-shakes with sub-path imports. Measure in the PoC, don't assume | small per primitive | small–medium | medium (Zag runtime) | small |
| React 19 | supported | supported | supported | supported | supported |
| Also works for Vue | no | no | no | **yes (Vue 3 only)**, which doesn't help with Vue 2.6 | Vue 3 version exists |

**Recommendation: React Aria Components** as the single headless foundation.

- It's the only one that covers our hard parts in one place: the 35 date fields (flatpickr +
  Buefy datepicker), comboboxes (12), multi-selects/tag inputs (7), data tables (47) and file
  upload. With Base UI or Radix we'd need a second library for dates and would have to build
  table semantics ourselves.
- Its keyboard and screen-reader behaviour follows the APG closely and is tested on mobile. That
  matters because a large part of the AEGEE membership uses MyAEGEE on phones.
- `@internationalized/date` replaces moment for the date logic the pickers need, which removes
  one dependency instead of adding a parallel one.
- Risks: per-component bundle size (measure it in the PoC), a steeper API (collections, render
  props), and Adobe being the main contributor. Mitigation: wrap RAC in our own components, so
  views never import RAC directly, and keep the wrapper props library-neutral.
- For simple read-only tables, use a native `<table>` in our Table component. RAC Table
  (`role="grid"`) is for selectable or interactive tables, because grid keyboard navigation is
  unexpected in a plain data table.

Fallback: if the team rejects RAC, use **Base UI** for primitives plus RAC's date components
(they can be used standalone) and a native-table DataTable.

### Styling approach

| Option | Pros | Cons |
|---|---|---|
| Keep Bulma (upgrade to 1.x) | familiar to current contributors; same look as the Vue app for free | global class soup coupled to markup; Bulma 1.x is a rewrite (CSS variables, Sass modules), so it's a migration in itself; doesn't fit headless components' state attributes; keeps today's contrast defaults |
| **CSS Modules + CSS custom properties** | zero runtime; supported natively by Vite; scoped by default; tokens as CSS vars are shared with the Vue app (Vue can read `var(--color-…)` in its own styles during coexistence); easy to style `[data-focus-visible]` etc.; low lock-in | more files; no utility shortcuts; needs lint rules (stylelint) to stop hard-coded colours |
| Tailwind v4 | fast to write; RAC has an official plugin; tokens via `@theme` become CSS vars too | long class strings in a volunteer codebase with high contributor turnover; another tool to learn; harder to review visual changes |
| vanilla-extract | type-safe tokens, zero runtime | extra build plugin, small community, the steepest learning curve of the four |

**Recommendation: CSS Modules + CSS custom properties.** Token values live in one source and are
emitted as a `tokens.css` that both the React app and (later) the Vue app import, so the two look
the same while they coexist. Add stylelint rules banning raw hex values outside the token file.
Tailwind v4 is the acceptable alternative if [02-target-stack.md](02-target-stack.md) settles on
it for other reasons. The token layer stays the same either way.

## Third-party widget plan

| Widget (today) | Where | a11y assessment | React options | Recommendation | Required accessible fallback |
|---|---|---|---|---|---|
| **FullCalendar 6** (`@fullcalendar/vue`, daygrid) | `dashboard/Calendar.vue` | month grid is hard to use with a screen reader; colours carry the event type; event details open a Buefy dialog with HTML | `@fullcalendar/react` (v7 has a native React implementation and improved ARIA, per its changelog; v7's a11y docs say "work in progress", so verify); RAC Calendar + our own month view; agenda list only | Keep FullCalendar (React package, same config) for the month view; add a `listMonth`/agenda view as the default on small screens and as a toggle; use the new event-type tokens | an agenda list (date, title, type as text, link) carrying the same information; legend uses text |
| **Mapbox** (`vue-mapbox` 0.4 + `mapbox-gl` 0.53, 2019) | 7 files (event/statutory/SU single + edit) | canvas map with no text equivalent; red markers; popups mouse-oriented; edit views place markers by clicking | `react-map-gl` (supports MapLibre and Mapbox), MapLibre GL JS (BSD-3) directly | Move to **MapLibre GL + `react-map-gl`**. mapbox-gl ≥2 has a proprietary licence and per-load billing, and 0.53 is unmaintained. Keep the tile provider configurable | a location list (name, address, link to an external map) always rendered as text; in edit forms, an address/coordinates text input next to click-to-place |
| **Chart.js 2** + vue-chartjs 3 | `statutory/Stats.vue` (6 pie, 2 line) | canvas with no text alternative; 13 of 25 palette colours below 3:1 on white; legend disabled on several charts | Chart.js 4 + `react-chartjs-2`; Recharts / visx (SVG, can be made focusable) | Chart.js 4 + `react-chartjs-2` (smallest change; admin-only page, P2), new categorical palette checked at 3:1 | every chart has a "Show data as table" `<table>` and a one-line text summary; series not only by colour |
| **flatpickr** (`vue-flatpickr-component`) / Buefy datepicker / `dialog.prompt type=date` | 8 + 4 + 1 files | flatpickr's calendar popup is mouse-first; the input is a plain text input with no format hint; time zone only in a tooltip | RAC DatePicker/DateRangePicker/TimeField; native `<input type="date/datetime-local">` | RAC date components (typed segments, keyboard calendar grid, locale-aware); value type from `@internationalized/date` (`ZonedDateTime` for event times) | typing a date without opening the popup; time zone shown as text next to the field |
| **vue-multiselect** | 4 files (column pickers) | custom listbox with partial ARIA in 2.x; hard to judge without testing | RAC ComboBox/Select (multi) + TagGroup; Base UI Combobox | RAC-based MultiSelect | selected items listed as text with named remove buttons |
| **vue-input-tag** | 3 files (event/statutory edit) | plain input + spans; remove "×" without names; no announcements | RAC TagGroup + TextField; Ark TagsInput | RAC-based TagInput | as above; comma-separated text entry also accepted |
| **vue-infinite-loading** | not used | n/a | n/a | delete the dependency; keep the explicit "Load more" button pattern | n/a |
| **v-tooltip** (popper.js 1) | 4 tooltip components | trigger not focusable; rich HTML content in a tooltip | RAC Tooltip (plain labels) + Popover/"Toggletip" (rich content) | Tooltip for icon-button labels only; Toggletip for info icons | content reachable by keyboard and touch |
| **nprogress** | route changes | decorative; no SR feedback | keep `nprogress` (framework-agnostic) or a 20-line CSS bar | keep or replace freely; `aria-hidden` | route announcer (polite live region with the new page title) |
| **vue2-touch-events** | `App.vue` swipe to open/close the sidebar | path gesture, but the toggle button exists, so SC 2.5.1 is met if the button works by keyboard | none needed | drop; the drawer opens from its button | n/a |
| **animate.css** | not imported (dead classes in `Navbar.vue:2`) | n/a | CSS transitions with reduced-motion guard | delete | n/a |
| **moment** | 23 files + global filters | n/a (formatting) | `Intl.DateTimeFormat`, `@internationalized/date`, date-fns; Temporal where supported (check browser support before relying on it) | `@internationalized/date` + `Intl` (comes with RAC) | dates rendered in `<time datetime>` |
| **Font Awesome** (vue-fontawesome 2 / FA 5) | 141 icons | icons have no `aria-hidden`/titles consistently | `@fortawesome/react-fontawesome`, or an SVG icon set (Lucide etc.) | Icon component that is `aria-hidden` by default and requires a label when standalone | n/a |
| **marked + DOMPurify** | 55 calls | output injected with `v-html`; user headings can break the outline | `react-markdown` + `rehype-sanitize`, or keep marked + DOMPurify into a sanitised container | Markdown component (see list) | n/a |

## Open questions and decisions for the team

1. **Brand source of truth.** Is the "VI 2.0" palette in `main.scss` still AEGEE's current visual
   identity, and who can approve the AA-adjusted 700 shades and dark text on green/yellow/cyan
   fills? Is there an official brand guide (fonts, logo usage, event-type colours)?
2. **Event-type colours.** Should event types keep colour coding at all, and can the
   SU/statutory/online colours be adjusted? (Five of eight fail with white text.)
3. **Vue colour fix now or later?** Apply the `main.scss` invert/border/grey overrides in a
   separate PR now (cheap, visible improvement, keeps both apps consistent), or freeze Vue
   visually and only fix in React?
4. **Dark mode.** Not needed for parity. Should semantic tokens be designed for it from day one
   (cheap with CSS variables, doubles the contrast audit)?
5. **Design files.** Do we want a Figma (or Paper) library mirroring the components and tokens,
   and who maintains it? Without a designer, code-first (docs site as the source of truth) is
   more realistic.
6. **Docs/workbench.** Storybook (largest ecosystem, a11y addon, interaction tests) vs Ladle
   (Vite-native, lighter). Recommendation: Storybook if we also want visual regression via its
   test runner, Ladle if we only need a component playground.
7. **Visual regression.** Playwright screenshot assertions on Storybook stories or on the mocked
   suite (fits [04-test-strategy.md](04-test-strategy.md)) vs a hosted service (Chromatic,
   Argos). Decide before the library grows past the P0 set.
8. **Icons.** Stay on Font Awesome 5 (free solid) or move to a tree-shakable SVG set?
9. **Fonts.** OK to self-host Open Sans (and drop the Google Fonts request) in both apps?
10. **Tables on mobile.** Buefy's mobile "cards" mode is on by default for `b-table`. Do we keep
    a card layout for tables on small screens, or use horizontal scroll with a sticky first
    column?
11. **Library location and packaging.** A folder inside `frontend-react/src/ui` first, extracted
    into a workspace package (`packages/ui`) once a second consumer exists?
12. **a11y gate.** The charter says report-only for axe. When the library exists, do component
    stories get a blocking axe check (cheap, and catches regressions at the source)?
