# Core Test Coverage Plan

**Status:** Draft
**Owner:** `core` contributors
**Last updated:** 2026-03-06

## 1. Objective

Add targeted coverage to high-risk areas in `core` that are underprotected despite the package’s broad existing test suite.

## 2. Current State

- large and mature API suite;
- smaller model/unit suite;
- shallow metrics and token-lifecycle coverage;
- likely hidden bugs in body campaigns, cron, and image handling.

## 3. Highest-Risk Areas

- body-campaign linkage;
- refresh-token renewal semantics;
- permission graph logic;
- image upload/remove cleanup;
- cron stop behavior and metrics label contracts.

## 4. Execution Streams

- Stream 1: body-campaign and permission-manager contracts
- Stream 2: renew/logout lifecycle coverage
- Stream 3: image cleanup and cron stop behavior
- Stream 4: metrics content and label assertions

## 5. Completion Criteria

- likely body-campaign bug is protected by tests;
- token renewal and permission graph behavior are covered more directly;
- upload, cron, and metrics behaviors have explicit regression assertions;
- follow-ups are documented in `core/CORE_FOLLOWUPS.md`.
