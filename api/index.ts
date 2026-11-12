/**
 * Vercel serverless entry point. vercel.json rewrites every /api/* request here, so the
 * same Express API (src/server/app.ts) runs on Vercel and on a normal Node server.
 */
import { app } from '../src/server/app.js';

export default app;
