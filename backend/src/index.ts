import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import segmentRoutes from './routes/segmentRoutes';
import campaignRoutes from './routes/campaignRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import aiRoutes from './routes/aiRoutes';
import customerRoutes from './routes/customerRoutes';
import orderRoutes from './routes/orderRoutes';
import { errorHandler } from './middleware/errorHandler';
import { processPendingJobs } from './services/channelService';

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

// Only listen if not in a testing environment that imports app
if (process.env.NODE_ENV !== 'test') {
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
}

export default app;
