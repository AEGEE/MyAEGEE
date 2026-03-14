# Statutory Test Coverage Plan

**Status:** Draft
**Owner:** `statutory` contributors
**Last updated:** 2026-03-06

## 1. Objective

Improve statutory coverage around the most fragile operational and business-critical paths while documenting bugs and future cleanup work.

## 2. Current State

- strong API-style suite breadth under `statutory/test/api`;
- limited direct helper/model/cron unit coverage;
- several controller-heavy modules still have low effective coverage;
- frontend statutory views currently have no unit tests.

## 3. Highest-Risk Areas

- cron scheduling and cancellation;
- plenary exports and attendance calculations;
- application identity and incoming-only views;
- memberslist uploads and route fallbacks;
- dynamic frontend field generation in admin tables.

## 4. Execution Streams

- Stream 1: cron and scheduling contracts
- Stream 2: plenary/application model and export correctness
- Stream 3: incoming/memberslist edge cases
- Stream 4: frontend statutory edit/board/upload regressions

## 5. Completion Criteria

- high-risk cron/export/application paths have direct regression tests;
- the most likely frontend regressions have component coverage;
- follow-up bugs and improvements are documented in `statutory/STATUTORY_FOLLOWUPS.md`.
