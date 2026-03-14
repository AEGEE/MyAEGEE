# Mailer Test Coverage Plan

**Status:** Draft
**Owner:** `mailer` contributors
**Last updated:** 2026-03-06

## 1. Objective

Strengthen mailer coverage around template rendering, delivery edge cases, and operational correctness.

## 2. Current State

- controller tests cover many happy-path template sends;
- little direct unit coverage for rendering and fan-out logic in `Omsmailer.Page`;
- fragile healthcheck/logging/runtime behavior is not covered.

## 3. Highest-Risk Areas

- template rendering with missing nested params;
- recipient/body fan-out edge cases;
- healthcheck metadata correctness;
- raw request logging and delivery failure visibility.

## 4. Execution Streams

- Stream 1: `Omsmailer.Page` unit tests
- Stream 2: healthcheck and fallback response contracts
- Stream 3: fragile template regression tests
- Stream 4: operational follow-up documentation and logging review

## 5. Completion Criteria

- render/fan-out logic has direct unit coverage;
- healthcheck/error payloads are asserted;
- fragile template assumptions are documented or covered;
- follow-ups are documented in `mailer/MAILER_FOLLOWUPS.md`.
