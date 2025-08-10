# Agora Management System

## Overview

The Agora Management System is the foundational module that handles the creation, configuration, and lifecycle management of AEGEE statutory meetings (Agorae). An Agora represents a formal meeting where constitutional amendments, elections, and policy decisions are made.

## Core Concepts

### What is an Agora?

An Agora is a statutory meeting of AEGEE-Europe that typically occurs twice yearly (Spring and Autumn). During these meetings:

- Constitutional amendments are proposed and voted upon
- Leadership elections take place
- Policy decisions are made
- Network-wide discussions occur

### Agora Lifecycle

1. **Planning Phase**: Initial setup and configuration
2. **Registration Phase**: Delegate registration and proposal submission
3. **Active Phase**: Live meeting with voting and discussions
4. **Archival Phase**: Results publication and historical record

## Detailed Functionality

### 1. Agora Creation and Setup

#### Purpose

Create new statutory meetings with proper configuration for voting, proposals, and attendance tracking.

#### Key Features

- **Basic Information Setup**

  - Agora name and identification
  - Date and location information
  - Meeting type (Spring/Autumn Agora, Extraordinary)
  - CIA version management

- **Voting Configuration**

  - Set voting thresholds (simple majority, 2/3 majority, etc.)
  - Configure proposal deadlines
  - Set delegate registration deadlines
  - Define voting periods for different proposal types

- **System Parameters**
  - Database schema version compatibility
  - Access control settings
  - Integration configurations

#### Technical Implementation

- **Primary Files**: `agora_setup.php`, `create_agora.php`
- **Database Tables**: `agorae`, `config`
- **Models**: `Agorae.php`
- **Services**: `AgoraeService.php`

#### Business Rules

- Only JC members can create new Agorae
- Each Agora must have a unique identifier
- CIA version must be specified and consistent
- Default voting rules can be customized per Agora

### 2. Agora Activation/Deactivation

#### Purpose

Control which Agora is currently active for proposal submission and voting.

#### Key Features

- **Activation Control**

  - Set an Agora as active for proposal submissions
  - Enable/disable voting capabilities
  - Control public visibility of proceedings

- **State Management**

  - Multiple Agorae can exist simultaneously
  - Only one can be active for voting at a time
  - Historical Agorae remain accessible for reference

- **Safety Mechanisms**
  - Prevent accidental deactivation during active voting
  - Confirmation dialogs for state changes
  - Audit trail of activation changes

#### Technical Implementation

- **Primary Files**: `agora_activate.php`, `admin_main.php`
- **Database Fields**: Status flags in `agorae` table
- **Access Control**: Admin and JC_MANAGE permissions required

#### Business Rules

- Only administrators can activate/deactivate Agorae
- Deactivation during active voting requires special confirmation
- All proposals must be finalized before deactivation

### 3. Agora Selection and Navigation

#### Purpose

Allow users to navigate between different Agorae and access historical data.

#### Key Features

- **Agora Listing**

  - Display all accessible Agorae
  - Show current status (active, archived, upcoming)
  - Provide quick access to key functions

- **Context Switching**

  - Switch between different Agorae
  - Maintain user permissions across switches
  - Preserve session state appropriately

- **Historical Access**
  - Access archived voting results
  - Review historical proposals and amendments
  - Generate reports across multiple Agorae

#### Technical Implementation

- **Primary Files**: `agora_select.php`, `agorae_list.php`
- **Session Management**: `$_SESSION['JC_MODULE']['AgoraId']`
- **Database Queries**: Filter all data by selected Agora ID

#### Business Rules

- Users can only access Agorae they have permissions for
- Historical data is read-only for non-administrators
- Current context is maintained throughout session

### 4. CIA Version Management

#### Purpose

Manage the Constitutional and Internal Affairs document versions across different Agorae.

#### Key Features

- **Version Tracking**

  - Each Agora operates on a specific CIA version
  - Track changes between versions
  - Maintain compatibility with historical proposals

- **Amendment Integration**

  - Automatically update CIA based on accepted proposals
  - Generate new versions after each Agora
  - Maintain historical reference to previous versions

- **Conflict Resolution**
  - Detect conflicting amendments
  - Provide mechanisms for resolving conflicts
  - Ensure constitutional consistency

#### Technical Implementation

- **Database Tables**: `CIA`, `CIA_history`
- **Version Fields**: `cia_version_name`, `agora_id_start`, `agora_id_end`
- **Services**: `CIAService.php`

#### Business Rules

- Each amendment must reference specific CIA articles/paragraphs
- CIA versions are immutable once finalized
- New versions are created only after Agora completion

## Integration Points

### With Proposal System

- Proposals must be linked to active Agora
- Proposal deadlines are Agora-specific
- Voting periods are configured per Agora

### With Delegate Management

- Delegate registration is Agora-specific
- Voting rights are calculated per Agora
- Attendance tracking is scoped to current Agora

### With Voting System

- All votes are associated with specific Agora
- Voting rules can vary between Agorae
- Results are permanently linked to Agora context

## User Interface Components

### 1. Agora Dashboard

- Quick overview of current Agora status
- Key metrics (registered delegates, pending proposals, etc.)
- Quick access to main functions

### 2. Configuration Interface

- Form-based setup for new Agorae
- Advanced configuration options
- Validation and error handling

### 3. Navigation Elements

- Agora selector dropdown
- Status indicators
- Quick action buttons

## Security Considerations

### Access Control

- **Admin Level**: Full Agora management capabilities
- **JC_MANAGE**: Limited administrative functions
- **Delegates**: Read-only access to current Agora information
- **Public**: Access to published results only

### Data Integrity

- Prevent modification of finalized Agorae
- Audit trail for all administrative actions
- Backup mechanisms before major changes

### Concurrency Control

- Handle multiple administrators working simultaneously
- Prevent conflicting state changes
- Lock mechanisms for critical operations

## Reporting and Analytics

### Agora Statistics

- Participation rates across different Agorae
- Proposal success rates
- Voting pattern analysis
- Historical trend reporting

### Compliance Reporting

- Constitutional amendment tracking
- Quorum compliance reports
- Voting procedure adherence

## Error Handling and Recovery

### Common Error Scenarios

- Invalid Agora configurations
- Conflicting state changes
- Database consistency issues
- Session timeout during operations

### Recovery Mechanisms

- Automatic rollback of failed operations
- Manual recovery procedures for administrators
- Data consistency checks and repairs

## Performance Considerations

### Optimization Strategies

- Cache frequently accessed Agora information
- Optimize queries for historical data access
- Implement pagination for large Agora lists

### Scalability Requirements

- Handle multiple concurrent Agorae
- Support large numbers of historical records
- Efficient switching between Agora contexts

## Future Enhancements

### Planned Features

- **Multi-language Support**: Interface localization for different AEGEE regions
- **Mobile Optimization**: Responsive design for mobile device access
- **Real-time Updates**: Live status updates for Agora state changes
- **Integration APIs**: RESTful APIs for external system integration

### Advanced Capabilities

- **Automated Scheduling**: Template-based Agora creation
- **Workflow Automation**: Automated state transitions based on rules
- **Advanced Reporting**: Business intelligence dashboards
- **Audit Compliance**: Enhanced audit trails for regulatory compliance

This comprehensive Agora Management System forms the foundation for all other OMS functionalities and ensures proper governance and control over AEGEE's statutory meeting processes.
