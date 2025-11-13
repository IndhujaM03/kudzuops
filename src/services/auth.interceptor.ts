import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const headers: Record<string, string> = {};
  
  console.log('🔧 Interceptor: Processing request to:', req.url);
  
  // Get token from localStorage
  const token = localStorage.getItem('access_token');
  const tokenType = localStorage.getItem('token_type') || 'Bearer';
  
  console.log('🔧 Interceptor: Token exists:', !!token);
  
  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `${tokenType} ${token}`;
  }
  
  // Add recruiter_id from localStorage as X-Recruiter-ID header (multiple fallback)
  const recruiterId = localStorage.getItem('recruiter_id') || 
                       localStorage.getItem('user_id') || 
                       localStorage.getItem('uid');
  
  console.log('🔧 Interceptor: Recruiter ID from localStorage:', recruiterId);
  
  if (recruiterId) {
    headers['X-Recruiter-ID'] = recruiterId;
    console.log('🔧 Interceptor: Added X-Recruiter-ID header:', recruiterId);
  } else {
    console.error('❌ Interceptor: No recruiter_id found in localStorage!');
  }
  
  // Clone request and add all headers
  if (Object.keys(headers).length > 0) {
    req = req.clone({
      setHeaders: headers
    });
  }
  
  return next(req);
};

