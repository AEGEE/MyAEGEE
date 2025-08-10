# Microservices Architecture and User Stories

## Overview

The AEGEE OMS rewrite is structured around a **5-microservice architecture** designed for scalability, maintainability, and clear separation of concerns. This document outlines the user stories for each microservice and their interaction patterns.

## Microservice Architecture

### Current Tech Stack Overview

The MyAEGEE platform uses a consistent technology stack across microservices:

**Backend Stack:**

- **Language**: JavaScript (Node.js) for existing services, TypeScript for new services
- **Framework**: Express.js with express-promise-router
- **Database**: PostgreSQL with Sequelize ORM (considering Prisma/TypeORM for TypeScript services)
- **Authentication**: JWT tokens with refresh token mechanism
- **HTTP Client**: `request-promise-native` (considering Axios for new services)
- **Logging**: Bunyan logger with structured logging
- **Error Monitoring**: Bugsnag integration
- **API Documentation**: Not currently standardized (recommend OpenAPI/Swagger)

**Frontend Stack:**

- **Framework**: Vue 2 with Vuex for state management
- **HTTP Client**: Axios for API requests
- **UI Framework**: Buefy (Vue.js wrapper for Bulma CSS)
- **Build Tool**: Vue CLI
- **Router**: Vue Router

### 1. Core Microservice (Existing)

**Responsibility**: Authentication, authorization, user management, and core system functionality

**Current Implementation:**

- User authentication and session management via JWT tokens
- Sophisticated RBAC (Role-Based Access Control) with circle-based permissions
- Hierarchical permission system: `global:action:object`, `local:action:object`, `join_request:action:object`
- PostgreSQL database with Sequelize ORM
- RESTful API with Express.js
- Cross-service audit logging and system configuration

**Key Features:**

- Permission inheritance through circle hierarchies
- Token-based authentication with automatic renewal
- Body and circle membership management
- Centralized user profile management

### 2. Statutory Microservice (Existing)

**Responsibility**: Agora management and attendance tracking

**Current Implementation:**

- Event lifecycle management for statutory events
- Application and registration system
- Member list management for statutory events
- PostgreSQL database with Sequelize ORM
- Integration with core service for authentication and permissions

**Key Features:**

- Agora creation and lifecycle management
- Delegate registration and management
- Real-time attendance tracking (including barcode scanning)
- Quorum calculations and reporting
- Mass mailing functionality for participants

### 3. Proposals Microservice (New)

**Responsibility**: CIA amendments and proposal lifecycle management

**Planned Implementation:**

- TypeScript-based microservice following existing patterns
- PostgreSQL database with modern ORM (Prisma/TypeORM)
- RESTful API with Express.js or Fastify
- Integration with statutory service for event validation
- Integration with core service for authentication

**Key Features:**

- CIA document management and versioning
- Proposal submission and review workflow
- Amendment tracking and management
- JC review and approval processes

### 4. Votings Microservice (New)

**Responsibility**: All voting processes and vote management

**Planned Implementation:**

- TypeScript-based microservice with real-time capabilities
- PostgreSQL database with transaction support
- WebSocket integration for real-time vote updates
- Complex algorithm implementation for vote counting

**Key Features:**

- Vote casting for all types (proposals, motions, reports, elections)
- Vote allocation and distribution algorithms
- Complex voting methods (Schulze, ranked choice)
- Real-time vote counting and result calculation

### 5. Frontend Microservice (Existing)

**Responsibility**: User interface and presentation layer

**Current Implementation:**

- Vue 2 single-page application
- Vuex for centralized state management
- Buefy for consistent UI components
- Axios for HTTP requests with automatic token handling
- Service-based API routing configuration

**Key Features:**

- Web application frontend with responsive design
- Mobile-responsive interfaces
- Real-time updates via polling (WebSockets planned)
- Role-based UI element visibility
- Real-time UI updates via WebSocket
- User experience and accessibility features

## Service Interaction Patterns

### Authentication Flow

```
Frontend → Core Service (Authentication) → Other Services (Authorized Requests)
```

### Agora Management Flow

```
Frontend → Statutory Service → Core Service (User Validation) → Proposals/Votings (Event Notifications)
```

### Proposal to Voting Flow

```
Proposals Service → Statutory Service (Agora Validation) → Votings Service (Session Creation)
```

### Attendance Integration Flow

```
Statutory Service (Attendance) → Votings Service (Eligibility Updates) → Frontend (Real-time Updates)
```

## User Stories by Microservice

### Proposals Microservice Stories

#### Core Functionality (Required)

**PS-001: CIA Document Access**

```
As a member
I want to view the current CIA document
So that I can understand the current constitutional framework

Acceptance Criteria:
- Current CIA is always available and up-to-date
- Document is searchable and navigable
- Version information is clearly displayed
- Links to related proposals are visible

Technical Notes:
- Integration with CIA document management system
- Real-time updates when proposals are accepted
- Responsive display for mobile devices
- API calls to Core Service for user authentication
```

**PS-002: Historical CIA Access**

```
As a member
I want to view previous versions of the CIA
So that I can understand how the constitution has evolved

Acceptance Criteria:
- Complete version history is accessible
- Diff views show changes between versions
- Search works across all historical versions
- Download options for archival versions

Technical Notes:
- Version control system integration
- Efficient storage for document history
- Git-like diff visualization
```

**PS-003: Proposal Viewing**

```
As a member
I want to view current and historical proposals
So that I can stay informed about constitutional changes

Acceptance Criteria:
- All proposals are publicly viewable
- Filtering by status, category, and date
- Clear indication of proposal status
- Links to related documents and discussions

Technical Notes:
- Efficient query system for proposal filtering
- Status tracking with clear visual indicators
- Related content recommendation engine
```

**PS-004: Proposal Commenting**

```
As a member
I want to comment on current proposals
So that I can contribute to the democratic discussion

Acceptance Criteria:
- Comment threading and replies
- Comment moderation capabilities
- Notification system for responses
- Rich text formatting support

Technical Notes:
- Real-time comment updates
- Moderation workflow integration
- Notification service integration
```

**PS-005: Proposal Submission**

```
As a member
I want to submit constitutional proposals
So that I can propose improvements to AEGEE's framework

Acceptance Criteria:
- Guided submission process with templates
- Draft saving and revision capabilities
- Submission deadline enforcement
- Automatic formatting validation

Technical Notes:
- Rich text editor with CIA-specific templates
- Draft auto-save functionality
- Document validation engine
```

**PS-006: Proposal Updates**

```
As a proposal submitter
I want to update my proposals during the review period
So that I can address feedback and improve my proposal

Acceptance Criteria:
- Version control for proposal changes
- Clear indication of what changed
- Deadline enforcement for updates
- JC notification of updates

Technical Notes:
- Document versioning system
- Change tracking and diff views
- Automated notification system
```

**PS-007: JC Proposal State Management**

```
As a JC member
I want to change the state of proposals
So that I can manage the proposal review workflow

Acceptance Criteria:
- Clear workflow states and transitions
- Audit trail for state changes
- Bulk state change operations
- Automated notifications on state changes

Technical Notes:
- State machine implementation
- Role-based permissions for state changes
- Comprehensive audit logging

States to Define:
- Submitted
- Under Review
- Requires Changes
- Approved for Voting
- Rejected
- Withdrawn
- Voted (Accepted/Rejected)
```

**PS-008: JC Amendment Management**

```
As a JC member
I want to add amendments to proposals
So that I can incorporate feedback and improve proposals

Acceptance Criteria:
- Amendment tracking with clear attribution
- Original proposal preservation
- Amendment approval workflow
- Consolidated view of final proposal

Technical Notes:
- Amendment versioning system
- Collaborative editing capabilities
- Change approval workflow
```

#### Optional Features

**PS-009: CIA PDF Generation**

```
As a JC member
I want to generate PDF versions of the current CIA
So that I can distribute official documents

Acceptance Criteria:
- Professional formatting with AEGEE branding
- Automatic table of contents and indexing
- Watermarking for draft vs. final versions
- Batch generation capabilities
```

**PS-010: Public CIA Downloads**

```
As a member
I want to download PDF versions of the CIA
So that I can access documents offline

Acceptance Criteria:
- Multiple format options (PDF, Word, plain text)
- Mobile-optimized downloads
- Version information embedded in documents
- Download analytics for usage tracking
```

**PS-011: Member Amendment Submission**

```
As a member
I want to submit amendments to existing proposals
So that I can contribute improvements to proposals

Acceptance Criteria:
- Amendment submission interface
- Integration with proposal review process
- Amendment tracking and attribution
- Notification to original proposal author
```

**PS-012: Proposal Withdrawal**

```
As a proposal submitter
I want to withdraw my proposal if needed
So that I can remove proposals I no longer support

Acceptance Criteria:
- JC approval required for withdrawal
- Clear audit trail of withdrawal reason
- Impact assessment on voting schedule
- Notification to interested parties

Technical Notes:
- Withdrawal approval workflow
- Impact analysis on dependent processes
```

### Votings Microservice Stories

#### Core Functionality (Required)

**VS-001: Proposal Voting**

```
As a delegate
I want to vote on constitutional proposals
So that I can represent my antenna's position

Acceptance Criteria:
- Clear proposal display during voting
- Vote allocation enforcement per antenna
- Real-time vote submission feedback
- Vote verification without revealing choice

Technical Notes:
- Integration with Proposals microservice for proposal content
- Integration with Statutory microservice for delegate eligibility
- Complex vote allocation algorithm
- Cryptographic vote verification
- API calls to Core Service for authentication
```

**VS-002: Motion Voting**

```
As a delegate
I want to vote on procedural motions
So that I can participate in meeting management

Acceptance Criteria:
- Simple yes/no/abstain voting interface
- Immediate result calculation
- Real-time vote tallies (if permitted)
- Motion context and explanation display

Technical Notes:
- Integration with Statutory microservice for session management
- Simpler voting logic than proposals
- Real-time result aggregation
- API calls to Core Service for user verification
```

Technical Notes:

- Simpler voting logic than proposals
- Real-time result aggregation
- Integration with meeting management

```

**VS-003: Report Voting**

```

As a delegate
I want to vote on organizational reports
So that I can approve or reject institutional reports

Acceptance Criteria:

- Report display integration
- Accept/reject voting options
- Comment attachment to votes
- Result summary and statistics

Technical Notes:

- Document integration for report display
- Vote result aggregation and reporting

```

**VS-004: Schulze Method Voting**

```

As a delegate
I want to vote using the Schulze method for complex decisions
So that I can participate in ranked preference voting

Acceptance Criteria:

- Intuitive ranked preference interface
- Drag-and-drop candidate ordering
- Schulze algorithm result calculation
- Result explanation and visualization

Technical Notes:

- Complex ranking algorithm implementation
- User-friendly preference ranking interface
- Result calculation and explanation system

```

**VS-005: Vote Redistribution on Departure**

```

As a voting system
I want to automatically recalculate vote allocations when delegates depart
So that voting power is redistributed correctly

Acceptance Criteria:

- Automatic recalculation when departure events received
- Real-time vote redistribution calculation
- Impact assessment on ongoing votes
- Notification to affected antenna

Technical Notes:

- Event-driven architecture receiving departure events from Statutory Service
- Complex vote redistribution algorithm
- Real-time recalculation of voting power
- Integration with Statutory microservice for attendance updates

```

#### Features Under Discussion

**VS-006: Candidate Voting**

```

As a delegate
I want to vote for candidates in leadership elections
So that I can participate in leadership selection

Questions:

- Is this separate from main voting system?
- Different vote allocation rules?
- Integration with candidate management?

```

**VS-007: Pre/Post-Agora Voting**

```

As a JC member
I want to create pre- and post-Agora voting sessions
So that I can handle time-sensitive decisions

Questions:

- Same system or separate instances?
- Different attendance/quorum rules?
- How to handle delegate authorization?

```

**VS-008: Attendance-Based Voting**

```

As an envoy for CA
I want to show my attendance for voting eligibility
So that I can participate in pre/post-Agora decisions

Questions:

- Integration with main attendance system?
- Different attendance verification methods?
- Quorum calculation differences?

```

### Statutory Microservice Stories

#### Core Functionality (Required)

**SS-001: Agora Creation and Management**

```

As a JC member
I want to create and manage Agorae
So that I can set up statutory meetings with proper configuration

Acceptance Criteria:

- Create new Agora with dates, location, and type
- Configure voting deadlines and schedules
- Set up delegate registration periods
- Manage Agora status transitions (Planning → Active → Closed)

Technical Notes:

- Integration with Core Service for user permissions
- Event notifications to Proposals and Votings services
- Calendar integration and timezone management

```

**SS-002: Delegate Registration Management**

```

As a JC member
I want to manage delegate registration for Agorae
So that I can ensure proper representation and voting rights

Acceptance Criteria:

- Review and approve delegate registrations
- Verify antenna affiliations and eligibility
- Manage vote allocations per antenna
- Handle registration deadline enforcement

Technical Notes:

- Integration with Core Service for user authentication
- API calls to external AEGEE database for verification
- Event notifications to Votings service for eligibility updates

```

**SS-003: Real-time Attendance Tracking**

```

As an attendance coordinator
I want to track delegate attendance in real-time
So that I can maintain accurate participation records

Acceptance Criteria:

- Barcode scanning integration for check-in/check-out
- Real-time attendance dashboard
- Automatic quorum calculations
- Attendance history and reporting

Technical Notes:

- Barcode scanner hardware integration
- WebSocket connections for real-time updates
- Event streaming to Votings service for eligibility
- Integration with Frontend service for live displays

```

**SS-004: Delegate Departure Management**

```

As a JC member
I want to mark delegates as having departed
So that their votes can be redistributed appropriately

Acceptance Criteria:

- Mark delegate departure with timestamp and reason
- Trigger vote redistribution in ongoing votes
- Audit trail for departure decisions
- Notification to affected antenna

Technical Notes:

- Event publishing to Votings service for redistribution
- Integration with attendance tracking system
- Audit logging through Core service

```

**SS-005: Quorum Management**

```

As a chair
I want to monitor and manage quorum requirements
So that I can ensure valid decision-making processes

Acceptance Criteria:

- Real-time quorum calculation based on attendance
- Different quorum rules for different vote types
- Quorum alerts and notifications
- Historical quorum reporting

Technical Notes:

- Complex quorum calculation algorithms
- Integration with voting sessions
- Real-time notifications to Frontend service

```

### Frontend Microservice Stories

#### Core Functionality (Required)

**FS-001: Responsive User Interface**

```

As any user
I want a responsive, intuitive interface
So that I can easily participate regardless of my device

Acceptance Criteria:

- Mobile-responsive design across all features
- Accessible interface following WCAG guidelines
- Consistent user experience across different screen sizes
- Fast loading times and smooth interactions

Technical Notes:

- Modern frontend framework (React/Vue/Angular)
- Progressive Web App capabilities
- Accessibility testing and compliance
- Performance optimization and bundling

```

**FS-002: Real-time Data Updates**

```

As any user
I want to see real-time updates without refreshing
So that I have current information for decision-making

Acceptance Criteria:

- Live updates for voting results and attendance
- Real-time notifications for important events
- Automatic UI updates when data changes
- Graceful handling of connection issues

Technical Notes:

- WebSocket connections to backend services
- State management for real-time data
- Connection retry and offline handling
- Event-driven UI updates

```

**FS-003: Multi-language Support**

```

As a user from any European country
I want the interface in my preferred language
So that I can participate effectively in my native language

Acceptance Criteria:

- Support for major European languages
- Dynamic language switching
- Culturally appropriate formatting (dates, numbers)
- Translated help and documentation

Technical Notes:

- Internationalization (i18n) framework
- Dynamic translation loading
- Right-to-left language support
- Cultural adaptation beyond translation

```

### Cross-Service Integration Stories

**CS-001: Proposal-to-Voting Transition**

```

As a JC member
I want to seamlessly move approved proposals to voting
So that the democratic process flows smoothly

Acceptance Criteria:

- Automatic voting session creation from approved proposals
- Proposal data transfer to voting interface
- Voting schedule coordination with Statutory service
- Status synchronization between Proposals and Votings services

Technical Notes:

- Event-driven architecture for service communication
- Integration with Statutory service for Agora validation
- Data consistency across microservices
- Rollback capabilities for failed transitions

```

**CS-002: Authentication Flow Across Services**

```

As any authenticated user
I want seamless access across all system features
So that I don't need to re-authenticate for different functions

Acceptance Criteria:

- Single sign-on across all microservices
- Consistent authorization rules across services
- Token-based authentication with proper expiration
- Graceful handling of authentication failures

Technical Notes:

- JWT tokens issued by Core service
- Service-to-service authentication
- Role-based access control enforcement
- Token refresh and validation across services

```

**CS-003: Real-time Updates Across Services**

```

As any user
I want to see real-time updates when any system state changes
So that I have current information for decision-making

Acceptance Criteria:

- Live updates for proposals, voting, and attendance
- Cross-service event propagation
- Consistent state displayed in Frontend
- Graceful handling of connection failures

Technical Notes:

- Event bus architecture connecting all services
- WebSocket connections managed by Frontend service
- State synchronization protocols
- Event correlation and ordering

```

**CS-004: Attendance-Voting Integration**

```

As a system
I want voting eligibility to automatically update based on attendance
So that vote allocations remain accurate in real-time

Acceptance Criteria:

- Immediate voting eligibility updates when attendance changes
- Automatic vote redistribution on delegate departure
- Real-time quorum updates affecting voting sessions
- Audit trail for all eligibility changes

Technical Notes:

- Event streaming from Statutory to Votings service
- Real-time vote redistribution algorithms
- Integration with ongoing voting sessions
- Audit logging through Core service

```

**CS-005: End-to-End Agora Workflow**

```

As a JC member
I want to manage the complete Agora lifecycle
So that all components work together seamlessly

Acceptance Criteria:

- Agora creation triggers proposal deadlines
- Attendance tracking enables voting sessions
- Proposal approvals automatically create voting opportunities
- Results integrate back into proposal statuses

Technical Notes:

- Workflow orchestration across all services
- State machine coordination between services
- Dependency management for cross-service operations
- Compensation patterns for failed transactions

````

## Outstanding Features for Discussion

### Proxy Voting

The spreadsheet mentions "Proxy voting" but without details. This requires clarification:

- Is proxy voting allowed in AEGEE procedures?
- How would proxy authorization work?
- What are the limitations and audit requirements?
- Should this be a separate feature or integrated into existing voting?

## Architecture Implications

### Service Boundaries

- **Core Service**: User authentication, authorization, permissions, system configuration, cross-service audit logging
- **Statutory Service**: Agora lifecycle, delegate registration, attendance tracking, quorum management
- **Proposals Service**: CIA document management, proposal workflow, amendments, state transitions
- **Votings Service**: Vote casting, result calculation, vote distribution algorithms, voting session management
- **Frontend Service**: User interface, real-time updates, mobile responsiveness, accessibility features

### Data Flow

1. **Authentication Flow**: Core Service → All other services (JWT token validation)
2. **Agora Lifecycle**: Statutory Service → Proposals/Votings (event notifications for deadlines and sessions)
3. **Proposal Workflow**: Proposals Service → Statutory Service (Agora validation) → Votings Service (session creation)
4. **Attendance Updates**: Statutory Service → Votings Service (eligibility updates) → Frontend Service (real-time display)
5. **Voting Process**: Frontend → Votings Service → Statutory Service (quorum validation) → Proposals Service (status updates)
6. **Audit Trail**: All services → Core Service (centralized audit logging)

### Integration Points

- **Event-Driven Communication**: Message bus connecting all services for state changes and notifications
- **Centralized Authentication**: Core Service provides authentication for all other services
- **Real-time Updates**: Frontend Service manages WebSocket connections for live updates from all backend services
- **Shared Reference Data**: Event-driven synchronization of antenna, user, and Agora information
- **Cross-Service Transactions**: Saga pattern for operations spanning multiple services

### Service Dependencies

- **Frontend Service**: Depends on all backend services for data and functionality
- **Proposals Service**: Depends on Core (auth), Statutory (Agora validation), Votings (transition events)
- **Votings Service**: Depends on Core (auth), Statutory (attendance), Proposals (content)
- **Statutory Service**: Depends on Core (auth) and publishes events to Proposals/Votings
- **Core Service**: Foundation service that others depend on for authentication and configuration

## Microservice Communication Patterns

### Inter-Service Communication

The MyAEGEE platform uses a consistent HTTP-based communication pattern between microservices:

**Standard Request Pattern:**
```javascript
const makeRequest = (options) => {
    const requestOptions = {
        url: options.url,
        method: options.method || 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': options.token,
            'X-Service': 'service-name'  // Identifies the calling service
        },
        simple: false,
        json: true,
        resolveWithFullResponse: options.resolveWithFullResponse || false
    };

    if (options.body) requestOptions.body = options.body;
    if (options.qs) requestOptions.qs = options.qs;

    return request(requestOptions);
};
````

**Service Discovery:**

- Services communicate via internal Docker network URLs
- Configuration-based endpoints (e.g., `config.core.url + ':' + config.core.port`)
- Each service has hardcoded knowledge of other services' endpoints in configuration files

**Authentication Forwarding:**

- Auth tokens are passed through `X-Auth-Token` header
- Services can authenticate requests by validating tokens with the core service
- Service identification via `X-Service` header for audit trails

### API Gateway Pattern

The frontend uses a service configuration mapping for dynamic endpoint resolution:

```json
{
  "core": "/api/core",
  "events": "/api/events",
  "statutory": "/api/statutory",
  "mailer": "/api/mailer",
  "proposals": "/api/proposals", // New service
  "votings": "/api/votings" // New service
}
```

**Benefits:**

- Environment-specific configuration
- Load balancer integration
- Service versioning support
- Easy service replacement/updates

### Error Handling and Resilience

**Consistent Error Response Format:**

```javascript
{
    success: false,
    message: "Human-readable error message",
    errors: [...], // Validation errors if applicable
    statusCode: 400
}
```

**Retry and Timeout Patterns:**

- Request timeouts for inter-service calls
- Exponential backoff for retries
- Circuit breaker pattern for critical dependencies
- Graceful degradation when services are unavailable

## Authentication and Authorization Architecture

### JWT Token-Based Authentication

**Token Structure:**

- **Access Token**: Short-lived (15 minutes), contains user ID and basic claims
- **Refresh Token**: Long-lived (30 days), used to obtain new access tokens
- **Token Storage**: Frontend stores tokens in localStorage

**Authentication Flow:**

1. User logs in with credentials to core service
2. Core service validates credentials and generates token pair
3. Frontend stores tokens and includes access token in all requests
4. Services validate tokens by checking with core service or JWT verification
5. Token automatically renewed on 401 responses

### Permission System Architecture

**RBAC Implementation:**

- **Scope-based permissions**: `global:action:object`, `local:action:object`, `join_request:action:object`
- **Circle-based membership**: Users belong to circles within bodies
- **Hierarchical circles**: Parent-child relationships for permission inheritance

**Permission Resolution:**

```javascript
class PermissionsManager {
  hasPermission(permission) {
    const keys = PermissionsManager.getPermissionKeys(permission);
    return keys.some((key) => this.permissionsMap[key]);
  }

  getPermissionFilters(permission) {
    // Returns filters for data access control
    return this.permissionsMap[permission]?.filters;
  }
}
```

**Permission Priority Order:**

1. Global permissions (highest priority)
2. Local body permissions
3. Join request permissions (lowest priority)

**Middleware Chain:**

```javascript
// Standard authorization chain for protected endpoints
router.use(middlewares.maybeAuthorize); // Optional auth check
router.use(middlewares.ensureAuthorized); // Required auth check
router.use(fetch.fetchUser); // Load user context
router.use(fetch.fetchPermissions); // Load user permissions
```

### Frontend Authentication Integration

**Vue.js Auth Plugin:**

```javascript
// Global authentication methods
this.$auth.login(credentials); // Login user
this.$auth.fetchUser(); // Get current user profile
this.$auth.fetchPermissions(); // Get user permissions
this.$auth.logout(); // Clear tokens and logout
```

**Automatic Token Management:**

- Axios interceptors automatically attach tokens to requests
- Automatic token renewal on 401 responses
- Token validation before each request
- Redirect to login on authentication failure

**Permission-Based UI:**

```javascript
// Check permissions in Vue components
computed: {
    canCreateEvent() {
        return this.permissions.some(p => p.combined.endsWith('create:event'));
    }
}
```

This 5-microservice architecture provides clear separation of concerns, independent scalability, and robust fault isolation while maintaining the integrated user experience required for democratic processes.

```

```
