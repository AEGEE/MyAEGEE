# Network Test Coverage Plan

**Status:** Draft
**Owner:** `network` contributors
**Last updated:** 2026-03-06

## 1. Objective

Strengthen network coverage around tenancy boundaries, permission edges, and operational reliability.

## 2. Current State

- good API coverage for core CRUD flows;
- limited unit coverage outside cron and new-board email;
- frontend network views have no unit tests.

## 3. Highest-Risk Areas

- board route/body mismatch;
- board fetch scoping;
- netcom delete not-found handling;
- antenna-criteria permission edge cases;
- frontend loading/error cleanup and partial data assumptions.

## 4. Execution Streams

- Stream 1: board tenancy and permission contracts
- Stream 2: netcom and antenna-criteria error paths
- Stream 3: cron and metrics contracts
- Stream 4: frontend board listing and antenna-criteria regression specs

## 5. Completion Criteria

- tenancy and not-found behavior are explicitly covered;
- cron/metrics behavior has direct assertions;
- highest-value frontend network screens have initial component coverage;
- follow-ups are documented in `network/NETWORK_FOLLOWUPS.md`.
