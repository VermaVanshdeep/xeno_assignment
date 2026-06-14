import { Request, Response, NextFunction } from 'express';

function mapPostgresError(err: any): { status: number; message: string } | null {
  const cause = err.cause || err;
  const code = cause?.code;

  if (code === '23505') {
    const constraint = cause.constraint;
    let message = 'Record already exists';
    if (constraint === 'customers_email_unique') {
      message = 'Email already exists';
    } else if (constraint === 'customers_phone_unique') {
      message = 'Phone already exists';
    }
    return { status: 400, message };
  }

  if (code === '23503') {
    return { status: 400, message: 'Related record not found' };
  }

  if (code === '23502') {
    return { status: 400, message: 'Missing required field' };
  }

  if (code === '22P02') {
    return { status: 400, message: 'Invalid data format' };
  }

  if (code === '22001') {
    return { status: 400, message: 'Value exceeds allowed length' };
  }

  return null;
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log the actual error on the server
  console.error(err);

  const pgMapped = mapPostgresError(err);
  if (pgMapped) {
    return res.status(pgMapped.status).json({
      success: false,
      message: pgMapped.message
    });
  }

  const status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Sanitize message to never expose SQL/DB details
  const lowerMsg = message.toLowerCase();
  const hasDbKeywords = 
    lowerMsg.includes('failed query') ||
    lowerMsg.includes('insert into') ||
    lowerMsg.includes('select ') ||
    lowerMsg.includes('update ') ||
    lowerMsg.includes('delete ') ||
    lowerMsg.includes('postgres') ||
    lowerMsg.includes('drizzle') ||
    lowerMsg.includes('unique constraint') ||
    lowerMsg.includes('violates') ||
    lowerMsg.includes('relation "') ||
    lowerMsg.includes('column "');

  if (status === 500 || hasDbKeywords) {
    message = 'Internal Server Error';
  }

  res.status(status).json({
    success: false,
    message
  });
}
