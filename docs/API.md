# FieldVibe API Documentation

## Overview

FieldVibe API is a RESTful API built with Hono.js on Cloudflare Workers, providing backend services for field force management, trade marketing, and sales operations.

**Base URL:** `https://fieldvibe-api.vantax.co.za/api`

---

## Authentication

All API requests (except public endpoints) require authentication via Bearer token.

### Headers
```
Authorization: Bearer <access_token>
X-Tenant-Code: <tenant_identifier>
```

### Token Acquisition
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "expires_in": 3600,
    "user": { ... }
  }
}
```

---

## Error Handling

All errors follow a standardized response format:

### Error Response Schema
```json
{
  "success": false,
  "error": {
    "message": "User-friendly error message",
    "type": "validation|database|authentication|authorization|not_found|internal",
    "status": 400,
    "timestamp": "2024-03-24T12:00:00.000Z",
    "field": "optional_field_name",
    "originalError": "Original error message (for debugging)"
  }
}
```

### HTTP Status Codes

| Code | Type | Description |
|------|------|-------------|
| 400 | Bad Request | Invalid input, validation failed |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Unique constraint violation |
| 500 | Internal Server Error | Server-side error |

### Common Error Types

#### 1. Validation Errors (400)
```json
{
  "success": false,
  "error": {
    "message": "Required field 'email' is missing.",
    "type": "validation",
    "status": 400,
    "field": "email"
  }
}
```

#### 2. Database Errors (500)
```json
{
  "success": false,
  "error": {
    "message": "Database operation failed. Please try again.",
    "type": "database",
    "status": 500
  }
}
```

#### 3. Authentication Errors (401)
```json
{
  "success": false,
  "error": {
    "message": "Invalid or expired token.",
    "type": "authentication",
    "status": 401
  }
}
```

#### 4. Authorization Errors (403)
```json
{
  "success": false,
  "error": {
    "message": "Insufficient permissions to access this resource.",
    "type": "authorization",
    "status": 403
  }
}
```

#### 5. Not Found Errors (404)
```json
{
  "success": false,
  "error": {
    "message": "Resource not found.",
    "type": "not_found",
    "status": 404
  }
}
```

---

## API Endpoints

### Authentication

#### POST `/auth/login`
Authenticate user and obtain tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "expires_in": 3600,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "agent",
      "tenant_id": "uuid"
    }
  }
}
```

#### POST `/auth/refresh`
Refresh access token.

**Request:**
```json
{
  "refresh_token": "eyJhbGc..."
}
```

---

### Agent Dashboard

#### GET `/agent/dashboard`
Get agent dashboard statistics.

**Headers:**
```
Authorization: Bearer <token>
X-Tenant-Code: <tenant>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "today_visits": 8,
    "month_visits": 120,
    "today_regs": 4,
    "month_regs": 60,
    "recent_visits": [...],
    "companies": [...],
    "targets": [...],
    "visit_breakdown": [...],
    "week_visits": 25,
    "week_regs": 12,
    "daily_individual_target": 8,
    "daily_target_visits": 8,
    "daily_actual_visits": 5,
    "streak": 3
  }
}
```

**Errors:**
- 401: Unauthorized - Missing or invalid token
- 500: Database error - Failed to fetch dashboard data

---

#### GET `/agent/performance`
Get agent performance metrics and targets.

**Response:**
```json
{
  "success": true,
  "data": {
    "monthly_targets": [
      {
        "company_id": "uuid",
        "company_name": "Goldrush",
        "target_visits": 80,
        "target_registrations": 40,
        "actual_visits": 45,
        "actual_registrations": 22,
        "achievement_pct": 56
      }
    ],
    "total_target_visits": 80,
    "total_actual_visits": 45,
    "overall_achievement": 56,
    "daily_individual_target": 8,
    "weekly_individual_visits": [...],
    "commission_pending": 150.00,
    "commission_approved": 300.00,
    "commission_paid": 500.00,
    "recent_commissions": [...]
  }
}
```

**Errors:**
- 401: Unauthorized
- 404: No targets found - Agent not assigned to any company
- 500: Database error

---

### Field Operations

#### GET `/visits`
List visits with pagination.

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20)
- `status` (string): Filter by status
- `visit_type` (string): Filter by type
- `date_from` (string): Start date (ISO 8601)
- `date_to` (string): End date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "visits": [...],
    "total": 150,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  }
}
```

---

#### POST `/visits`
Create a new visit.

**Request:**
```json
{
  "customer_id": "uuid",
  "visit_type": "individual",
  "visit_date": "2024-03-24",
  "latitude": -26.106,
  "longitude": 28.056,
  "answers": {
    "brand_awareness": "Yes",
    "stocks_product": "Yes"
  },
  "photos": ["photo1.jpg", "photo2.jpg"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "customer_id": "uuid",
    "visit_type": "individual",
    "status": "completed",
    "created_at": "2024-03-24T12:00:00Z"
  }
}
```

**Errors:**
- 400: Validation error - Missing required fields
- 409: Duplicate visit - Visit already exists for this customer/date
- 500: Database error

---

### Customers

#### GET `/customers`
List customers.

**Query Parameters:**
- `page`, `limit`, `search`, `customer_type`

**Response:**
```json
{
  "success": true,
  "data": {
    "customers": [...],
    "total": 500,
    "page": 1,
    "limit": 20
  }
}
```

---

#### POST `/customers`
Create a new customer.

**Request:**
```json
{
  "name": "Store Name",
  "customer_type": "retailer",
  "phone": "+27123456789",
  "address": "123 Main St",
  "latitude": -26.106,
  "longitude": 28.056
}
```

**Errors:**
- 400: Validation error
- 409: Duplicate customer (same name/phone)

---

### Reports

#### GET `/reports/sales`
Get sales report.

**Query Parameters:**
- `period` (string): `daily`, `weekly`, `monthly`
- `date_from`, `date_to`
- `group_by` (string): `day`, `week`, `month`, `customer`

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_sales": 15000,
      "total_orders": 120,
      "avg_order_value": 125
    },
    "breakdown": [...],
    "trends": [...]
  }
}
```

---

### Settings

#### GET `/settings`
Get tenant settings.

**Response:**
```json
{
  "success": true,
  "data": {
    "mobile_show_earnings": "true",
    "enable_ai_features": "false",
    "default_visit_type": "individual",
    "commission_enabled": "true"
  }
}
```

---

### AI Features (Optional)

#### GET `/ai/field-agents/:agentId/insights`
Get AI-powered agent performance insights.

**Requires:** `VITE_ENABLE_AI=true` and running Ollama instance

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "insight_1",
      "module": "field_agents",
      "type": "trend",
      "title": "Performance Trending Up",
      "description": "Agent performance improved by 15%",
      "confidence": 0.89,
      "severity": "medium",
      "data": { "improvement": 15 },
      "created_at": "2024-03-24T12:00:00Z"
    }
  ]
}
```

**Errors:**
- 400: AI features disabled
- 503: AI service unavailable

---

## Rate Limiting

API requests are rate-limited per tenant:
- **Default:** 100 requests per minute
- **Headers:**
  - `X-RateLimit-Limit`: Maximum requests
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

**Rate Limit Error:**
```json
{
  "success": false,
  "error": {
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "type": "rate_limit",
    "status": 429,
    "retry_after": 60
  }
}
```

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response Format:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 150,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  }
}
```

---

## Versioning

API version is included in responses:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "api_version": "1.0.0",
    "timestamp": "2024-03-24T12:00:00Z"
  }
}
```

---

## Best Practices

### 1. Error Handling in Client Code
```javascript
try {
  const response = await apiClient.get('/agent/dashboard');
  if (response.data.success) {
    // Use response.data.data
  } else {
    // Handle API error
    console.error(response.data.error.message);
  }
} catch (error) {
  if (error.response?.status === 401) {
    // Redirect to login
  } else if (error.response?.status === 429) {
    // Wait and retry
  } else {
    // Show error toast
    toast.error('Request failed');
  }
}
```

### 2. Request Deduplication
Use the built-in request deduplication in `api.service.ts` to prevent duplicate calls.

### 3. Caching
Leverage the stale-while-revalidate cache for dashboard endpoints:
- Fresh data (2 min): Returned immediately
- Stale data (5 min): Returned immediately, revalidated in background

### 4. Offline Mode
Enable offline mode for field agents:
```javascript
// Enable in .env
VITE_ENABLE_OFFLINE_MODE=true
```

---

## Support

For API issues or questions:
- **GitHub:** https://github.com/Reshigan/Fieldvibe
- **Email:** support@fieldvibe.com
- **Documentation:** https://docs.fieldvibe.com

---

## Changelog

### v1.0.0 (2024-03-24)
- Initial release
- Agent dashboard & performance endpoints
- Field operations CRUD
- Customer management
- AI features (optional)
- Error handling improvements
- Performance optimizations
