# 06 · Accessibility baseline (axe)

A measured starting point for the WCAG 2.2 AA goal. `e2e/ui/a11y/baseline.spec.ts` opens every
route of the app with the generic mock data (members-only pages as a superadmin, public pages
anonymously) and runs axe-core 4.14 with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and
`wcag22aa` rules. It records, never fails. Results per page are in `e2e/a11y-results/`
(CI artifact), and the summary is in [`data/a11y-baseline.json`](data/a11y-baseline.json).

```sh
cd e2e
npx playwright test -c playwright.ui.config.ts --grep @a11y
node scripts/a11y-summary.ts      # writes data/a11y-baseline.json and prints the tables
```

## Results

| | Pages | Pages with violations | Elements with violations | Critical | Serious |
|---|---:|---:|---:|---:|---:|
| Vue app | 113 | **113** | **1,713** | 373 | 1,340 |
| React PoC (events list ×3, event page, application) | 5 | **0** | **0** | 0 | 0 |
| The same 5 pages in Vue | 5 | 5 | 9–19 per page | | |

### Vue, by rule

| Rule | Impact | WCAG | Pages | Elements |
|---|---|---|---:|---:|
| `color-contrast` (text below 4.5:1 / 3:1) | serious | 1.4.3 | 113 | 1,089 |
| `link-name` (links without text) | serious | 2.4.4, 4.1.2 | 113 | 131 |
| `image-alt` (images without `alt`) | critical | 1.1.1 | 113 | 127 |
| `html-has-lang` (no `lang` on `<html>`) | serious | 3.1.1 | 113 | 113 |
| `label` (form fields without a label) | critical | 4.1.2 | 33 | 173 |
| `select-name` (selects without a name) | critical | 4.1.2 | 27 | 49 |
| `aria-required-parent` | critical | 1.3.1 | 1 | 22 |
| `aria-input-field-name` | serious | 4.1.2 | 2 | 2 |
| `aria-required-attr` | critical | 4.1.2 | 2 | 2 |
| `link-in-text-block` | serious | 1.4.1 | 1 | 2 |
| `role-img-alt` | serious | 1.1.1 | 1 | 2 |
| `scrollable-region-focusable` | serious | 2.1.1 | 1 | 1 |

The worst pages are the editors: `events/Edit` (88 elements on create, 67 on edit),
`summeruniversity/Edit` (63 / 49), `resources` (41) and the SU second-step editor (40).

## What the numbers mean

- **Four problems are on every page, and they come from the shell**: no `lang` on `<html>`, the
  logo link has no name and its image no `alt`, and the sidebar's category labels fail contrast.
  Fixing those in `public/index.html`, `Navbar.vue` and `Sidebar.vue` removes at least 340 of the
  1,713 elements (113 each for `lang`, the logo link and the logo image, plus the sidebar's
  contrast failures). That's cheap and worth doing in Vue now; it doesn't depend on the migration.
- **Contrast is the bulk** (1,089 elements). As the [design system
  inventory](05-design-system-inventory.md#design-tokens) shows, the cause is Bulma's
  `findColorInvert` giving white text on mid-tone colours (`is-info`, `is-success`) plus grey
  helper text. A handful of Sass variable overrides in `main.scss` would fix most of it.
- **Unlabelled fields** (222 elements on 33 pages) are the main barrier for screen reader users,
  and they're concentrated in the forms that move last (editors, statutory).
- **The React pages are clean by construction**: AA tokens, native controls with labels, landmarks,
  a skip link, named images, and `jsx-a11y` strict in lint.

## Limits: what axe doesn't tell us

- axe finds roughly a third of WCAG problems. It can't judge keyboard flows, focus order, focus
  return after dialogs, meaningful names, reading order, motion, or whether errors are announced
  usefully. The component library needs **manual keyboard and screen reader checks** (NVDA +
  Firefox, VoiceOver + Safari) per component, plus **APG keyboard tests in Playwright** (Tab,
  Escape, arrow keys) for interactive components.
- The generic mock data leaves some states unrendered (validation errors, populated tables on
  most pages, modals). Counts for those pages are lower bounds. Behavioural specs that open
  dialogs or show errors could run axe at those moments too (`new AxeBuilder({ page })` inside
  the spec).
- WCAG 2.2's new AA criteria (2.4.11 focus not obscured, 2.5.7 dragging, 2.5.8 target size,
  3.3.8 accessible authentication) are hardly covered by axe rules. They're in the per-component
  checklists in [05](05-design-system-inventory.md#proposed-component-list) instead.

## Proposed use

1. **Now**: keep it report-only (agreed in the charter). CI stores the per-page results and the
   summary for every run, so the trend is visible.
2. **Per migrated route group**: the React pages must stay at 0 (enforce it then: a failing
   expectation for `@migrated` pages only).
3. **Vue quick wins** (shell, contrast variables) can come before the migration, and would lower
   the baseline for every page that hasn't moved yet.
