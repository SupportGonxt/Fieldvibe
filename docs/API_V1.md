# FieldVibe API Documentation

**Version:** 1.0.0  
**API Version:** v1  
**Base URL:** `https://fieldvibe.vantax.co.za/api/v1`  
**Last Updated:** 2026-03-27

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Endpoints](#endpoints)
6. [Webhooks](#webhooks)
7. [SDKs & Libraries](#sdks--libraries)

---

## Overview

FieldVibe API follows RESTful conventions and returns JSON responses. All API access is over HTTPS.

### Request Format

```http
Content-Type: application/json
Authorization: Bearer <token>
```

### Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-03-27T10:00:00Z"
  }
}
```

### Pagination

List endpoints support pagination:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1000,
    "totalPages": 20
  }
}
```

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 50, max: 100) - Items per page

---

## Authentication

### Overview

FieldVibe uses JWT (JSON Web Tokens) for authentication. Tokens must be included in the `Authorization` header.

### Getting a Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600,
    "token_type": "Bearer",
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "role": "agent"
    }
  }
}
```

### Using the Token

Include the token in all requests:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Token Expiration

- **Access Token:** 1 hour
- **Refresh Token:** 7 days

### Refreshing Tokens

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Multi-Factor Authentication (MFA)

If MFA is enabled, the login response will indicate MFA is required:

```json
{
  "success": false,
  "error": {
    "code": "MFA_REQUIRED",
    "message": "Multi-factor authentication required",
    "mfa_methods": ["totp", "sms"]
  }
}
```

Submit MFA code:

```http
POST /auth/mfa/verify
Content-Type: application/json

{
  "session_id": "sess_abc123",
  "code": "123456",
  "method": "totp"
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "requestId": "req_abc123"
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid input data |
| `UNAUTHORIZED` | Missing or invalid authentication |
| `TOKEN_EXPIRED` | JWT token has expired |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource conflict |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `DATABASE_ERROR` | Database operation failed |
| `INTERNAL_ERROR` | Unexpected server error |

---

## Rate Limiting

### Limits

- **Default:** 100 requests per 15 minutes
- **Per IP:** Applied based on IP address
- **Per Endpoint:** Some endpoints have specific limits

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1679900000
```

### Rate Limit Exceeded

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "retryAfter": 300
  }
}
```

---

## Endpoints

### Authentication

#### POST /auth/login

Authenticate user and get tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** 200 OK

---

#### POST /auth/register

Register a new user (if enabled for tenant).

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response:** 201 Created

---

#### POST /auth/refresh

Refresh access token.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:** 200 OK

---

#### POST /auth/forgot-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:** 200 OK

---

#### POST /auth/reset-password

Reset password with token.

**Request:**
```json
{
  "token": "reset_token_abc123",
  "password": "newpassword123"
}
```

**Response:** 200 OK

---

### Users

#### GET /users/me

Get current user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "agent",
    "tenant_id": "tenant_456",
    "mfa_enabled": false
  }
}
```

---

#### PUT /users/me

Update current user profile.

**Request:**
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "+1234567890"
}
```

**Response:** 200 OK

---

#### GET /users/me/sessions

Get active sessions.

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "sess_abc123",
        "device_id": "device_xyz",
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "created_at": "2026-03-27T10:00:00Z",
        "last_activity_at": "2026-03-27T12:00:00Z"
      }
    ]
  }
}
```

---

#### DELETE /users/me/sessions/:sessionId

Revoke a session.

**Response:** 200 OK

---

### Field Operations

#### Visits

##### GET /field-ops/visits

List visits with filtering.

**Query Parameters:**
- `status` - Filter by status (planned, completed, etc.)
- `agent_id` - Filter by agent
- `customer_id` - Filter by customer
- `start_date` - Filter by start date
- `end_date` - Filter by end date
- `visit_type` - Filter by type (store, individual)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": { ... }
}
```

---

##### GET /field-ops/visits/:id

Get visit details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "visit_123",
    "agent_id": "agent_456",
    "customer_id": "customer_789",
    "visit_type": "store",
    "status": "completed",
    "scheduled_at": "2026-03-27T10:00:00Z",
    "completed_at": "2026-03-27T10:45:00Z",
    "duration_minutes": 45,
    "notes": "Visit completed successfully",
    "photos": [...],
    "survey_responses": { ... }
  }
}
```

---

##### POST /field-ops/visits

Create a new visit.

**Request:**
```json
{
  "agent_id": "agent_456",
  "customer_id": "customer_789",
  "visit_type": "store",
  "scheduled_at": "2026-03-28T10:00:00Z",
  "notes": "Scheduled follow-up visit"
}
```

**Response:** 201 Created

---

##### PUT /field-ops/visits/:id

Update a visit.

**Request:**
```json
{
  "status": "completed",
  "notes": "Visit completed",
  "completed_at": "2026-03-27T10:45:00Z"
}
```

**Response:** 200 OK

---

##### DELETE /field-ops/visits/:id

Cancel/delete a visit.

**Response:** 204 No Content

---

### Admin

#### Users (Admin Only)

##### GET /admin/users

List all users (tenant-scoped).

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": { ... }
}
```

---

##### POST /admin/users

Create a new user.

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "first_name": "New",
  "last_name": "User",
  "role": "agent"
}
```

**Response:** 201 Created

---

##### GET /admin/users/:id

Get user details.

**Response:** 200 OK

---

##### PUT /admin/users/:id

Update user.

**Response:** 200 OK

---

##### DELETE /admin/users/:id

Delete user.

**Response:** 204 No Content

---

#### Tenants (Superadmin Only)

##### GET /admin/tenants

List all tenants.

**Response:**
```json
{
  "success": true,
  "data": [...]
}
```

---

##### POST /admin/tenants

Create new tenant.

**Request:**
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp",
  "subscription_plan": "professional"
}
```

**Response:** 201 Created

---

### Health & Status

#### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "v1",
  "timestamp": "2026-03-27T10:00:00Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 5
    },
    "memory": {
      "status": "healthy",
      "rss": 52428800
    }
  }
}
```

---

#### GET /version

Get API version info.

**Response:**
```json
{
  "version": "1.0.0",
  "apiVersion": "v1",
  "buildDate": "2026-03-27",
  "environment": "production"
}
```

---

## Webhooks

### Overview

Webhooks allow you to receive real-time notifications about events in FieldVibe.

### Available Events

| Event | Description |
|-------|-------------|
| `visit.created` | New visit created |
| `visit.completed` | Visit completed |
| `order.created` | New order created |
| `order.delivered` | Order delivered |
| `user.created` | New user registered |
| `commission.calculated` | Commission calculated |

### Webhook Payload

```json
{
  "id": "evt_abc123",
  "type": "visit.completed",
  "created_at": "2026-03-27T10:00:00Z",
  "tenant_id": "tenant_456",
  "data": {
    "id": "visit_789",
    "status": "completed",
    "agent_id": "agent_123"
  }
}
```

### Webhook Signature

All webhook requests include a signature header:

```http
X-FieldVibe-Signature: sha256=abc123...
```

Verify the signature using your webhook secret.

---

## SDKs & Libraries

### JavaScript/TypeScript

```bash
npm install @fieldvibe/sdk
```

```javascript
import { FieldVibeClient } from '@fieldvibe/sdk';

const client = new FieldVibeClient({
  apiKey: 'your_api_key'
});

const visits = await client.visits.list({
  status: 'completed',
  limit: 50
});
```

### Python

```bash
pip install fieldvibe
```

```python
from fieldvibe import FieldVibeClient

client = FieldVibeClient(api_key='your_api_key')
visits = client.visits.list(status='completed', limit=50)
```

### REST Examples

#### cURL

```bash
curl -X GET "https://fieldvibe.vantax.co.za/api/v1/field-ops/visits" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Python (requests)

```python
import requests

headers = {'Authorization': f'Bearer {token}'}
response = requests.get(f'{base_url}/field-ops/visits', headers=headers)
visits = response.json()
```

---

## Support

- **Documentation:** https://docs.fieldvibe.com
- **API Status:** https://status.fieldvibe.com
- **Support Email:** api-support@fieldvibe.com
- **Developer Forum:** https://community.fieldvibe.com

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-27
