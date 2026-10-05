export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode: number = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: Record<string, unknown>) {
    return new AppError('BAD_REQUEST', message, 400, details);
  }

  static notFound(message: string, details?: Record<string, unknown>) {
    return new AppError('NOT_FOUND', message, 404, details);
  }

  static internal(message: string, details?: Record<string, unknown>) {
    return new AppError('INTERNAL_ERROR', message, 500, details);
  }

  static unavailable(message: string, details?: Record<string, unknown>) {
    return new AppError('SERVICE_UNAVAILABLE', message, 503, details);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}