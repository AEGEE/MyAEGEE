# Proposal Management System

## Overview

The Proposal Management System is the core component for handling Constitutional and Internal Affairs (CIA) amendments in AEGEE. This system manages the complete lifecycle of proposals from initial submission through final adoption, including complex workflow management, version control, and integration with the voting system.

## Core Concepts

### What is a Proposal?

A proposal in AEGEE context is a formal request to modify the organization's Constitutional and Internal Affairs (CIA) document. Proposals can:

- Add new articles, paragraphs, or sentences
- Modify existing constitutional text
- Remove outdated provisions
- Reorganize constitutional structure

### Proposal Types

#### 1. Constitutional Amendments

- **Scope**: Changes to fundamental organizational structure
- **Voting Threshold**: Typically requires 2/3 majority
- **Review Process**: Extensive JC review and legal analysis
- **Impact**: Affects core organizational governance

#### 2. Internal Affairs Amendments

- **Scope**: Operational procedures and regulations
- **Voting Threshold**: Simple majority often sufficient
- **Review Process**: Standard JC review
- **Impact**: Affects day-to-day operations

#### 3. Emergency Proposals

- **Scope**: Urgent matters requiring immediate attention
- **Process**: Expedited review and voting
- **Restrictions**: Limited scope and special approval required
- **Timeline**: Shortened deadlines for submission and review

### CIA Integration

The CIA (Constitutional and Internal Affairs) serves as the foundation document that proposals modify. The system maintains:

- **Version Control**: Track changes across different Agora versions
- **Article Hierarchy**: Articles → Paragraphs → Sentences
- **Cross-references**: Maintain links between related provisions
- **Change History**: Complete audit trail of all modifications

## Detailed Functionality

### 1. Proposal Submission Workflow

#### Purpose

Provide a structured, multi-step process for submitting complete and valid proposals.

#### Multi-Step Submission Process

##### Step 1: Basic Information (`create_proposal1.php`)

- **Proposal Metadata**:

  - Title (clear, descriptive, max 255 characters)
  - Submitting antenna/body identification
  - Primary contact information
  - Proposal category classification

- **Proposer Information**:

  - List of supporting antennae (minimum requirements)
  - Individual proposer names and positions
  - Contact information for follow-up

- **Submission Validation**:
  - Verify submitting body eligibility
  - Check deadline compliance
  - Validate required supporting signatures

##### Step 2: Motivation and Context (`create_proposal2.php`)

- **Motivation Statement**:

  - Clear explanation of why change is needed
  - Current problems with existing CIA text
  - Expected benefits of proposed changes
  - Alternative approaches considered

- **Impact Assessment**:

  - Financial implications
  - Organizational impact analysis
  - Implementation timeline
  - Resource requirements

- **Supporting Documentation**:
  - Legal analysis (if applicable)
  - Comparative analysis with other organizations
  - Expert opinions or research
  - Historical context

##### Step 3: Technical Changes (`create_proposal3.php`)

- **CIA Modification Specification**:

  - Identify specific articles/paragraphs/sentences to modify
  - Provide exact text changes (additions, deletions, modifications)
  - Use standardized formatting for legal text
  - Ensure proper numbering and cross-references

- **Change Visualization**:
  - Side-by-side comparison of current vs. proposed text
  - Highlight additions, deletions, and modifications
  - Generate change summary for review
  - Validate legal text formatting

##### Step 4: Review and Finalization (`create_proposal4.php`, `create_proposal5.php`)

- **Proposal Review**:

  - Complete proposal preview
  - Validation checklist verification
  - Final opportunity for corrections
  - Confirmation of submission

- **Submission Process**:
  - Generate unique proposal identifier
  - Create immutable submission record
  - Send confirmation notifications
  - Begin JC review process

#### Technical Implementation

- **Primary Files**: `create_proposal0.php` through `create_proposal5.php`
- **Database Tables**: `proposals`, `proposals_sentences`, `proposals_management`
- **Models**: `Proposals.php`, `Proposals_sentences.php`
- **Services**: `ProposalsService.php`, `Proposals_sentencesService.php`

#### Business Rules

- Proposals must be submitted by eligible AEGEE bodies
- Minimum number of supporting antennae required
- Submission deadlines strictly enforced
- CIA references must be valid and current
- All required fields must be completed before submission

### 2. JC Review and Management

#### Purpose

Provide Judicial Committee members with tools to review, analyze, and manage submitted proposals.

#### Review Workflow

##### Initial Review Phase

- **Completeness Check**:

  - Verify all required information provided
  - Validate CIA references and legal formatting
  - Check compliance with submission requirements
  - Identify missing or unclear information

- **Legal Analysis**:

  - Review proposed changes for legal consistency
  - Identify potential conflicts with existing CIA text
  - Assess constitutional validity
  - Check for unintended consequences

- **Technical Review**:
  - Validate formatting and numbering
  - Ensure proper cross-references
  - Check for grammatical and language issues
  - Verify translation accuracy (if applicable)

##### JC Feedback Process

- **Feedback Categories**:

  - Legal concerns requiring modification
  - Technical formatting issues
  - Suggestions for improvement
  - Requests for additional information

- **Feedback Management**:
  - Structured feedback forms
  - Priority classification (blocking vs. advisory)
  - Response tracking and follow-up
  - Proposer notification system

##### Approval Process

- **JC Decision Options**:

  - Accept as submitted
  - Accept with modifications
  - Conditional acceptance (pending changes)
  - Reject with reasons

- **Decision Documentation**:
  - Detailed reasoning for decisions
  - Recommendations for improvement
  - Timeline for resubmission (if applicable)
  - Publication of JC opinions

#### Technical Implementation

- **Primary Files**: `review_proposal2.php`, `review_proposal3.php`
- **Database Management**: `proposals_management` table
- **Workflow Services**: JC-specific workflow management
- **Notification System**: Automated status updates

#### Business Rules

- Only JC members can perform official reviews
- All feedback must be documented
- Decisions require JC consensus or voting
- Timeline requirements must be maintained

### 3. Amendment and Conflict Management

#### Purpose

Handle modifications to proposals and resolve conflicts between competing proposals.

#### Amendment System

##### Proposal Amendments

- **Amendment Types**:

  - Minor corrections (spelling, grammar)
  - Technical adjustments (formatting, references)
  - Substantive changes (content modifications)
  - Scope adjustments (expand or narrow proposal)

- **Amendment Process**:
  - Amendment submission workflow
  - JC review of amendments
  - Integration with original proposal
  - Notification to interested parties

##### Conflict Detection and Resolution

- **Automatic Conflict Detection**:

  - Identify overlapping CIA sections
  - Detect contradictory proposed changes
  - Flag potentially conflicting provisions
  - Generate conflict reports

- **Resolution Mechanisms**:
  - Proposer negotiation facilitation
  - JC mediation services
  - Alternative proposal development
  - Withdrawal and resubmission options

#### Technical Implementation

- **Primary Files**: `amend1.php`, `amend2.php`, `amend3.php`
- **Conflict Services**: `ConflictsService.php`
- **Database Tables**: `amendments`, `conflicts`
- **Algorithm**: Conflict detection algorithms

#### Business Rules

- Amendments must maintain proposal intent
- Conflicts must be resolved before voting
- All parties must be notified of conflicts
- JC has final authority on conflict resolution

### 4. CIA Version Control and History

#### Purpose

Maintain comprehensive version control of the CIA document across different Agorae.

#### Version Management System

##### Version Tracking

- **Version Identification**:

  - Unique version numbers for each CIA revision
  - Agora-specific version associations
  - Change timestamp recording
  - Author/approver identification

- **Change Documentation**:
  - Detailed change logs
  - Before/after text comparisons
  - Reason for change documentation
  - Cross-reference updates

##### Historical Preservation

- **Archive Management**:

  - Complete historical CIA versions
  - Proposal-to-change mapping
  - Decision rationale preservation
  - Access control for historical data

- **Audit Trail**:
  - Complete modification history
  - User action logging
  - Decision point documentation
  - Compliance verification

#### Technical Implementation

- **Database Tables**: `CIA`, `CIA_history`
- **Version Services**: `CIAService.php`
- **Comparison Tools**: Text difference algorithms
- **Archive Systems**: Historical data management

#### Business Rules

- All CIA changes must be traceable to approved proposals
- Historical versions must remain immutable
- Change documentation is required for all modifications
- Access to historical data is controlled

### 5. Proposal Status and Workflow Management

#### Purpose

Track proposal progress through the complete lifecycle from submission to implementation.

#### Status Workflow

##### Status Categories

- **Draft**: Initial creation, not yet submitted
- **Submitted**: Formally submitted, awaiting JC review
- **Under Review**: Active JC review process
- **Feedback Pending**: Awaiting proposer response to JC feedback
- **Approved**: JC approval granted, ready for voting
- **Rejected**: JC rejection, proposal terminated
- **Voting**: Active voting process
- **Adopted**: Approved by vote, pending implementation
- **Implemented**: Changes applied to CIA
- **Withdrawn**: Proposer withdrawal

##### Workflow Automation

- **Automatic Transitions**:

  - Status updates based on actions
  - Deadline-triggered status changes
  - Integration with voting system
  - Implementation status tracking

- **Notification System**:
  - Status change notifications
  - Deadline reminders
  - Action required alerts
  - Completion confirmations

#### Technical Implementation

- **Status Management**: Workflow engine
- **Notification System**: Automated messaging
- **Integration Points**: Voting system integration
- **Reporting Tools**: Status reporting and analytics

## Integration Points

### With Voting System

- **Proposal-Vote Linking**: Direct integration for approved proposals
- **Vote Configuration**: Automatic voting setup based on proposal type
- **Result Processing**: Integration of voting results with proposal status
- **Implementation Triggers**: Automatic CIA updates upon approval

### With CIA Management

- **Text Integration**: Direct CIA modification capabilities
- **Reference Validation**: Real-time CIA reference checking
- **Version Control**: Integrated versioning with proposal system
- **Change Tracking**: Complete change audit trail

### With Communication System

- **Stakeholder Notifications**: Automated updates to interested parties
- **Public Access**: Published proposal information
- **Feedback Collection**: Structured feedback mechanisms
- **Decision Communication**: Official decision notifications

## User Interface Components

### 1. Proposal Dashboard

- **Personal Proposals**: Proposals submitted by current user
- **Status Overview**: Visual status indicators
- **Action Items**: Required actions and deadlines
- **Quick Access**: Shortcuts to common functions

### 2. JC Review Interface

- **Review Queue**: Proposals awaiting JC attention
- **Review Tools**: Side-by-side text comparison
- **Feedback Forms**: Structured feedback entry
- **Decision Management**: JC decision recording

### 3. Public Proposal Browser

- **Proposal Listing**: Public access to approved proposals
- **Search and Filter**: Find proposals by topic, status, or date
- **Document Viewer**: User-friendly proposal display
- **Historical Access**: Browse proposals from previous Agorae

## Security and Access Control

### Permission Levels

- **Public Access**: View published proposals and results
- **Registered Users**: Submit proposals and view detailed information
- **JC Members**: Full review and management capabilities
- **Administrators**: System configuration and troubleshooting

### Data Security

- **Version Control Security**: Immutable historical records
- **Access Logging**: Complete audit trail of access and modifications
- **Backup Systems**: Regular backup of proposal data
- **Confidentiality**: Secure handling of sensitive proposal information

## Performance and Scalability

### Optimization Strategies

- **Database Indexing**: Optimized queries for proposal searching
- **Caching Systems**: Cache frequently accessed proposals
- **Document Storage**: Efficient storage of proposal documents
- **Search Optimization**: Fast full-text search capabilities

### Scalability Considerations

- **Large Proposal Volumes**: Handle hundreds of proposals per Agora
- **Concurrent Access**: Multiple users working simultaneously
- **Document Size**: Handle large proposal documents efficiently
- **Historical Data**: Manage growing historical archives

## Future Enhancements

### Advanced Features

- **AI-Assisted Review**: Automated initial proposal analysis
- **Collaborative Editing**: Real-time collaborative proposal development
- **Advanced Workflow**: Configurable workflow management
- **Integration APIs**: External system integration capabilities

### User Experience Improvements

- **Mobile Optimization**: Mobile-friendly proposal management
- **Real-time Collaboration**: Live editing and commenting
- **Advanced Search**: Semantic search capabilities
- **Personalization**: Customized user interfaces

This comprehensive Proposal Management System ensures efficient, secure, and compliant handling of AEGEE's constitutional amendment process while supporting the complex requirements of international organizational governance.
