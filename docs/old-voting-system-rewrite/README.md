# AEGEE Online Membership System (OMS) - Documentation

## Overview

The AEGEE Online Membership System is a comprehensive platform designed for managing statutory meetings (Agorae) of AEGEE-Europe. This system handles digital voting, proposal management, attendance tracking, and various administrative functions during European conferences.

## System Purpose

AEGEE (Association des États Généraux des Étudiants de l'Europe) is a student organization across Europe that holds statutory meetings called "Agorae" where important decisions are made regarding the organization's constitution, leadership elections, and policy decisions. This system digitizes and automates the complex voting and administrative processes that occur during these meetings.

## Documentation Structure

- [System Architecture](./architecture.md) - Technical architecture and design patterns
- [Microservices Architecture](./microservices-architecture.md) - 5-microservice design with user stories
- [Core Functionalities](./functionalities/) - Detailed documentation of each module
- [User Stories](./user-stories/) - User stories organized by role and functionality
- [Database Schema](./database-schema.md) - Database structure and relationships
- [Business Rules](./business-rules.md) - Voting algorithms and organizational rules
- [Security Model](./security.md) - Authentication, authorization, and data protection
- [Integration Points](./integrations.md) - External system connections
- [Migration Guide](./migration-guide.md) - Guidelines for system rewrite
- [SME Questionnaire](./sme-questionnaire.md) - Business requirements questionnaire for subject matter experts
- [Lead Developer Questionnaire](./lead-developer-questionnaire.md) - Technical architecture questionnaire for lead developers

## Key Stakeholders

### Primary Users

- **Delegates**: Representatives from local AEGEE antennae who vote on proposals
- **JC Members**: Judicial Committee members who manage proposals and voting
- **Chairs**: Meeting facilitators who manage sessions and voting
- **Administrators**: Technical administrators who configure the system

### Secondary Users

- **Observers**: Non-voting participants who can view proceedings
- **Scanners**: Staff members who manage attendance through barcode scanning
- **Public**: General public viewing published results

## Core Concepts

### Agora

A statutory meeting of AEGEE-Europe where important organizational decisions are made. Each Agora has:

- Constitutional amendment proposals
- Leadership elections
- Policy discussions and votes
- Multiple plenary sessions

### Delegate

An elected representative from a local AEGEE antenna who has voting rights during the Agora. Delegates are responsible for:

- Representing their local antenna's interests
- Casting votes according to their antenna's allocation
- Participating in discussions and debates

### Proposal

A formal request to amend the AEGEE constitution (CIA - Constitutional and Internal Affairs). Proposals go through:

- Submission and initial review
- JC evaluation and feedback
- Plenary discussion
- Formal voting process

### Vote Distribution

AEGEE uses a complex vote distribution system where:

- Each antenna receives votes based on membership size
- Votes must be distributed equally among an antenna's delegates
- If equal distribution isn't possible, difference cannot exceed one vote
- The antenna decides how to distribute votes among their delegates

## Quick Start Guide

For detailed implementation guides, see the individual documentation files in this repository.

## Technology Context

### Current Stack (Legacy)

- **Backend**: PHP 5.x with procedural and basic OOP
- **Database**: MySQL with direct queries
- **Frontend**: Server-rendered HTML with basic JavaScript
- **Architecture**: Monolithic with DAO/Service patterns

### Recommended Modern Stack

- **Backend**: Modern framework (Node.js, Python Django/FastAPI, or PHP Laravel)
- **Database**: PostgreSQL with ORM
- **Frontend**: Modern SPA framework (React, Vue, or Angular)
- **Architecture**: Microservices or modular monolith
- **Real-time**: WebSocket support for live voting and attendance
- **Infrastructure**: Containerized with Docker, CI/CD pipeline

## License

Original system: GNU General Public License v3.0
Documentation: Available for organizational use and system rewrite purposes.
