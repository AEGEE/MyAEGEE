# Accessibility checks

`e2e/ui/a11y/pages.spec.ts` runs [axe](https://github.com/dequelabs/axe-core) on every page of
the frontend, with the WCAG 2.2 A and AA rules, on the desktop viewport. One test per route, with
the generic answers of `e2e/ui/support/smoke/`.

The pages are not clean yet, so the run is a ratchet: a page may not get worse than it is today,
and once it gets better it has to stay better.

## The baseline

`e2e/ui/support/a11y/<area>.json` says, per route, how many elements break each rule:

```json
{
  "oms.events.list.all": { "color-contrast": 6, "image-alt": 3 },
  "oms.events.participants": { "color-contrast": 1 }
}
```

A route that isn't in its area's file has no violations and must keep none.

| When | What happens |
|---|---|
| A page breaks a rule on more elements than its baseline allows, or a rule that isn't in its baseline | Its axe test fails, and says which rule, how many elements and where |
| A page breaks a rule on fewer elements than its baseline says | The tests pass, but CI's `frontend-coverage` job fails until the baseline is lowered, so the improvement can't be lost again |
| A route is removed or moves to another area | CI fails until its entry is removed (the lowering command does that) |

## After fixing markup

```sh
cd e2e
npx playwright test -c playwright.ui.config.ts --grep @a11y   # writes a11y-results/vue/<route>.json
npm run a11y:lower                                            # lowers the baseline to what the pages have now
git add ui/support/a11y
```

`a11y:lower` never raises a count. If a page got worse it says so and fails: fix the page. When
a higher count really is right (new content with a known problem that is fixed later), raise it by
hand in the JSON file, and say why in the pull request.

`node scripts/a11y-baseline.ts check-stale` is the check CI runs.

## Upgrading axe

`@axe-core/playwright` and `axe-core` are pinned to exact versions, because a new version finds
other things. Upgrade them in a pull request of their own, and write the baseline anew in it:

```sh
npx playwright test -c playwright.ui.config.ts --grep @a11y   # fails where the new version finds more
node scripts/a11y-baseline.ts lower --reset                   # the one command that may raise counts
```

## What axe doesn't find

- Automated rules find roughly a third of accessibility problems. axe can't judge keyboard use,
  focus order, where focus goes after a dialog closes, whether a name makes sense, reading order,
  or whether an error is announced usefully. Those need a person with a keyboard and a screen
  reader, and specs that use the keyboard (Tab, Escape, arrow keys) for interactive components.
- The generic answers leave states unrendered: validation errors, filled tables on most pages,
  open dialogs. The counts are lower bounds for such pages. A behavioural spec can run axe at
  such a moment itself (`new AxeBuilder({ page })`).
- The newer WCAG 2.2 AA criteria (focus not obscured, dragging, target size, accessible
  authentication) are hardly covered by axe rules.
- The run is desktop only.

What the role-based specs add: a control that can't be found by role and name fails its spec, so
names, roles and labels of everything a spec touches are checked there.
