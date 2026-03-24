# FieldVibe Error Response Schema

## Standard Error Response Format

All API errors follow this standardized schema for consistency and easy client-side handling.

### Root Schema
```typescript
interface ErrorResponse {
  success: false;
  error: ErrorObject;
}
```

### Error Object Schema
```typescript
interface ErrorObject {
  message: string;        // User-friendly error message
  type: ErrorType;        // Error category
  status: number;         // HTTP status code
  timestamp: string;      // ISO 8601 timestamp
  field?: string;         // Optional: field that caused the error
  table?: string;         // Optional: database table involved
  originalError?: string; // Optional: original error for debugging
  retryAfter?: number;    // Optional: seconds to wait (for rate limits)
}
```

### Error Types
```typescript
type ErrorType = 
  | 'validation'      // Invalid input data
  | 'database'        // Database operation failed
  | 'authentication'  // Invalid or missing auth token
  | 'authorization'   // Insufficient permissions
  | 'not_found'       // Resource does not exist
  | 'internal'        // Unexpected server error
  | 'external'        // External service failure
  | 'rate_limit';    // Too many requests
```

---

## Error Type Definitions

### 1. Validation Error (400)
**When:** Request data fails validation

**Schema:**
```typescript
{
  success: false;
  error: {
    message: "Required field 'email' is missing.";
    type: "validation";
    status: 400;
    field: "email";
    timestamp: "2024-03-24T12:00:00.000Z";
  }
}
```

**Common Causes:**
- Missing required fields
- Invalid data types
- Failed regex validation
- Constraint violations (UNIQUE, NOT NULL, CHECK)

---

### 2. Database Error (500)
**When:** Database operation fails

**Schema:**
```typescript
{
  success: false;
  error: {
    message: "Database operation failed. Please try again.";
    type: "database";
    status: 500;
    timestamp: "2024-03-24T12:00:00.000Z";
    originalError: "SQLITE_ERROR: no such table";
  }
}
```

**Common Causes:**
- Connection failures
- Query syntax errors
- Constraint violations
- Transaction deadlocks

---

### 3. Authentication Error (401)
**When:** Authentication fails

**Schema:**
```typescript
{
  success: false;
  error: {
    message: "Invalid or expired token.";
    type: "authentication";
    status: 401;
    timestamp: "2024-03-24T12:00:00.000Z";
  }
}
```

**Common Causes:**
- Missing Authorization header
- Expired JWT token
- Invalid token signature
- Token not in allowlist

---

### 4. Authorization Error (403)
**When:** User lacks permissions

**Schema:**
```typescript
{
  success: false;
  error: {
    message: "Insufficient permissions to access this resource.";
    type: "authorization";
    status: 403;
    timestamp: "2024-03-24T12:00:00.000Z";
    resource: "users";
    requiredRole: "admin";
  }
}
```

**Common Causes:**
- Wrong role type
- Tenant mismatch
- Resource ownership check failed
- Feature access restricted

---

### 5. Not Found Error (404)
**When:** Resource doesn't exist

**Schema:**
```typescript
{
  success: false;
  error: {
    message: "Resource not found.";
    type: "not_found";
    status: 404;
    timestamp: "2024-03-24T12:00:00.000Z";
    resource: "customer";
    resourceId: "uuid";
  }
}
```

**Common Causes:**
- Invalid ID parameter
- Deleted resource
- Wrong tenant context

---

### 6. Internal Error (500)
**When:** Unexpected server error

**Schema:**
```typescript
{
  success: false;
  error: {
    message: "An internal error occurred. Please try again.";
    type: "internal";
    status: 500;
    timestamp: "2024-03-24T12:00:00.000Z";
    originalError: "Cannot read property 'id' of undefined";
    path: "/api/customers/123";
    method: "GET";
  }
}
```

**Common Causes:**
- Unhandled exceptions
- Null pointer errors
- Logic errors
- Infrastructure failures

---

### 7. External Error (502/503)
**When:** External service fails

**Schema:**
```typescript
{
  success: false;
  error: {
    message: "External service unavailable.";
    type: "external";
    status: 503;
    timestamp: "2024-03-24T12:00:00.000Z";
    service: "ollama";
    retryAfter: 60;
  }
}
```

**Common Causes:**
- AI service down
- Payment gateway timeout
- Third-party API failure
- Network connectivity issues

---

### 8. Rate Limit Error (429)
**When:** Too many requests

**Schema:**
```typescript
{
  success: false;
  error: {
    message: "Rate limit exceeded. Please retry after 60 seconds.";
    type: "rate_limit";
    status: 429;
    timestamp: "2024-03-24T12:00:00.000Z";
    retryAfter: 60;
    limit: 100;
    remaining: 0;
  }
}
```

**Common Causes:**
- Exceeded requests per minute
- Burst traffic
- No request throttling on client

---

## Client-Side Error Handling

### TypeScript Type Definitions
```typescript
// types/api.types.ts

export interface ApiError {
  success: false;
  error: {
    message: string;
    type: ErrorType;
    status: number;
    timestamp: string;
    field?: string;
    table?: string;
    originalError?: string;
    retryAfter?: number;
  };
}

export type ErrorType = 
  | 'validation'
  | 'database'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'internal'
  | 'external'
  | 'rate_limit';
```

### Error Handler Utility
```typescript
// utils/error-handler.ts

export function handleApiError(error: unknown): void {
  if (axios.isAxiosError(error) && error.response?.data) {
    const apiError = error.response.data as ApiError;
    
    switch (apiError.error.type) {
      case 'authentication':
        // Clear auth, redirect to login
        authStore.clear();
        navigate('/login');
        break;
        
      case 'authorization':
        // Show permission denied
        toast.error('You do not have permission to perform this action.');
        break;
        
      case 'validation':
        // Show field-specific error
        if (apiError.error.field) {
          setFieldError(apiError.error.field, apiError.error.message);
        } else {
          toast.error(apiError.error.message);
        }
        break;
        
      case 'rate_limit':
        // Wait and retry
        const retryAfter = apiError.error.retryAfter || 60;
        toast.error(`Too many requests. Retry in ${retryAfter}s`);
        setTimeout(() => retryRequest(), retryAfter * 1000);
        break;
        
      case 'not_found':
        // Navigate to 404 page or show message
        toast.error('Resource not found.');
        break;
        
      default:
        // Generic error
        toast.error(apiError.error.message || 'An error occurred.');
        console.error('API Error:', apiError);
    }
  } else {
    // Network or unknown error
    toast.error('Network error. Please check your connection.');
    console.error('Unknown error:', error);
  }
}
```

### React Query Error Handling
```typescript
// hooks/useApiQuery.ts

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { handleApiError } from '../utils/error-handler';

export function useApiQuery<T>(
  key: string[],
  fetchFn: () => Promise<T>,
  options?: UseQueryOptions<T>
) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        const response = await fetchFn();
        if (!response.success) {
          handleApiError({ response: { data: response } });
          throw new Error(response.error.message);
        }
        return response.data;
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    onError: (error) => {
      handleApiError(error);
    },
    ...options,
  });
}
```

---

## Error Logging

All errors are logged to the `error_logs` table for debugging and monitoring.

### Schema
```sql
CREATE TABLE error_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  error_type TEXT,
  message TEXT,
  stack_trace TEXT,
  request_path TEXT,
  request_method TEXT,
  severity TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Severity Levels
- `info`: Expected errors (validation, not found)
- `warning`: Authorization failures, rate limits
- `error`: Database errors, external service failures
- `critical`: Unhandled exceptions, system failures

---

## Monitoring & Alerting

### Error Metrics to Track
1. **Error Rate:** `(error_count / total_requests) * 100`
2. **Error by Type:** Group by `error.type`
3. **Error by Endpoint:** Group by `request_path`
4. **Error Trend:** Errors over time (hourly/daily)

### Alert Thresholds
- **Warning:** Error rate > 5%
- **Critical:** Error rate > 10%
- **Immediate:** Critical errors (unhandled exceptions)

---

## Best Practices

### DO:
✅ Return user-friendly messages
✅ Include error type for client-side handling
✅ Log all errors for debugging
✅ Use appropriate HTTP status codes
✅ Include timestamp for reproducibility
✅ Add field name for validation errors

### DON'T:
❌ Expose stack traces to clients
❌ Return raw database errors
❌ Use generic "An error occurred" for all cases
❌ Forget to log errors
❌ Use wrong HTTP status codes
❌ Omit error type classification

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-03-24 | Initial error schema standardization |
