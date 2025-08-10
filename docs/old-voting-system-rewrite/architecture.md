# System Architecture

## Current Architecture Overview

The AEGEE OMS is built as a monolithic PHP application with a traditional three-tier architecture:

### Presentation Layer

- **Layout System**: Template-based rendering with `Layout.php` classes
- **Form Handling**: Custom form classes extending `AbstractForm`
- **List Display**: Pagination and data display through `ListPager`
- **Client-side**: Basic JavaScript for interactivity, sound feedback

### Business Logic Layer

- **Service Classes**: Business logic encapsulation (`*Service.php`)
- **Model Classes**: Data entities (`*Model.php`) implementing `IModel` interface
- **Form Processing**: Validation and data transformation
- **Access Control**: Role-based permissions through `Access` class

### Data Access Layer

- **DAO Pattern**: Data Access Objects (`*Dao.php`) for database operations
- **MySQL Integration**: Direct SQL queries with custom MySQL wrapper
- **Session Management**: PHP sessions for user state
- **Configuration**: File-based configuration system

## Directory Structure

```
/
├── config.php                 # Main configuration
├── index.php                  # Entry point
├── oms_login.php              # Authentication
├── include/                   # Core system files
│   ├── classes/               # Core classes (Layout, Access, etc.)
│   ├── functions.php          # Global functions
│   └── include.php            # Bootstrap file
├── jc/                        # JC Module (main application)
│   ├── include/
│   │   ├── classes/           # JC-specific classes
│   │   ├── dao/               # Data Access Objects
│   │   ├── model/             # Data models
│   │   └── service/           # Business logic services
│   ├── DB-files/MySQL/        # Database schema and updates
│   ├── [functional-pages].php # Feature-specific pages
│   └── js/                    # JavaScript files
├── layout/                    # Template files
└── locale/                    # Internationalization
```

## Key Design Patterns

### 1. Data Access Object (DAO) Pattern

```php
interface DaoInterface {
    public function load($id);
    public function loadAll();
    public function saveOrUpdate(IModel $model);
    public function delete($id);
}
```

**Purpose**: Separate data access logic from business logic
**Implementation**: Each entity has a corresponding DAO class

### 2. Service Layer Pattern

```php
class ProposalsService {
    private $proposalsDao;

    public function saveOrUpdate($proposal) {
        // Business logic validation
        // Workflow management
        return $this->proposalsDao->saveOrUpdate($proposal);
    }
}
```

**Purpose**: Encapsulate business rules and coordinate between DAOs
**Implementation**: Services handle complex operations and business workflows

### 3. Factory Pattern

```php
class ClassFactory {
    public function getProposalsService() {
        return new ProposalsService($this->getProposalsDao());
    }
}
```

**Purpose**: Centralized object creation and dependency injection
**Implementation**: Single factory provides all service and DAO instances

### 4. Template Method Pattern

```php
abstract class AbstractForm {
    final public function process() {
        $this->validate();
        $this->save();
        $this->redirect();
    }

    abstract protected function save(IModel $model);
}
```

**Purpose**: Define common form processing workflow
**Implementation**: Forms extend AbstractForm and implement specific save logic

## Data Flow Architecture

### 1. Request Processing Flow

```
HTTP Request → index.php → Include Bootstrap → Layout Initialization
→ Access Control → Business Logic → Data Access → Response Generation
```

### 2. Authentication Flow

```
Login Request → oms_login.php → Session Creation → Permission Assignment
→ Module Access → Feature Authorization
```

### 3. Voting Flow

```
Vote Submission → Validation → Vote Distribution Calculation
→ Database Transaction → Result Update → Real-time Notification
```

## Security Architecture

### Access Control Levels

- **ANONYMOUS**: Public access (viewing published results)
- **VISITOR**: Registered users (basic viewing)
- **JC_MANAGE**: JC members (proposal management, voting setup)
- **Admin**: System administrators (full system control)

### Session Management

- PHP session-based authentication
- Role-specific session variables
- Automatic session timeout
- Cross-request state maintenance

### Data Validation

- Input sanitization at form level
- SQL injection prevention through parameterized queries
- XSS protection through output encoding
- Business rule validation in service layer

## Integration Architecture

### Database Integration

- **Primary Database**: MySQL for core data
- **Session Storage**: File-based PHP sessions
- **Logging**: File-based logging system
- **Configuration**: PHP configuration files

### External System Integration

- **Barcode Scanners**: Direct integration for attendance tracking
- **AEGEE Database**: Import/export functionality for delegate data
- **Sound System**: JavaScript-based audio feedback

## Scalability Considerations

### Current Limitations

1. **Single Point of Failure**: Monolithic architecture
2. **Database Bottlenecks**: Direct MySQL queries without optimization
3. **Session Storage**: File-based sessions don't scale horizontally
4. **Real-time Features**: Limited by page refresh model
5. **Caching**: No caching layer implemented

### Recommended Modern Architecture

#### 5-Microservice Architecture Design

Based on the existing services and user requirements analysis, the system will be structured around five microservices:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           API Gateway                               │
│           - Rate Limiting  - Load Balancing  - Request Routing      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
┌─────────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Core Service      │    │ Statutory Svc   │    │ Frontend Service│
│   (Existing)        │    │ (Existing)      │    │ (Existing)      │
│                     │    │                 │    │                 │
│ - Authentication    │    │ - Agora Mgmt    │    │ - Web UI        │
│ - Authorization     │    │ - Attendance    │    │ - Mobile UI     │
│ - User Management   │    │ - Delegate Reg  │    │ - Real-time     │
│ - System Config     │    │ - Barcode Scan  │    │ - WebSockets    │
│ - Audit Logging     │    │ - Quorum Calc   │    │ - i18n Support  │
└─────────────────────┘    └─────────────────┘    └─────────────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
         ┌─────────────────────────────────────────────────────────────┐
         │                    Event Bus / Message Queue                │
         │           (Service Communication & Real-time Updates)       │
         └─────────────────────────────────────────────────────────────┘
                                   │
         ┌─────────────────┐                         ┌─────────────────┐
         │ Proposals Svc   │                         │  Votings Svc    │
         │ (New)           │                         │  (New)          │
         │                 │                         │                 │
         │ - CIA Mgmt      │◄────────────────────────┤ - Vote Casting  │
         │ - Proposal Flow │                         │ - Vote Counting │
         │ - Amendments    │                         │ - Schulze Method│
         │ - State Mgmt    │                         │ - Result Calc   │
         │ - Doc Versions  │                         │ - Redistribution│
         └─────────────────┘                         └─────────────────┘
                 │                                           │
                 └───────────────────┬───────────────────────┘
                                     │
         ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
         │   PostgreSQL    │    │     Redis       │    │  File Storage   │
         │   (Primary DB)  │    │   (Cache &      │    │ (Documents &    │
         │                 │    │   Sessions)     │    │  Attachments)   │
         └─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Service Responsibilities:**

**Core Service (Existing):**

- User authentication and session management
- Role-based authorization and permissions
- System configuration and settings management
- Cross-service audit logging and compliance
- User profile and preference management

**Statutory Service (Existing):**

- Agora creation and lifecycle management
- Delegate registration and verification
- Real-time attendance tracking via barcode scanning
- Quorum calculations and validation
- Meeting session management

**Proposals Service (New):**

- CIA document management and versioning
- Proposal submission and review workflow
- Amendment tracking and management
- Proposal state machine management
- Document generation (PDF, exports)
- Integration with external CIA systems

**Votings Service (New):**

- All voting type implementations (simple, Schulze, ranked)
- Vote allocation and distribution algorithms
- Real-time vote counting and result calculation
- Vote redistribution when delegates depart
- Voting session management and coordination

**Frontend Service (Existing):**

- Web application user interface
- Mobile-responsive design and PWA features
- Real-time UI updates via WebSocket connections
- Multi-language support and accessibility
- User experience optimization

**Service Responsibilities:**

**Proposals Service:**

- CIA document management and versioning
- Proposal submission and review workflow
- Amendment tracking and management
- Proposal state machine management
- Document generation (PDF, exports)
- Integration with external CIA systems

**Votings Service:**

- All voting type implementations (simple, Schulze, ranked)
- Vote allocation and distribution algorithms
- Real-time vote counting and result calculation
- Attendance tracking and delegate management
- Vote redistribution when delegates depart
- Integration with barcode scanning systems

**Shared Services:**

- User authentication and authorization
- Real-time notifications (WebSocket hub)
- Audit logging and compliance
- File storage and document management
- System configuration and management

#### Modern Technology Stack

- **API Gateway**: Kong, Nginx, or AWS API Gateway
- **Backend Services**: Node.js/Express, Python/FastAPI, or Go
- **Database**: PostgreSQL with connection pooling
- **Caching**: Redis for sessions and frequent data
- **Message Queue**: RabbitMQ or Apache Kafka for async processing
- **Real-time**: WebSocket connections for live updates
- **Frontend**: React/Vue.js SPA with state management
- **Infrastructure**: Docker containers, Kubernetes orchestration
- **Monitoring**: Prometheus/Grafana for metrics, ELK stack for logs

## Performance Considerations

### Current Performance Issues

1. **N+1 Query Problems**: Multiple database calls in loops
2. **No Query Optimization**: Complex voting calculations in PHP
3. **Large Result Sets**: No pagination in some views
4. **Blocking Operations**: Synchronous processing of long operations

### Optimization Strategies

1. **Database Optimization**

   - Implement query caching
   - Add database indexes for common queries
   - Use database views for complex aggregations
   - Implement read replicas for reporting

2. **Application Optimization**

   - Implement Redis caching layer
   - Asynchronous processing for heavy operations
   - Connection pooling for database access
   - CDN for static assets

3. **Real-time Features**
   - WebSocket connections for live voting
   - Server-sent events for attendance updates
   - Push notifications for important events

## Deployment Architecture

### Current Deployment

- Single server deployment
- Apache/Nginx web server
- MySQL database on same server
- File-based sessions and logs

### Recommended Modern Deployment

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Load Balancer  │    │    CDN/Cache    │    │   Monitoring    │
│                 │    │                 │    │                 │
│ - SSL Term      │    │ - Static assets │    │ - Health checks │
│ - Rate limiting │    │ - Edge caching  │    │ - Alerting      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────────┐
│                        Container Orchestration                       │
│                            (Kubernetes)                             │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │   Web App   │  │   API Svc   │  │ Worker Pods │  │   Frontend  ││
│  │   Pods      │  │   Pods      │  │             │  │   Pods      ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│
└─────────────────────────────────────────────────────────────────────┘
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Database     │    │     Cache       │    │  Message Queue  │
│                 │    │                 │    │                 │
│ - PostgreSQL    │    │ - Redis         │    │ - RabbitMQ      │
│ - Read replicas │    │ - Session store │    │ - Event stream  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

This architecture provides high availability, horizontal scaling, and separation of concerns necessary for a modern voting system handling potentially thousands of concurrent users during major AEGEE events.
