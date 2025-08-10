# Technical Implementation Guide

## Overview

This document provides detailed technical guidance for implementing new microservices in the MyAEGEE platform, specifically focusing on the Proposals and Votings microservices for the voting system rewrite.

## Development Standards

### Technology Stack for New Services

**Recommended Stack for TypeScript Services:**

- **Runtime**: Node.js (same as existing services)
- **Language**: TypeScript for better type safety and developer experience
- **Framework**: Express.js (consistency) or Fastify (performance)
- **ORM**: Prisma (recommended) or TypeORM for better TypeScript support
- **Validation**: Zod for runtime type validation
- **HTTP Client**: Axios for service communication
- **Testing**: Jest with supertest for integration testing
- **Documentation**: OpenAPI/Swagger for API documentation

### Project Structure

Follow the established pattern from existing services:

```
service-name/
├── src/
│   ├── config/
│   │   └── index.ts           # Environment configuration
│   ├── lib/
│   │   ├── server.ts          # Express server setup
│   │   ├── database.ts        # Database connection
│   │   ├── logger.ts          # Logging configuration
│   │   ├── auth.ts            # Authentication middleware
│   │   └── core-client.ts     # Core service client
│   ├── middlewares/
│   │   ├── authentication.ts  # Auth middleware
│   │   ├── validation.ts      # Request validation
│   │   └── error-handler.ts   # Error handling
│   ├── routes/
│   │   ├── index.ts           # Route definitions
│   │   └── [entity].ts        # Entity-specific routes
│   ├── models/
│   │   └── [entity].ts        # Database models
│   ├── services/
│   │   └── [entity].service.ts # Business logic
│   └── types/
│       └── index.ts           # TypeScript type definitions
├── migrations/
├── tests/
├── docker/
├── package.json
├── tsconfig.json
└── README.md
```

### Configuration Management

**Environment Configuration Pattern:**

```typescript
interface Config {
  port: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  core: {
    url: string;
    port: number;
    credentials?: {
      username: string;
      password: string;
    };
  };
  mailer: {
    url: string;
    port: number;
  };
  logger: {
    level: string;
    silent: boolean;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || "8084", 10),
  database: {
    host: process.env.DB_HOST || "postgres-service",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "secret",
    database: process.env.DB_DATABASE || "service_db",
  },
  core: {
    url: process.env.CORE_URL || "http://core",
    port: parseInt(process.env.CORE_PORT || "8084", 10),
  },
  // ... other configuration
};
```

## Authentication Implementation

### Service-to-Service Authentication

**Core Service Client:**

```typescript
interface ServiceRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string;
  body?: any;
  params?: Record<string, any>;
}

class CoreServiceClient {
  private baseUrl: string;

  constructor(config: { url: string; port: number }) {
    this.baseUrl = `${config.url}:${config.port}`;
  }

  async makeRequest(options: ServiceRequest): Promise<any> {
    const requestOptions = {
      url: options.url,
      method: options.method || "GET",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "X-Auth-Token": options.token,
        "X-Service": "proposals", // or 'votings'
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    };

    if (options.body) {
      requestOptions.data = options.body;
    }

    if (options.params) {
      requestOptions.params = options.params;
    }

    try {
      const response = await axios(requestOptions);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Core service request failed: ${error.message}`);
      }
      throw error;
    }
  }

  async getUserProfile(token: string, userId?: string): Promise<any> {
    const endpoint = userId ? `/members/${userId}` : "/members/me";
    return this.makeRequest({
      url: `${this.baseUrl}${endpoint}`,
      token,
    });
  }

  async getUserPermissions(token: string): Promise<any> {
    return this.makeRequest({
      url: `${this.baseUrl}/my_permissions`,
      token,
    });
  }

  async checkPermission(
    token: string,
    permission: string,
    objectId?: string
  ): Promise<boolean> {
    const response = await this.makeRequest({
      url: `${this.baseUrl}/my_permissions`,
      method: "POST",
      token,
      body: {
        action: permission.split(":")[0],
        object: permission.split(":")[1],
        object_id: objectId,
      },
    });

    return response.success && response.data.length > 0;
  }
}
```

### Authentication Middleware

**Express Middleware for Authentication:**

```typescript
interface AuthenticatedRequest extends Request {
  user?: any;
  permissions?: any[];
  coreService?: CoreServiceClient;
}

export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers["x-auth-token"] as string;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication token required",
      });
      return;
    }

    const coreService = new CoreServiceClient(config.core);

    // Fetch user profile and permissions in parallel
    const [userResponse, permissionsResponse] = await Promise.all([
      coreService.getUserProfile(token),
      coreService.getUserPermissions(token),
    ]);

    if (!userResponse.success) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
      return;
    }

    req.user = userResponse.data;
    req.permissions = permissionsResponse.data || [];
    req.coreService = coreService;

    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication service unavailable",
    });
  }
};

export const requirePermission = (permission: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.permissions) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const hasPermission = req.permissions.some(
      (p) =>
        p.combined === permission ||
        p.combined === `global:${permission}` ||
        p.combined === `local:${permission}`
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
};
```

## Database Integration

### Prisma Setup (Recommended)

**Schema Definition Example:**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Proposal {
  id                Int      @id @default(autoincrement())
  title             String
  description       String
  submitter_id      Int
  agora_id          Int
  status            ProposalStatus @default(DRAFT)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  amendments        Amendment[]
  votes             Vote[]

  @@map("proposals")
}

model Amendment {
  id           Int      @id @default(autoincrement())
  proposal_id  Int
  title        String
  description  String
  submitter_id Int
  status       AmendmentStatus @default(SUBMITTED)
  created_at   DateTime @default(now())

  proposal     Proposal @relation(fields: [proposal_id], references: [id])

  @@map("amendments")
}

enum ProposalStatus {
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
  VOTING
  PASSED
  FAILED
}

enum AmendmentStatus {
  SUBMITTED
  APPROVED
  REJECTED
  WITHDRAWN
}
```

**Database Service:**

```typescript
import { PrismaClient } from "@prisma/client";

class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: ["query", "error", "warn"],
    });
  }

  async connect(): Promise<void> {
    await this.prisma.$connect();
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  get client(): PrismaClient {
    return this.prisma;
  }
}

export const db = new DatabaseService();
```

## API Design Patterns

### RESTful API Standards

**Consistent Response Format:**

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Success response helper
export const successResponse = <T>(
  data: T,
  message?: string
): ApiResponse<T> => ({
  success: true,
  data,
  message,
});

// Error response helper
export const errorResponse = (
  message: string,
  errors?: ValidationError[]
): ApiResponse => ({
  success: false,
  message,
  errors,
});
```

**Route Handler Pattern:**

```typescript
export const createProposal = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    // Validate request
    const validationResult = createProposalSchema.safeParse(req.body);
    if (!validationResult.success) {
      res
        .status(400)
        .json(
          errorResponse("Validation failed", validationResult.error.errors)
        );
      return;
    }

    const proposalData = validationResult.data;

    // Check permissions
    const hasPermission = await req.coreService!.checkPermission(
      req.headers["x-auth-token"] as string,
      "create:proposal",
      proposalData.agora_id?.toString()
    );

    if (!hasPermission) {
      res.status(403).json(errorResponse("Insufficient permissions"));
      return;
    }

    // Business logic
    const proposal = await db.client.proposal.create({
      data: {
        ...proposalData,
        submitter_id: req.user!.id,
        status: "DRAFT",
      },
    });

    res
      .status(201)
      .json(successResponse(proposal, "Proposal created successfully"));
  } catch (error) {
    logger.error("Error creating proposal:", error);
    res.status(500).json(errorResponse("Internal server error"));
  }
};
```

### Input Validation with Zod

**Schema Definitions:**

```typescript
import { z } from "zod";

export const createProposalSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  agora_id: z.number().int().positive(),
  tags: z.array(z.string()).optional(),
});

export const updateProposalSchema = createProposalSchema.partial();

export const createAmendmentSchema = z.object({
  proposal_id: z.number().int().positive(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  reasoning: z.string().optional(),
});

// Type inference from schemas
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
export type CreateAmendmentInput = z.infer<typeof createAmendmentSchema>;
```

## Frontend Integration

### Service Registration

**Add to Frontend Services Configuration:**

```json
{
  "core": "/api/core",
  "events": "/api/events",
  "statutory": "/api/statutory",
  "mailer": "/api/mailer",
  "proposals": "/api/proposals",
  "votings": "/api/votings",
  "proposals-static": "/media/proposals",
  "votings-static": "/media/votings"
}
```

### Vue Component Patterns

**API Service Pattern:**

```javascript
// services/ProposalsService.js
export default {
  async getProposals(params = {}) {
    const response = await this.$http.get(
      this.services["proposals"] + "/proposals",
      { params }
    );
    return response.data;
  },

  async createProposal(proposalData) {
    const response = await this.$http.post(
      this.services["proposals"] + "/proposals",
      proposalData
    );
    return response.data;
  },

  async updateProposal(id, proposalData) {
    const response = await this.$http.put(
      this.services["proposals"] + `/proposals/${id}`,
      proposalData
    );
    return response.data;
  },

  async getProposal(id) {
    const response = await this.$http.get(
      this.services["proposals"] + `/proposals/${id}`
    );
    return response.data;
  },
};
```

**Vue Component Example:**

```vue
<template>
  <div class="proposals-list">
    <div class="level">
      <div class="level-left">
        <h1 class="title">Proposals</h1>
      </div>
      <div class="level-right">
        <router-link
          v-if="canCreateProposal"
          :to="{ name: 'proposals.create' }"
          class="button is-primary"
        >
          Create Proposal
        </router-link>
      </div>
    </div>

    <div class="proposals" v-if="proposals.length">
      <div
        v-for="proposal in proposals"
        :key="proposal.id"
        class="card proposal-card"
      >
        <div class="card-content">
          <h2 class="subtitle">{{ proposal.title }}</h2>
          <p>{{ proposal.description | truncate(200) }}</p>
          <div class="tags">
            <span class="tag" :class="statusClass(proposal.status)">
              {{ proposal.status }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <empty-table-stub v-else message="No proposals found" />
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import ProposalsService from "@/services/ProposalsService";

export default {
  name: "ProposalsList",
  data() {
    return {
      proposals: [],
      isLoading: false,
    };
  },
  computed: {
    ...mapGetters(["services", "user", "permissions"]),
    canCreateProposal() {
      return this.permissions.some((p) =>
        p.combined.includes("create:proposal")
      );
    },
  },
  methods: {
    async fetchProposals() {
      this.isLoading = true;
      try {
        const response = await ProposalsService.getProposals();
        if (response.success) {
          this.proposals = response.data;
        }
      } catch (error) {
        this.$buefy.toast.open({
          message: "Failed to load proposals",
          type: "is-danger",
        });
      } finally {
        this.isLoading = false;
      }
    },
    statusClass(status) {
      const classes = {
        DRAFT: "is-light",
        SUBMITTED: "is-info",
        UNDER_REVIEW: "is-warning",
        APPROVED: "is-success",
        REJECTED: "is-danger",
        VOTING: "is-primary",
        PASSED: "is-success",
        FAILED: "is-danger",
      };
      return classes[status] || "is-light";
    },
  },
  async mounted() {
    await this.fetchProposals();
  },
};
</script>
```

## Testing Strategy

### Unit Testing with Jest

**Service Test Example:**

```typescript
// tests/services/proposal.service.test.ts
import { ProposalService } from "../../src/services/proposal.service";
import { db } from "../../src/lib/database";

describe("ProposalService", () => {
  let proposalService: ProposalService;

  beforeAll(async () => {
    await db.connect();
    proposalService = new ProposalService();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await db.client.proposal.deleteMany();
  });

  describe("createProposal", () => {
    it("should create a proposal successfully", async () => {
      const proposalData = {
        title: "Test Proposal",
        description: "Test Description",
        submitter_id: 1,
        agora_id: 1,
      };

      const result = await proposalService.create(proposalData);

      expect(result.id).toBeDefined();
      expect(result.title).toBe(proposalData.title);
      expect(result.status).toBe("DRAFT");
    });

    it("should validate required fields", async () => {
      const proposalData = {
        title: "",
        description: "Test Description",
      };

      await expect(proposalService.create(proposalData as any)).rejects.toThrow(
        "Title is required"
      );
    });
  });
});
```

### Integration Testing

**API Endpoint Test:**

```typescript
// tests/api/proposals.test.ts
import request from "supertest";
import { app } from "../../src/lib/server";
import { db } from "../../src/lib/database";

describe("Proposals API", () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe("POST /proposals", () => {
    it("should create a proposal with valid data", async () => {
      const proposalData = {
        title: "Test Proposal",
        description: "Test Description",
        agora_id: 1,
      };

      const response = await request(app)
        .post("/proposals")
        .set("X-Auth-Token", "valid-token")
        .send(proposalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(proposalData.title);
    });

    it("should return 401 without auth token", async () => {
      const proposalData = {
        title: "Test Proposal",
        description: "Test Description",
        agora_id: 1,
      };

      await request(app).post("/proposals").send(proposalData).expect(401);
    });
  });
});
```

## Deployment Considerations

### Docker Configuration

**Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /usr/app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8084

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8084/healthcheck || exit 1

# Start application
CMD ["npm", "start"]
```

### Environment Variables

**Required Environment Variables:**

```bash
# Database
DB_HOST=postgres-proposals
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=secret
DB_DATABASE=proposals

# Core Service
CORE_URL=http://core
CORE_PORT=8084

# Application
PORT=8084
NODE_ENV=production
LOG_LEVEL=info

# JWT (if needed for direct validation)
JWT_SECRET=your-jwt-secret
```

This implementation guide provides the foundation for developing TypeScript-based microservices that integrate seamlessly with the existing MyAEGEE architecture while following modern development practices and maintaining consistency with the established patterns.
