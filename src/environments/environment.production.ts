declare const process: {
  env: {
    NG_APP_API_BASE?: string;
  };
};

const getApiBase = () => {
  if (typeof process !== 'undefined' && process.env?.NG_APP_API_BASE) {
    return process.env.NG_APP_API_BASE;
  }
  // Production fallback - read from window or use default
  if (typeof window !== 'undefined' && (window as any).__env__apiBase) {
    return (window as any).__env__apiBase;
  }
  return 'https://kudzuops.nouvelledynamics.com/api';
};

export const environment = {
  production: true,
  apiBase: getApiBase(),
  authBase: `${getApiBase()}/auth`,
  superAdminBase: `${getApiBase()}/superadmin`,
};

