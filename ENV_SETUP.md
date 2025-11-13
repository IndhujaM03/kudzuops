# Environment Configuration Setup

## For Local Development

1. Create a `.env` file in the project root:
   ```bash
   touch .env
   ```

2. Add your environment variables to `.env`:
   ```
   NG_APP_API_BASE=http://localhost:8000
   ```

3. The application will automatically use these values. No need to edit any TypeScript files!

## For Production

1. Set environment variables in your deployment environment (server, docker, etc.)
2. Or create a `.env.production` file:
   ```
   NG_APP_API_BASE=https://kudzuops.nouvelledynamics.com
   ```

## How It Works

Angular 20 automatically:
- Loads environment variables from `.env` file during development
- Uses `src/environments/environment.development.ts` for development builds
- Uses `src/environments/environment.production.ts` for production builds
- Environment files read from `process.env['NG_APP_API_BASE']` which comes from `.env`

## Current Configuration

- **Development**: `.env` file contains `NG_APP_API_BASE=http://localhost:8000`
- **Production**: `environment.production.ts` has fallback to `https://kudzuops.nouvelledynamics.com`

## To Change API URL

Simply edit the `.env` file (for development) or set environment variables (for production).
NEVER hardcode URLs in source code!

