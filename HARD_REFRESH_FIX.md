# Hard Refresh Error Fix Documentation

## Problem

After a hard refresh (Cmd+Shift+R or Ctrl+F5), the application was throwing a `400 Bad Request` error with the message:
```
{"detail":"recruiter_id required (query param, JWT token, or X-Recruiter-ID header)"}
```

The error occurred on routes like `/recruiter/dashboard` and `/recruiter/demands`.

## Root Cause Analysis

### Issue 1: Nginx Proxy Configuration
Nginx was proxying all `/recruiter/*` routes to the backend API, including Angular route paths like `/recruiter/dashboard` and `/recruiter/demands`. This caused:

- Navigation requests to `/recruiter/dashboard` were being sent to the backend
- Backend expected a `recruiter_id` but received none
- The backend returned 400 error instead of serving the Angular app

### Issue 2: Race Condition on Hard Refresh
On hard refresh, Angular components were trying to make API calls before the `recruiter_id` was properly loaded from `localStorage`:

1. Browser clears cache and reloads the app
2. Angular components initialize (`ngOnInit`)
3. Components try to fetch data immediately
4. `getCurrentUserId()` returns `null` because `localStorage` isn't fully loaded yet
5. API calls are made with `undefined` or missing `recruiter_id`
6. Backend rejects the request with 400 error

### Issue 3: Incorrect API Endpoint Usage
The dashboard component was using:
```typescript
this.http.get(`${this.api}/recruiter/dashboard?recruiter_id=${recruiterId}`)
```

This query parameter approach was less reliable than using path parameters.

## Solutions Implemented

### Fix 1: Nginx Configuration Update

**Old Config (Problem):**
```nginx
location /recruiter/ {
    proxy_pass http://localhost:8002/recruiter/;
    # ... proxy headers ...
}
```

This was catching ALL `/recruiter/*` requests and sending them to the backend.

**New Config (Solution):**
```nginx
# Only proxy API routes with recruiter_id in path
location ~ ^/recruiter/([0-9]+)/(.*)$ {
    proxy_pass http://localhost:8002/recruiter/$1/$2;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Angular SPA - catch all (MUST BE LAST)
location / {
    try_files $uri $uri/ /index.html;
}
```

Now:
- `/recruiter/9/dashboard` → proxied to backend
- `/recruiter/dashboard` → served by Angular
- `/recruiter/demands` → served by Angular

### Fix 2: Added Retry Logic with Delays

**Modified:** `src/components/recruiter/dashboard/dashboard.component.ts` and `demand-management.component.ts`

```typescript
ngOnInit() {
  // Check localStorage immediately
  const savedRecruiterId = localStorage.getItem('recruiter_id');
  if (savedRecruiterId) {
    console.log('✅ Found recruiter_id in localStorage immediately');
    this.loadDemands();
  } else {
    console.warn('⚠️ No recruiter_id in localStorage, waiting...');
    setTimeout(() => {
      this.loadDemands();
    }, 1000);
  }
}

loadDemands() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    this.error = 'Please log in to view your dashboard.';
    return;
  }
  
  let recruiterId = this.auth.getCurrentUserId();
  
  // Retry logic if recruiter_id not ready
  if (!recruiterId) {
    let retryCount = 0;
    const maxRetries = 5;
    
    const retry = setInterval(() => {
      retryCount++;
      recruiterId = this.auth.getCurrentUserId();
      
      if (recruiterId && typeof recruiterId === 'number' && recruiterId > 0) {
        clearInterval(retry);
        this.loadDemandsWithId(recruiterId);
      } else if (retryCount >= maxRetries) {
        clearInterval(retry);
        this.loading = false;
        this.error = 'Unable to authenticate. Please refresh the page.';
      }
    }, 300);
    return;
  }
  
  this.loadDemandsWithId(recruiterId);
}
```

### Fix 3: Enhanced Validation

**Modified:** `src/components/recruiter/demand-management/demand-management.component.ts`

```typescript
private loadDemandsWithId(recruiterId: number) {
  // Validate recruiter_id type and value
  if (!recruiterId || isNaN(recruiterId) || recruiterId <= 0) {
    console.error('Invalid recruiter ID provided:', recruiterId);
    this.loading = false;
    this.error = 'Invalid recruiter ID. Please refresh the page.';
    return;
  }

  if (typeof recruiterId !== 'number') {
    console.error('Recruiter ID is not a number:', typeof recruiterId);
    this.loading = false;
    this.error = 'Authentication error. Please refresh the page.';
    return;
  }

  // Build URL and verify it contains the ID
  const url = `${this.api}/recruiter/${recruiterId}/demands`;
  
  if (!url.includes(String(recruiterId))) {
    console.error('URL does not contain recruiterId!', url);
    this.loading = false;
    this.error = 'URL construction error. Please refresh.';
    return;
  }
  
  // Make the request
  this.http.get<any>(url, { params }).subscribe({...});
}
```

### Fix 4: Fixed Dashboard API Endpoint

**Modified:** `src/components/recruiter/dashboard/dashboard.component.ts`

Changed from query parameter to path parameter:

**Before:**
```typescript
this.http.get(`${this.api}/recruiter/dashboard?recruiter_id=${recruiterId}`)
```

**After:**
```typescript
this.http.get(`${this.api}/recruiter/${recruiterId}/dashboard`)
```

### Fix 5: Enhanced Logging

**Added to:** `src/services/auth.interceptor.ts` and auth service methods

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  console.log('🔧 Interceptor: Processing request to:', req.url);
  
  const recruiterId = localStorage.getItem('recruiter_id');
  console.log('🔧 Interceptor: Recruiter ID from localStorage:', recruiterId);
  
  if (recruiterId) {
    headers['X-Recruiter-ID'] = recruiterId;
    console.log('🔧 Interceptor: Added X-Recruiter-ID header:', recruiterId);
  } else {
    console.error('❌ Interceptor: No recruiter_id found in localStorage!');
  }
  
  return next(req);
};
```

## Key Takeaways

1. **Nginx Location Priority**: More specific regex patterns must come before generic `location /` rules
2. **localStorage Timing**: On hard refresh, add delays and retry logic to ensure credentials are loaded
3. **Type Validation**: Always validate that `recruiter_id` is a proper number before making API calls
4. **URL Construction**: Use path parameters (`/recruiter/{id}/endpoint`) instead of query parameters for better reliability
5. **Logging**: Extensive logging helps debug timing issues and credential loading

## Testing

To verify the fix works:
1. Log in to the application
2. Navigate to `/recruiter/dashboard` or `/recruiter/demands`
3. Perform a hard refresh (Cmd+Shift+R on Mac, Ctrl+F5 on Windows)
4. The page should load without 400 errors

## Files Modified

- `src/components/recruiter/dashboard/dashboard.component.ts`
- `src/components/recruiter/demand-management/demand-management.component.ts`
- `src/services/auth.service.ts`
- `src/services/auth.interceptor.ts`
- `/etc/nginx/sites-available/kudzuops.nouvelledynamics.com`

## Environment Configuration

Environment variables are now read from `.env` file:
- `.env` → Contains `NG_APP_API_BASE=http://localhost:8000`
- `.env.production` → Contains `NG_APP_API_BASE=https://kudzuops.nouvelledynamics.com`

This ensures no hardcoded URLs in the codebase.

