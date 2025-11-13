declare const process: {
  env: {
    NG_APP_API_BASE?: string;
  };
};

const getApiBase = () => {
  if (typeof process !== 'undefined' && process.env?.NG_APP_API_BASE) {
    return process.env.NG_APP_API_BASE;
  }
  // Fallback only if env var not set
  return '';
};

export const environment = {
  production: false,
  // Base environment - should not be used directly
  // Development and production configs override this
  apiBase: getApiBase(),
  authBase: undefined as string | undefined,
  superAdminBase: undefined as string | undefined,
};

// Fallback derive auth/superadmin from apiBase if not explicitly provided
if (!environment.authBase && environment.apiBase) {
  (environment as any).authBase = `${environment.apiBase}/auth`;
}
if (!environment.superAdminBase && environment.apiBase) {
  (environment as any).superAdminBase = `${environment.apiBase}/superadmin`;
}

