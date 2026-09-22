/**
 * Standart hata yakalama ve loglama utility
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleApiError(error: unknown, context: string = 'API') {
  console.error(`${context} error:`, error);

  if (error instanceof AppError) {
    return {
      error: error.message,
      statusCode: error.statusCode
    };
  }

  if (error instanceof Error) {
    return {
      error: process.env.NODE_ENV === 'production'
        ? 'Sunucu hatası'
        : error.message,
      statusCode: 500
    };
  }

  return {
    error: 'Bilinmeyen hata',
    statusCode: 500
  };
}

export function logError(error: unknown, context: string = 'Error') {
  if (error instanceof Error) {
    console.error(`${context}:`, {
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  } else {
    console.error(`${context}:`, error);
  }
}