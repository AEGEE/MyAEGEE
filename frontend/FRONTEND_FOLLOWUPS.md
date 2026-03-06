# Frontend Follow-Ups

**Status:** Living document
**Last updated:** 2026-03-06

## Bugs

- `frontend/src/views/discounts/DiscountsList.vue:88` - loading state is not cleared on fetch failure.
- `frontend/src/views/discounts/List.vue:93` - loading state is not cleared on fetch failure.
- `frontend/src/views/discounts/CategoriesList.vue:92` - loading state is not cleared on fetch failure.
- `frontend/src/views/events/Edit.vue:978` - loading an existing event overwrites `starts` with `ends`.
- `frontend/src/views/summeruniversity/Edit.vue:1130` - loading an existing SU overwrites `starts` with `ends`.
- `frontend/src/views/statutory/Edit.vue:790` - loading an existing statutory event overwrites `starts` with `ends`.
- `frontend/src/views/summeruniversity/List.vue:110` - Apply button depends on `can.apply`, but that flag is never populated in the component.
- `frontend/src/views/statutory/BoardView.vue:376` - likely loading-state typo sets `loading` instead of `isLoading`.

## Fragile Behavior

- `frontend/src/views/discounts/AddCodes.vue:76` - several error handlers dereference `err.response.status` without guarding missing `response`, so network failures can throw inside catch blocks.
- `frontend/src/views/discounts/Edit.vue:111` - same unguarded `err.response` assumption during save.
- `frontend/src/views/discounts/Edit.vue:130` - same unguarded `err.response` assumption during load.
- `frontend/src/views/discounts/CategoryEdit.vue:124` - same unguarded `err.response` assumption during save.
- `frontend/src/views/discounts/CategoryEdit.vue:143` - same unguarded `err.response` assumption during load.
- `frontend/src/views/events/Apply.vue:299` - redirects use nonexistent route name `oms.events.list`.
- `frontend/src/views/summeruniversity/Apply.vue:641` - redirects use nonexistent route name `oms.summeruniversity.list`.
- `frontend/src/views/summeruniversity/Edit.vue:1164` - redirects use nonexistent route name `oms.summeruniversity.list`.
- `frontend/src/views/statutory/UploadMembersList.vue:420` - redirects use nonexistent route name `oms.statutory.single`.

## Improvement Opportunities

- Add route-level permission handling for discounts admin pages instead of only hiding admin controls in the UI.
- Normalize error handling so all view catches tolerate network-level failures and report consistent messages.
- Generalize the Vue unit-test harness created for discounts into shared frontend test utilities for events, SU, and statutory.
- Surface nested backend validation errors in form UIs instead of only top-level generic messages.

## Future Test Additions

- route fallback tests for events, summeruniversity, and statutory views with bad route names;
- failure-state tests that assert loading flags are always cleared;
- deeper component tests for permissions, cancel tokens, and dashboard aggregations across events-like packages.
