# Frontend Test Coverage Plan

**Status:** Draft
**Owner:** `frontend` contributors
**Last updated:** 2026-03-06

## 1. Objective

Expand the new frontend unit-test harness beyond discounts so the highest-risk view logic across packages can be covered consistently.

## 2. Current State

- Jest + Vue 2 unit harness now exists and is wired into CI;
- current coverage is limited to discounts views;
- many package views still mix transport, permissions, and UI state directly in components.

## 3. Priority Areas

- events list/apply/edit flows;
- summeruniversity list/apply/edit flows;
- statutory edit/board/upload flows;
- network board listing and antenna criteria flows;
- auth interceptor and shared loading/error behavior.

## 4. Completion Criteria

- shared harness patterns are reusable across packages;
- at least one high-value view flow per major package has component tests;
- major frontend follow-ups are documented in `frontend/FRONTEND_FOLLOWUPS.md`.
