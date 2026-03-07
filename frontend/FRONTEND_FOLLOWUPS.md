# Frontend Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-07

## Bugs

- `frontend/src/views/statutory/BoardView.vue:376` - likely loading-state typo sets `loading` instead of `isLoading`.

## Fragile Behavior

- none currently tracked

## Improvement Opportunities

- Add route-level permission handling for discounts admin pages instead of only hiding admin controls in the UI.
- Normalize error handling so all view catches tolerate network-level failures and report consistent messages.
- Surface nested backend validation errors in form UIs instead of only top-level generic messages.

## Future Test Additions

- deeper component tests for permissions, cancel tokens, and dashboard aggregations across events-like packages.
