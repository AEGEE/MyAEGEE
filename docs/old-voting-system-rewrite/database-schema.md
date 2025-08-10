# Database Schema Documentation

## Overview

This document describes the database schema for the AEGEE Online Membership System, designed to support a microservices architecture with two core services: **Proposals** and **Votings**. The schema supports complex voting algorithms, proposal management, and attendance tracking while maintaining data consistency across service boundaries.

## Microservices Data Architecture

### Service Data Boundaries

#### Proposals Service Data

- Proposal lifecycle and workflow management
- CIA document versions and history
- Amendment tracking and management
- Proposal-related audit logs

#### Votings Service Data

#### Core Service Data

- User authentication and profiles
- Role and permission management
- System configuration and settings
- Cross-service audit logs and correlation

#### Statutory Service Data

- Agora creation and lifecycle management
- Delegate registration and management
- Real-time attendance tracking
- Quorum calculations and session management

#### Proposals Service Data

- Proposal lifecycle and workflow management
- CIA document versions and history
- Amendment tracking and management
- Proposal-related comments and discussions

#### Votings Service Data

- Voting sessions and ballot management
- Vote allocation and distribution
- Voting results and calculations
- Vote redistribution events

#### Frontend Service Data

- User interface preferences and settings
- Session state and real-time connection management
- Cached data for performance optimization
- Offline data synchronization

### Data Consistency Strategy

- **Shared Reference Data**: Core service owns canonical user and system data, replicated to other services
- **Event-Driven Synchronization**: Changes propagated via event bus with eventual consistency
- **Strong Consistency**: Critical operations use saga patterns for cross-service transactions
- **Real-time Requirements**: WebSocket connections managed by Frontend service for immediate updates
- **Audit Trail**: Centralized logging in Core service with correlation IDs across all services

## Schema Design Principles

### Normalization Strategy

- **3rd Normal Form**: Most tables follow 3NF to reduce redundancy
- **Denormalization**: Strategic denormalization for performance in reporting tables
- **Historical Data**: Separate tables for historical tracking and auditing
- **Referential Integrity**: Foreign key constraints maintain data consistency

### Naming Conventions

- **Tables**: Lowercase with underscores (e.g., `proposals`, `vote_ballots`)
- **Primary Keys**: `id` for single column primary keys
- **Foreign Keys**: `[table_name]_id` format
- **Timestamps**: `created_at`, `updated_at`, `deleted_at` for soft deletes
- **Boolean Fields**: `is_[attribute]` or `has_[attribute]` format

## Microservices Data Distribution

### Proposals Service Tables

Tables primarily owned and managed by the Proposals microservice:

- `proposals` - Proposal lifecycle and content
- `proposal_amendments` - Amendment tracking
- `proposal_comments` - Discussion and feedback
- `proposal_state_log` - State transition audit
- `cia_versions` - Constitutional document versions
- `cia_changes` - Change tracking for CIA updates

### Votings Service Tables

Tables primarily owned and managed by the Votings microservice:

- `voting_sessions` - Voting session management
- `vote_ballots` - Individual vote records
- `vote_results` - Calculated voting outcomes
- `delegate_attendance` - Real-time attendance tracking
- `vote_distributions` - Antenna vote allocations
- `delegate_departures` - Departure tracking for redistribution

### Shared Reference Tables

Tables accessed by both services (read-mostly with event-driven updates):

- `users` - User authentication and profiles
- `delegates` - Delegate registration (referenced by both services)
- `antennae` - Antenna information
- `agorae` - Meeting/event information
- `config` - System configuration

### Cross-Service Synchronization

**Event-Driven Updates:**

- Proposal state changes trigger voting session creation
- Voting completion triggers proposal status updates
- Delegate status changes affect both proposal access and voting rights

**Data Consistency Patterns:**

- **Eventual Consistency**: For non-critical cross-service updates
- **Strong Consistency**: For critical operations using saga patterns
- **Read Replicas**: For shared reference data accessed frequently

## Core Tables

### 1. Configuration and System Management

#### `config`

System configuration parameters and settings.

```sql
CREATE TABLE config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(64) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(32),
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_config_category ON config(category);
CREATE INDEX idx_config_system ON config(is_system);
```

**Key Data:**

- Database version tracking
- System-wide settings
- Feature flags
- Integration configurations

#### `agorae`

Master table for statutory meetings.

```sql
CREATE TABLE agorae (
    id INT PRIMARY KEY AUTO_INCREMENT,
    agora_name VARCHAR(128) NOT NULL,
    agora_type ENUM('Spring', 'Autumn', 'Extraordinary') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location VARCHAR(128),
    cia_version VARCHAR(16) NOT NULL,
    status ENUM('Planning', 'Registration', 'Active', 'Closed', 'Archived') DEFAULT 'Planning',
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_agorae_status ON agorae(status);
CREATE INDEX idx_agorae_active ON agorae(is_active);
CREATE INDEX idx_agorae_dates ON agorae(start_date, end_date);
```

**Business Rules:**

- Only one Agora can be active at a time
- CIA version must be specified for constitutional tracking
- Status progression: Planning → Registration → Active → Closed → Archived

### 2. User and Delegate Management

#### `users`

Base user authentication and profile information.

```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(64) NOT NULL,
    last_name VARCHAR(64) NOT NULL,
    phone VARCHAR(32),
    language_preference VARCHAR(8) DEFAULT 'en',
    timezone VARCHAR(64) DEFAULT 'UTC',
    last_login_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_last_login ON users(last_login_at);
```

#### `delegates`

Delegate registration and voting rights for specific Agorae.

```sql
CREATE TABLE delegates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    agora_id INT NOT NULL,
    body_code VARCHAR(16) NOT NULL,
    body_name VARCHAR(128) NOT NULL,
    delegate_type ENUM('Full', 'Envoy', 'Observer') NOT NULL,
    rank_in_delegation TINYINT NOT NULL DEFAULT 1,
    registration_status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    voting_rights BOOLEAN DEFAULT TRUE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    approved_by INT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (agora_id) REFERENCES agorae(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),

    UNIQUE KEY unique_delegate_per_agora (user_id, agora_id),
    UNIQUE KEY unique_rank_per_body (agora_id, body_code, rank_in_delegation)
);

-- Indexes
CREATE INDEX idx_delegates_agora ON delegates(agora_id);
CREATE INDEX idx_delegates_body ON delegates(body_code);
CREATE INDEX idx_delegates_status ON delegates(registration_status);
CREATE INDEX idx_delegates_voting ON delegates(voting_rights);
```

**Business Rules:**

- Maximum 3 delegates per body (rank 1, 2, 3)
- Only approved delegates can vote
- Delegate type determines voting rights allocation

#### `bodies_historic`

Historical body information and vote allocations.

```sql
CREATE TABLE bodies_historic (
    id INT PRIMARY KEY AUTO_INCREMENT,
    agora_id INT NOT NULL,
    body_code VARCHAR(16) NOT NULL,
    body_name VARCHAR(128) NOT NULL,
    body_category ENUM('Locals', 'Contacts', 'AEGEE-WGs', 'Other') NOT NULL,
    membership_count INT DEFAULT 0,
    vote_allocation INT DEFAULT 0,
    is_voting_body BOOLEAN DEFAULT FALSE,
    valid_from DATE NOT NULL,
    valid_until DATE NULL,

    FOREIGN KEY (agora_id) REFERENCES agorae(id),

    UNIQUE KEY unique_body_per_agora (agora_id, body_code)
);

-- Indexes
CREATE INDEX idx_bodies_category ON bodies_historic(body_category);
CREATE INDEX idx_bodies_voting ON bodies_historic(is_voting_body);
CREATE INDEX idx_bodies_allocation ON bodies_historic(vote_allocation);
```

### 3. Proposal Management

#### `proposals`

Master table for constitutional amendment proposals.

```sql
CREATE TABLE proposals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    agora_id INT NOT NULL,
    proposal_number VARCHAR(16),
    title VARCHAR(255) NOT NULL,
    submitter_user_id INT NOT NULL,
    submitter_body_code VARCHAR(16) NOT NULL,
    motivation TEXT NOT NULL,
    financial_impact TEXT,
    implementation_timeline TEXT,
    status ENUM('Draft', 'Submitted', 'Under_Review', 'Feedback_Pending',
                'Approved', 'Rejected', 'Voting', 'Adopted', 'Implemented', 'Withdrawn')
           DEFAULT 'Draft',
    jc_recommendation ENUM('Support', 'Oppose', 'Neutral', 'Conditional') NULL,
    jc_comment TEXT,
    submission_deadline TIMESTAMP NOT NULL,
    submitted_at TIMESTAMP NULL,
    voting_threshold ENUM('Simple_Majority', 'Two_Thirds', 'Absolute_Majority')
                    DEFAULT 'Two_Thirds',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (agora_id) REFERENCES agorae(id),
    FOREIGN KEY (submitter_user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_proposals_agora ON proposals(agora_id);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_submitter ON proposals(submitter_user_id);
CREATE INDEX idx_proposals_deadline ON proposals(submission_deadline);
```

#### `proposal_supporters`

Many-to-many relationship for proposal supporters.

```sql
CREATE TABLE proposal_supporters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    proposal_id INT NOT NULL,
    body_code VARCHAR(16) NOT NULL,
    body_name VARCHAR(128) NOT NULL,
    support_type ENUM('Primary', 'Secondary') DEFAULT 'Secondary',
    supported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,

    UNIQUE KEY unique_support (proposal_id, body_code)
);

-- Indexes
CREATE INDEX idx_supporters_proposal ON proposal_supporters(proposal_id);
CREATE INDEX idx_supporters_body ON proposal_supporters(body_code);
```

#### `proposals_sentences`

Specific constitutional changes proposed.

```sql
CREATE TABLE proposals_sentences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    proposal_id INT NOT NULL,
    change_type ENUM('Add', 'Modify', 'Delete', 'Move') NOT NULL,
    cia_article INT,
    cia_paragraph INT,
    cia_sentence INT,
    current_text TEXT,
    proposed_text TEXT,
    rationale TEXT,
    order_sequence INT DEFAULT 1,
    jc_comment TEXT,

    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_sentences_proposal ON proposals_sentences(proposal_id);
CREATE INDEX idx_sentences_cia_ref ON proposals_sentences(cia_article, cia_paragraph, cia_sentence);
CREATE INDEX idx_sentences_change_type ON proposals_sentences(change_type);
```

### 4. CIA Document Management

#### `cia`

Current Constitutional and Internal Affairs document.

```sql
CREATE TABLE cia (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    article INT NOT NULL,
    article_title VARCHAR(255),
    paragraph INT NOT NULL,
    sentence INT NOT NULL,
    sentence_text TEXT NOT NULL,
    order_within_article INT,
    order_within_paragraph INT,
    agora_id_start INT NOT NULL,
    agora_id_end INT NULL,
    last_modified_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (agora_id_start) REFERENCES agorae(id),
    FOREIGN KEY (agora_id_end) REFERENCES agorae(id),
    FOREIGN KEY (last_modified_by) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_cia_article_para_sent ON cia(article, paragraph, sentence);
CREATE INDEX idx_cia_current ON cia(agora_id_end); -- NULL for current version
CREATE INDEX idx_cia_category ON cia(category);
```

#### `cia_history`

Complete history of CIA changes.

```sql
CREATE TABLE cia_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cia_id INT,
    change_type ENUM('Created', 'Modified', 'Deleted', 'Moved') NOT NULL,
    proposal_id INT,
    old_text TEXT,
    new_text TEXT,
    changed_by INT NOT NULL,
    change_reason TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cia_id) REFERENCES cia(id),
    FOREIGN KEY (proposal_id) REFERENCES proposals(id),
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_cia_history_cia ON cia_history(cia_id);
CREATE INDEX idx_cia_history_proposal ON cia_history(proposal_id);
CREATE INDEX idx_cia_history_date ON cia_history(changed_at);
```

### 5. Voting System

#### `votes`

Main voting table for proposal votes.

```sql
CREATE TABLE votes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    agora_id INT NOT NULL,
    proposal_id INT NOT NULL,
    delegate_id INT NOT NULL,
    vote_choice ENUM('For', 'Against', 'Abstain') NOT NULL,
    vote_weight INT DEFAULT 1,
    cast_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,

    FOREIGN KEY (agora_id) REFERENCES agorae(id),
    FOREIGN KEY (proposal_id) REFERENCES proposals(id),
    FOREIGN KEY (delegate_id) REFERENCES delegates(id),

    UNIQUE KEY unique_delegate_proposal_vote (delegate_id, proposal_id)
);

-- Indexes
CREATE INDEX idx_votes_proposal ON votes(proposal_id);
CREATE INDEX idx_votes_delegate ON votes(delegate_id);
CREATE INDEX idx_votes_cast_time ON votes(cast_at);
CREATE INDEX idx_votes_choice ON votes(vote_choice);
```

#### `vote_allocations`

Real-time tracking of vote distribution among antenna delegates.

```sql
CREATE TABLE vote_allocations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    agora_id INT NOT NULL,
    body_code VARCHAR(16) NOT NULL,
    delegate_id INT NOT NULL,
    total_body_votes INT NOT NULL,
    allocated_votes INT NOT NULL,
    used_votes INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (agora_id) REFERENCES agorae(id),
    FOREIGN KEY (delegate_id) REFERENCES delegates(id),

    UNIQUE KEY unique_delegate_allocation (agora_id, delegate_id)
);

-- Indexes
CREATE INDEX idx_allocations_body ON vote_allocations(body_code);
CREATE INDEX idx_allocations_delegate ON vote_allocations(delegate_id);
```

#### `elections`

Election management for leadership positions.

```sql
CREATE TABLE elections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    agora_id INT NOT NULL,
    position_title VARCHAR(128) NOT NULL,
    position_description TEXT,
    voting_method ENUM('Simple', 'Ranked', 'Approval') DEFAULT 'Simple',
    max_winners INT DEFAULT 1,
    nomination_deadline TIMESTAMP NOT NULL,
    voting_start TIMESTAMP NOT NULL,
    voting_end TIMESTAMP NOT NULL,
    status ENUM('Setup', 'Nominations', 'Voting', 'Completed') DEFAULT 'Setup',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (agora_id) REFERENCES agorae(id)
);

-- Indexes
CREATE INDEX idx_elections_agora ON elections(agora_id);
CREATE INDEX idx_elections_status ON elections(status);
CREATE INDEX idx_elections_voting_period ON elections(voting_start, voting_end);
```

#### `candidates`

Candidates for election positions.

```sql
CREATE TABLE candidates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    election_id INT NOT NULL,
    user_id INT NOT NULL,
    candidate_statement TEXT,
    cv_document_path VARCHAR(255),
    photo_path VARCHAR(255),
    nomination_seconded_by TEXT, -- JSON array of supporter user_ids
    status ENUM('Nominated', 'Approved', 'Withdrawn', 'Disqualified') DEFAULT 'Nominated',
    nominated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (election_id) REFERENCES elections(id),
    FOREIGN KEY (user_id) REFERENCES users(id),

    UNIQUE KEY unique_candidate_per_election (election_id, user_id)
);

-- Indexes
CREATE INDEX idx_candidates_election ON candidates(election_id);
CREATE INDEX idx_candidates_user ON candidates(user_id);
CREATE INDEX idx_candidates_status ON candidates(status);
```

### 6. Attendance Tracking

#### `plenaries`

Plenary session management.

```sql
CREATE TABLE plenaries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    agora_id INT NOT NULL,
    number VARCHAR(16) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    planned_start TIMESTAMP NOT NULL,
    planned_end TIMESTAMP NOT NULL,
    actual_start TIMESTAMP NULL,
    actual_end TIMESTAMP NULL,
    status ENUM('Scheduled', 'Active', 'Paused', 'Completed') DEFAULT 'Scheduled',
    requires_attendance BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (agora_id) REFERENCES agorae(id),

    UNIQUE KEY unique_plenary_number (agora_id, number)
);

-- Indexes
CREATE INDEX idx_plenaries_agora ON plenaries(agora_id);
CREATE INDEX idx_plenaries_status ON plenaries(status);
CREATE INDEX idx_plenaries_time ON plenaries(planned_start, planned_end);
```

#### `attendance_records`

Individual attendance tracking records.

```sql
CREATE TABLE attendance_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    delegate_id INT NOT NULL,
    plenary_id INT NOT NULL,
    check_in_time TIMESTAMP NULL,
    check_out_time TIMESTAMP NULL,
    attendance_method ENUM('Barcode', 'Manual', 'QR_Code', 'NFC') DEFAULT 'Manual',
    scanner_station VARCHAR(64),
    is_present BOOLEAN DEFAULT FALSE,
    notes TEXT,
    recorded_by INT,

    FOREIGN KEY (delegate_id) REFERENCES delegates(id),
    FOREIGN KEY (plenary_id) REFERENCES plenaries(id),
    FOREIGN KEY (recorded_by) REFERENCES users(id),

    UNIQUE KEY unique_delegate_plenary (delegate_id, plenary_id)
);

-- Indexes
CREATE INDEX idx_attendance_delegate ON attendance_records(delegate_id);
CREATE INDEX idx_attendance_plenary ON attendance_records(plenary_id);
CREATE INDEX idx_attendance_present ON attendance_records(is_present);
CREATE INDEX idx_attendance_time ON attendance_records(check_in_time, check_out_time);
```

### 7. Audit and Logging

#### `audit_log`

Comprehensive audit trail for all system actions.

```sql
CREATE TABLE audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(128),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
```

#### `system_logs`

System-level logging for technical operations.

```sql
CREATE TABLE system_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    level ENUM('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL') NOT NULL,
    component VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    context JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_logs_level ON system_logs(level),
    INDEX idx_logs_component ON system_logs(component),
    INDEX idx_logs_timestamp ON system_logs(timestamp)
);
```

## Advanced Schema Features

### 1. Soft Deletes

Many tables include `deleted_at` timestamp for soft delete functionality:

```sql
-- Add to relevant tables
ALTER TABLE proposals ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE delegates ADD COLUMN deleted_at TIMESTAMP NULL;

-- Query with soft delete awareness
SELECT * FROM proposals WHERE deleted_at IS NULL;
```

### 2. Full-Text Search

Enable full-text search on key content fields:

```sql
-- Proposal search
ALTER TABLE proposals ADD FULLTEXT(title, motivation);

-- CIA search
ALTER TABLE cia ADD FULLTEXT(sentence_text, article_title);

-- Search queries
SELECT * FROM proposals
WHERE MATCH(title, motivation) AGAINST('democracy constitution' IN NATURAL LANGUAGE MODE);
```

### 3. Partitioning Strategy

Partition large tables by Agora for better performance:

```sql
-- Partition votes table by agora_id
ALTER TABLE votes PARTITION BY HASH(agora_id) PARTITIONS 10;

-- Partition audit_log by timestamp
ALTER TABLE audit_log PARTITION BY RANGE (YEAR(timestamp)) (
    PARTITION p2020 VALUES LESS THAN (2021),
    PARTITION p2021 VALUES LESS THAN (2022),
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

### 4. Database Views

Create views for common complex queries:

```sql
-- Current CIA view (only active sentences)
CREATE VIEW current_cia AS
SELECT article, paragraph, sentence, sentence_text, article_title
FROM cia
WHERE agora_id_end IS NULL
ORDER BY article, paragraph, sentence;

-- Delegate voting summary
CREATE VIEW delegate_voting_summary AS
SELECT
    d.id,
    d.user_id,
    d.body_code,
    d.body_name,
    va.total_body_votes,
    va.allocated_votes,
    va.used_votes,
    (va.allocated_votes - va.used_votes) AS remaining_votes
FROM delegates d
JOIN vote_allocations va ON d.id = va.delegate_id
WHERE d.voting_rights = TRUE;
```

## Data Integrity Constraints

### 1. Check Constraints

Enforce business rules at database level:

```sql
-- Vote allocation constraints
ALTER TABLE vote_allocations
ADD CONSTRAINT chk_vote_usage
CHECK (used_votes <= allocated_votes);

-- Delegate rank constraints
ALTER TABLE delegates
ADD CONSTRAINT chk_delegate_rank
CHECK (rank_in_delegation BETWEEN 1 AND 3);

-- Plenary timing constraints
ALTER TABLE plenaries
ADD CONSTRAINT chk_plenary_timing
CHECK (planned_start < planned_end);
```

### 2. Triggers

Automate data consistency with triggers:

```sql
-- Update vote usage when votes are cast
DELIMITER //
CREATE TRIGGER update_vote_allocation
AFTER INSERT ON votes
FOR EACH ROW
BEGIN
    UPDATE vote_allocations
    SET used_votes = used_votes + NEW.vote_weight
    WHERE delegate_id = NEW.delegate_id;
END//
DELIMITER ;

-- Maintain CIA history on changes
DELIMITER //
CREATE TRIGGER cia_history_trigger
AFTER UPDATE ON cia
FOR EACH ROW
BEGIN
    INSERT INTO cia_history (
        cia_id, change_type, old_text, new_text,
        changed_by, changed_at
    ) VALUES (
        NEW.id, 'Modified', OLD.sentence_text, NEW.sentence_text,
        NEW.last_modified_by, NOW()
    );
END//
DELIMITER ;
```

## Performance Optimization

### 1. Index Strategy

```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_votes_proposal_choice ON votes(proposal_id, vote_choice);
CREATE INDEX idx_delegates_agora_body ON delegates(agora_id, body_code);
CREATE INDEX idx_attendance_plenary_present ON attendance_records(plenary_id, is_present);

-- Covering indexes for report queries
CREATE INDEX idx_proposals_status_agora_covering
ON proposals(status, agora_id)
INCLUDE (title, submitted_at, jc_recommendation);
```

### 2. Query Optimization

```sql
-- Optimized vote counting query
SELECT
    vote_choice,
    SUM(vote_weight) as total_votes
FROM votes
WHERE proposal_id = ?
GROUP BY vote_choice;

-- Efficient quorum check
SELECT COUNT(DISTINCT ar.delegate_id) as present_delegates
FROM attendance_records ar
JOIN delegates d ON ar.delegate_id = d.id
WHERE ar.plenary_id = ?
  AND ar.is_present = TRUE
  AND d.voting_rights = TRUE;
```

## Backup and Recovery Strategy

### 1. Backup Requirements

- **Real-time Replication**: Master-slave setup for disaster recovery
- **Point-in-time Recovery**: Transaction log backups every 15 minutes
- **Full Backups**: Daily full database backups
- **Retention**: 30 days online, 1 year archived

### 2. Critical Data Protection

- **Vote Data**: Encrypted backups with multiple geographic locations
- **Audit Logs**: Immutable storage with cryptographic verification
- **Personal Data**: GDPR-compliant backup and deletion procedures

This comprehensive database schema provides the foundation for a robust, scalable, and compliant voting system while maintaining data integrity and supporting complex business requirements.
