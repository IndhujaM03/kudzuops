export const environment = {
  production: false,
  apiBase: (window as any)["__env__apiBase"] || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.NG_APP_API_BASE : undefined) || '',
  authBase: (window as any)["__env__authBase"] || undefined,
  superAdminBase: (window as any)["__env__superAdminBase"] || undefined,
};

// Fallback derive auth/superadmin from apiBase if not explicitly provided
if (!environment.authBase && environment.apiBase) {
  (environment as any).authBase = `${environment.apiBase}/auth`;
}
if (!environment.superAdminBase && environment.apiBase) {
  (environment as any).superAdminBase = `${environment.apiBase}/superadmin`;
}

