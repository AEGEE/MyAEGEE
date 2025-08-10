# API Design Standards

## Overview

This document establishes consistent API design patterns across all MyAEGEE microservices, ensuring uniformity in request/response formats, error handling, authentication, and documentation standards.

## General API Principles

### RESTful Design

**Resource-Based URLs:**

- Use nouns, not verbs: `/proposals` not `/getProposals`
- Use HTTP methods to indicate action: `GET`, `POST`, `PUT`, `DELETE`
- Use plural nouns for collections: `/proposals`, `/amendments`
- Use nested resources for relationships: `/proposals/{id}/amendments`

**HTTP Methods:**

- `GET`: Retrieve resource(s)
- `POST`: Create new resource
- `PUT`: Update entire resource
- `PATCH`: Partial update (if needed)
- `DELETE`: Remove resource

**Status Codes:**

- `200 OK`: Successful GET, PUT
- `201 Created`: Successful POST
- `204 No Content`: Successful DELETE
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation errors
- `500 Internal Server Error`: Server error

## Request/Response Format

### Standard Response Structure

**Success Response:**

```json
{
  "success": true,
  "data": {
    // Response data - object or array
  },
  "message": "Optional success message",
  "meta": {
    "total": 150, // Total items (for pagination)
    "page": 1, // Current page
    "limit": 20, // Items per page
    "pages": 8 // Total pages
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "Human-readable error message",
  "errors": [
    {
      "field": "name",
      "message": "Name is required",
      "code": "REQUIRED_FIELD"
    },
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "INVALID_FORMAT"
    }
  ],
  "error_code": "VALIDATION_ERROR"
}
```

### TypeScript Interfaces

**Response Types:**

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: ResponseMeta;
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: ValidationError[];
  error_code?: string;
}

interface ResponseMeta {
  total?: number;
  page?: number;
  limit?: number;
  pages?: number;
  has_next?: boolean;
  has_prev?: boolean;
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

**Helper Functions:**

```typescript
export const successResponse = <T>(
  data: T,
  message?: string,
  meta?: ResponseMeta
): ApiResponse<T> => ({
  success: true,
  data,
  message,
  meta,
});

export const errorResponse = (
  message: string,
  errors?: ValidationError[],
  errorCode?: string
): ErrorResponse => ({
  success: false,
  message,
  errors,
  error_code: errorCode,
});

export const validationError = (errors: ValidationError[]): ErrorResponse => ({
  success: false,
  message: "Validation failed",
  errors,
  error_code: "VALIDATION_ERROR",
});
```

## Pagination Standards

### Query Parameters

**Standard Pagination Parameters:**

```
GET /proposals?limit=20&offset=0&page=1
```

**Parameters:**

- `limit`: Number of items per page (default: 20, max: 100)
- `offset`: Number of items to skip
- `page`: Page number (alternative to offset)

**Implementation:**

```typescript
interface PaginationQuery {
  limit?: number;
  offset?: number;
  page?: number;
}

const parsePagination = (query: PaginationQuery) => {
  const limit = Math.min(Number(query.limit) || 20, 100);
  const page = Number(query.page) || 1;
  const offset =
    query.offset !== undefined ? Number(query.offset) : (page - 1) * limit;

  return { limit, offset, page };
};

const paginatedResponse = <T>(
  data: T[],
  total: number,
  { limit, offset, page }: { limit: number; offset: number; page: number }
): ApiResponse<T[]> => {
  const pages = Math.ceil(total / limit);

  return successResponse(data, undefined, {
    total,
    page,
    limit,
    pages,
    has_next: page < pages,
    has_prev: page > 1,
  });
};
```

## Filtering and Sorting

### Query Parameters

**Filtering:**

```
GET /proposals?status=published&submitter_id=123&search=democracy
```

**Sorting:**

```
GET /proposals?sort=created_at&order=desc
GET /proposals?sort=-created_at  // Alternative syntax
```

**Date Filtering:**

```
GET /proposals?created_after=2024-01-01&created_before=2024-12-31
```

### Implementation

**Filter Parser:**

```typescript
interface FilterQuery {
  status?: string;
  submitter_id?: number;
  search?: string;
  created_after?: string;
  created_before?: string;
  [key: string]: any;
}

const parseFilters = (query: FilterQuery) => {
  const filters: Record<string, any> = {};

  // String filters
  if (query.status) filters.status = query.status;
  if (query.search) {
    filters.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  // Number filters
  if (query.submitter_id) filters.submitter_id = Number(query.submitter_id);

  // Date filters
  if (query.created_after || query.created_before) {
    filters.created_at = {};
    if (query.created_after)
      filters.created_at.gte = new Date(query.created_after);
    if (query.created_before)
      filters.created_at.lte = new Date(query.created_before);
  }

  return filters;
};

const parseSorting = (sort?: string, order?: string) => {
  if (!sort) return { created_at: "desc" };

  const direction = order === "asc" ? "asc" : "desc";

  // Handle negative syntax (e.g., -created_at)
  if (sort.startsWith("-")) {
    return { [sort.substring(1)]: "desc" };
  }

  return { [sort]: direction };
};
```

## Authentication Headers

### Required Headers

**Standard Headers:**

```
X-Auth-Token: <access_token>      // User authentication
X-Service: proposals              // Calling service identifier
X-Requested-With: XMLHttpRequest  // AJAX indicator
Content-Type: application/json    // Content type
```

**Optional Headers:**

```
X-For-Auth: true                  // Skip token refresh
X-Request-ID: <uuid>              // Request tracing
```

### Authentication Middleware

```typescript
interface AuthenticatedRequest extends Request {
  user?: User;
  permissions?: Permission[];
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
      res
        .status(401)
        .json(
          errorResponse(
            "Authentication token required",
            [],
            "AUTH_TOKEN_MISSING"
          )
        );
      return;
    }

    const coreService = new CoreServiceClient(config.core);

    // Fetch user and permissions
    const [userResponse, permissionsResponse] = await Promise.all([
      coreService.getUserProfile(token),
      coreService.getUserPermissions(token),
    ]);

    if (!userResponse.success) {
      res
        .status(401)
        .json(
          errorResponse("Invalid authentication token", [], "INVALID_TOKEN")
        );
      return;
    }

    req.user = userResponse.data;
    req.permissions = permissionsResponse.data || [];
    req.coreService = coreService;

    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    res
      .status(500)
      .json(
        errorResponse(
          "Authentication service unavailable",
          [],
          "AUTH_SERVICE_ERROR"
        )
      );
  }
};
```

## Input Validation

### Validation Schemas

**Using Zod for Validation:**

```typescript
import { z } from "zod";

// Base schemas
const idSchema = z.number().int().positive();
const dateSchema = z.string().datetime().or(z.date());
const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  page: z.number().int().min(1).optional(),
});

// Proposal schemas
export const createProposalSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  agora_id: idSchema,
  type: z.enum(["ordinary", "constitutional", "urgent"]).optional(),
  tags: z.array(z.string()).optional(),
  deadline: dateSchema.optional(),
});

export const updateProposalSchema = createProposalSchema.partial();

export const proposalQuerySchema = z.object({
  ...paginationSchema.shape,
  status: z
    .enum(["draft", "submitted", "under_review", "approved", "rejected"])
    .optional(),
  submitter_id: idSchema.optional(),
  agora_id: idSchema.optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

// Amendment schemas
export const createAmendmentSchema = z.object({
  proposal_id: idSchema,
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  reasoning: z.string().optional(),
  type: z.enum(["addition", "deletion", "modification"]),
  target_section: z.string().optional(),
});
```

### Validation Middleware

```typescript
export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        return res.status(422).json(validationError(errors));
      }

      req.body = result.data;
      next();
    } catch (error) {
      res
        .status(500)
        .json(errorResponse("Validation error", [], "VALIDATION_FAILED"));
    }
  };
};

export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json(validationError(errors));
      }

      req.query = result.data;
      next();
    } catch (error) {
      res
        .status(500)
        .json(
          errorResponse("Query validation error", [], "QUERY_VALIDATION_FAILED")
        );
    }
  };
};
```

## Permission Checking

### Permission Middleware

```typescript
export const requirePermission = (
  permission: string,
  objectIdParam?: string
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.permissions) {
      res
        .status(401)
        .json(errorResponse("Authentication required", [], "AUTH_REQUIRED"));
      return;
    }

    // Extract object ID if specified
    const objectId = objectIdParam ? req.params[objectIdParam] : undefined;

    try {
      // Check permission with core service
      const hasPermission = await req.coreService!.checkPermission(
        req.headers["x-auth-token"] as string,
        permission,
        objectId
      );

      if (!hasPermission) {
        res
          .status(403)
          .json(
            errorResponse(
              "Insufficient permissions",
              [],
              "INSUFFICIENT_PERMISSIONS"
            )
          );
        return;
      }

      next();
    } catch (error) {
      logger.error("Permission check error:", error);
      res
        .status(500)
        .json(
          errorResponse(
            "Permission check failed",
            [],
            "PERMISSION_CHECK_FAILED"
          )
        );
    }
  };
};

// Usage examples:
// router.post('/proposals', requirePermission('create:proposal'));
// router.put('/proposals/:id', requirePermission('edit:proposal', 'id'));
```

### Resource-Specific Permission Checks

```typescript
export const checkProposalPermission = (action: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const proposalId = req.params.id;

    try {
      const proposal = await db.proposal.findUnique({
        where: { id: Number(proposalId) },
      });

      if (!proposal) {
        res
          .status(404)
          .json(errorResponse("Proposal not found", [], "PROPOSAL_NOT_FOUND"));
        return;
      }

      // Check general permission
      const hasGeneralPermission = await req.coreService!.checkPermission(
        req.headers["x-auth-token"] as string,
        `${action}:proposal`
      );

      // Check if user owns the proposal (for certain actions)
      const isOwner = proposal.submitter_id === req.user!.id;
      const canEditOwn =
        action === "edit" && proposal.status === "DRAFT" && isOwner;

      if (!hasGeneralPermission && !canEditOwn) {
        res
          .status(403)
          .json(
            errorResponse(
              "Insufficient permissions",
              [],
              "INSUFFICIENT_PERMISSIONS"
            )
          );
        return;
      }

      // Attach proposal to request for use in handler
      (req as any).proposal = proposal;
      next();
    } catch (error) {
      logger.error("Proposal permission check error:", error);
      res
        .status(500)
        .json(
          errorResponse(
            "Permission check failed",
            [],
            "PERMISSION_CHECK_FAILED"
          )
        );
    }
  };
};
```

## Route Handlers

### Standard Route Handler Pattern

```typescript
// GET /proposals
export const getProposals = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { limit, offset, page } = parsePagination(req.query as any);
    const filters = parseFilters(req.query as any);
    const orderBy = parseSorting(
      req.query.sort as string,
      req.query.order as string
    );

    // Apply permission-based filters
    const permissionFilters = await getPermissionFilters(
      req.user!,
      req.permissions!,
      "view:proposal"
    );
    const combinedFilters = { ...filters, ...permissionFilters };

    // Fetch data
    const [proposals, total] = await Promise.all([
      db.proposal.findMany({
        where: combinedFilters,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          submitter: {
            select: { id: true, first_name: true, last_name: true },
          },
          agora: {
            select: { id: true, name: true, starts: true },
          },
          _count: {
            select: { amendments: true, votes: true },
          },
        },
      }),
      db.proposal.count({ where: combinedFilters }),
    ]);

    res.json(paginatedResponse(proposals, total, { limit, offset, page }));
  } catch (error) {
    logger.error("Error fetching proposals:", error);
    res
      .status(500)
      .json(errorResponse("Failed to fetch proposals", [], "FETCH_ERROR"));
  }
};

// POST /proposals
export const createProposal = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const proposalData = {
      ...req.body,
      submitter_id: req.user!.id,
      status: "DRAFT",
      created_at: new Date(),
      updated_at: new Date(),
    };

    const proposal = await db.proposal.create({
      data: proposalData,
      include: {
        submitter: {
          select: { id: true, first_name: true, last_name: true },
        },
        agora: {
          select: { id: true, name: true },
        },
      },
    });

    // Log activity
    await logActivity({
      user_id: req.user!.id,
      action: "create",
      resource: "proposal",
      resource_id: proposal.id,
      details: { title: proposal.title },
    });

    res
      .status(201)
      .json(successResponse(proposal, "Proposal created successfully"));
  } catch (error) {
    logger.error("Error creating proposal:", error);

    if (error.code === "P2002") {
      // Unique constraint violation
      res
        .status(422)
        .json(
          errorResponse(
            "Proposal with this title already exists",
            [],
            "DUPLICATE_TITLE"
          )
        );
    } else {
      res
        .status(500)
        .json(errorResponse("Failed to create proposal", [], "CREATE_ERROR"));
    }
  }
};

// GET /proposals/:id
export const getProposal = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const proposalId = Number(req.params.id);

    const proposal = await db.proposal.findUnique({
      where: { id: proposalId },
      include: {
        submitter: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        agora: {
          select: { id: true, name: true, starts: true, ends: true },
        },
        amendments: {
          include: {
            submitter: {
              select: { id: true, first_name: true, last_name: true },
            },
          },
          orderBy: { created_at: "asc" },
        },
        votes: {
          select: { id: true, vote: true, created_at: true },
        },
      },
    });

    if (!proposal) {
      res
        .status(404)
        .json(errorResponse("Proposal not found", [], "PROPOSAL_NOT_FOUND"));
      return;
    }

    // Check view permission
    const canView = await req.coreService!.checkPermission(
      req.headers["x-auth-token"] as string,
      "view:proposal",
      proposalId.toString()
    );

    if (!canView) {
      res
        .status(403)
        .json(
          errorResponse(
            "Insufficient permissions to view this proposal",
            [],
            "INSUFFICIENT_PERMISSIONS"
          )
        );
      return;
    }

    res.json(successResponse(proposal));
  } catch (error) {
    logger.error("Error fetching proposal:", error);
    res
      .status(500)
      .json(errorResponse("Failed to fetch proposal", [], "FETCH_ERROR"));
  }
};

// PUT /proposals/:id
export const updateProposal = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const proposal = (req as any).proposal; // Attached by middleware

    // Check if proposal can be edited
    if (proposal.status !== "DRAFT" && proposal.status !== "UNDER_REVIEW") {
      res
        .status(422)
        .json(
          errorResponse(
            "Proposal cannot be edited in its current status",
            [],
            "INVALID_STATUS"
          )
        );
      return;
    }

    const updatedProposal = await db.proposal.update({
      where: { id: proposal.id },
      data: {
        ...req.body,
        updated_at: new Date(),
      },
      include: {
        submitter: {
          select: { id: true, first_name: true, last_name: true },
        },
        agora: {
          select: { id: true, name: true },
        },
      },
    });

    // Log activity
    await logActivity({
      user_id: req.user!.id,
      action: "update",
      resource: "proposal",
      resource_id: proposal.id,
      details: { changes: req.body },
    });

    res.json(successResponse(updatedProposal, "Proposal updated successfully"));
  } catch (error) {
    logger.error("Error updating proposal:", error);
    res
      .status(500)
      .json(errorResponse("Failed to update proposal", [], "UPDATE_ERROR"));
  }
};

// DELETE /proposals/:id
export const deleteProposal = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const proposal = (req as any).proposal; // Attached by middleware

    // Check if proposal can be deleted
    if (proposal.status !== "DRAFT") {
      res
        .status(422)
        .json(
          errorResponse(
            "Only draft proposals can be deleted",
            [],
            "INVALID_STATUS"
          )
        );
      return;
    }

    await db.proposal.delete({
      where: { id: proposal.id },
    });

    // Log activity
    await logActivity({
      user_id: req.user!.id,
      action: "delete",
      resource: "proposal",
      resource_id: proposal.id,
      details: { title: proposal.title },
    });

    res.status(204).send();
  } catch (error) {
    logger.error("Error deleting proposal:", error);
    res
      .status(500)
      .json(errorResponse("Failed to delete proposal", [], "DELETE_ERROR"));
  }
};
```

## Error Handling

### Global Error Handler

```typescript
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error("Unhandled error:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    user: (req as any).user?.id,
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === "development";
  const message = isDevelopment ? error.message : "Internal server error";

  res.status(500).json(errorResponse(message, [], "INTERNAL_ERROR"));
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

## Route Organization

### Route Structure

```typescript
// routes/proposals.ts
import { Router } from "express";
import {
  authenticateUser,
  requirePermission,
  validateBody,
  validateQuery,
} from "../middlewares";
import {
  createProposalSchema,
  updateProposalSchema,
  proposalQuerySchema,
} from "../schemas";
import * as proposalHandlers from "../handlers/proposals";

const router = Router();

// Public routes (if any)
router.get(
  "/public",
  validateQuery(proposalQuerySchema),
  proposalHandlers.getPublicProposals
);

// Authenticated routes
router.use(authenticateUser);

router.get(
  "/",
  validateQuery(proposalQuerySchema),
  proposalHandlers.getProposals
);

router.post(
  "/",
  requirePermission("create:proposal"),
  validateBody(createProposalSchema),
  proposalHandlers.createProposal
);

router.get("/:id", proposalHandlers.getProposal);

router.put(
  "/:id",
  checkProposalPermission("edit"),
  validateBody(updateProposalSchema),
  proposalHandlers.updateProposal
);

router.delete(
  "/:id",
  checkProposalPermission("delete"),
  proposalHandlers.deleteProposal
);

// Nested resources
router.use("/:proposal_id/amendments", amendmentRoutes);
router.use("/:proposal_id/votes", voteRoutes);

export default router;
```

## API Documentation

### OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: Proposals API
  description: API for managing AEGEE statutory proposals
  version: 1.0.0
  contact:
    name: AEGEE IT Team
    email: it@aegee.eu

servers:
  - url: https://my.aegee.eu/api/proposals
    description: Production server
  - url: http://localhost:8084
    description: Development server

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Proposal:
      type: object
      required:
        - id
        - title
        - description
        - status
        - submitter_id
        - agora_id
        - created_at
        - updated_at
      properties:
        id:
          type: integer
          example: 123
        title:
          type: string
          maxLength: 255
          example: "Amendment to Article 5"
        description:
          type: string
          example: "This proposal aims to clarify the membership criteria..."
        status:
          type: string
          enum:
            [
              draft,
              submitted,
              under_review,
              approved,
              rejected,
              voting,
              passed,
              failed,
            ]
          example: "submitted"
        submitter_id:
          type: integer
          example: 456
        agora_id:
          type: integer
          example: 789
        created_at:
          type: string
          format: date-time
          example: "2024-01-15T10:30:00Z"
        updated_at:
          type: string
          format: date-time
          example: "2024-01-15T14:22:00Z"

    CreateProposalRequest:
      type: object
      required:
        - title
        - description
        - agora_id
      properties:
        title:
          type: string
          maxLength: 255
        description:
          type: string
        agora_id:
          type: integer
        type:
          type: string
          enum: [ordinary, constitutional, urgent]
          default: ordinary

    ApiResponse:
      type: object
      required:
        - success
      properties:
        success:
          type: boolean
        data:
          oneOf:
            - $ref: "#/components/schemas/Proposal"
            - type: array
              items:
                $ref: "#/components/schemas/Proposal"
        message:
          type: string
        meta:
          $ref: "#/components/schemas/ResponseMeta"

    ResponseMeta:
      type: object
      properties:
        total:
          type: integer
        page:
          type: integer
        limit:
          type: integer
        pages:
          type: integer

    ErrorResponse:
      type: object
      required:
        - success
        - message
      properties:
        success:
          type: boolean
          example: false
        message:
          type: string
          example: "Validation failed"
        errors:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
              code:
                type: string

security:
  - BearerAuth: []

paths:
  /proposals:
    get:
      summary: List proposals
      description: Get a paginated list of proposals
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
        - name: status
          in: query
          schema:
            type: string
            enum: [draft, submitted, under_review, approved, rejected]
        - name: search
          in: query
          schema:
            type: string
      responses:
        "200":
          description: Successful response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiResponse"
        "401":
          description: Authentication required
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"

    post:
      summary: Create proposal
      description: Create a new proposal
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateProposalRequest"
      responses:
        "201":
          description: Proposal created successfully
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiResponse"
        "422":
          description: Validation error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
```

This API design standard ensures consistency across all MyAEGEE microservices while providing clear patterns for authentication, validation, error handling, and documentation.
