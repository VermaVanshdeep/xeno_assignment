import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import segmentRoutes from './routes/segmentRoutes';
import campaignRoutes from './routes/campaignRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import aiRoutes from './routes/aiRoutes';
import customerRoutes from './routes/customerRoutes';
import orderRoutes from './routes/orderRoutes';
import { errorHandler } from './middleware/errorHandler';
import { processPendingJobs } from './services/channelService';
import { db } from './db/index';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// API healthcheck endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Xeno CRM Backend' });
});

// Register API Routes
app.use('/api/segments', segmentRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);

// 404 handler for unknown routes
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized error handler
app.use(errorHandler);

/**
 * Applies all pending Drizzle migrations before the server starts.
 * This ensures the production Supabase database schema stays in sync
 * with schema.ts definitions on every Render deploy.
 *
 * Root cause fixed: migration 0001 adds `audience_size` to campaigns and
 * migration 0002 adds `retry_count`/`last_error` to communication_jobs.
 * Without running these, Drizzle generates SELECT queries referencing columns
 * that do not exist in the DB, causing "column does not exist" PG errors that
 * surface as generic 500s from /api/campaigns.
 */
async function runMigrations() {
  // __dirname resolves to dist/  at runtime; drizzle/ sits two levels up from dist/src/
  const migrationsFolder = path.join(__dirname, '../../drizzle');
  console.log(`[migrate]: Applying pending migrations from ${migrationsFolder}...`);
  try {
    await migrate(db, { migrationsFolder });
    console.log('[migrate]: All migrations applied successfully.');
  } catch (err) {
    // Log the real error (including column names) so Render logs show the exact failure.
    // Do NOT crash the process — the health endpoint stays alive so Render does not
    // enter a restart loop while the DB issue is being debugged.
    console.error('[migrate]: Migration run failed:', err);
  }
}

// Only listen if not in a testing environment that imports app
if (process.env.NODE_ENV !== 'test') {
  runMigrations().then(() => {
    app.listen(port, () => {
      console.log(`[server]: Server is running at http://localhost:${port}`);
    });

    // Start background queue processing worker to scan pending campaign simulation jobs
    console.log('[server]: Initializing background Channel Service worker...');
    let isProcessingJobs = false;
    setInterval(async () => {
      if (isProcessingJobs) return;
      isProcessingJobs = true;
      try {
        await processPendingJobs();
      } catch (err) {
        console.error('[server]: Background simulator worker failed:', err);
      } finally {
        isProcessingJobs = false;
      }
    }, 5000);
  });
}

export default app;
