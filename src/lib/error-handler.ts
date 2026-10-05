import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

export const errors = {
  unauthorized: () =>
    new ApiError('UNAUTHORIZED', 401, 'Unauthorized access'),
  forbidden: (reason?: string) =>
    new ApiError('FORBIDDEN', 403, `Forbidden: ${reason || 'Access denied'}`),
  notFound: (resource?: string) =>
    new ApiError('NOT_FOUND', 404, `${resource || 'Resource'} not found`),
  conflict: (message: string) =>
    new ApiError('CONFLICT', 409, message),
  validationError: (details: Record<string, unknown>) =>
    new ApiError('VALIDATION_ERROR', 400, 'Validation failed', details),
  internalError: (message?: string) =>
    new ApiError('INTERNAL_ERROR', 500, message || 'Internal server error'),
};

export function handleError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(error.toJSON(), { status: error.statusCode });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'DUPLICATE_ENTRY',
          message: `Duplicate entry: ${error.meta?.target || 'unknown field'}`,
        },
        { status: 409 }
      );
    }
    if (error.code === 'P2025') {
      return NextResponse.json(
        {
          error: 'NOT_FOUND',
          message: 'Record not found',
        },
        { status: 404 }
      );
    }
  }

  // Log unexpected errors server-side
  console.error('Unhandled error:', error);

  // Never leak stack traces or internal error messages to clients in production
  return NextResponse.json(
    {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      ...(!IS_PRODUCTION && error instanceof Error && {
        details: { msg: error.message }
      }),
    },
    { status: 500 }
  );
}