export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly failures?: Array<{ rule: string; message: string }>;

  constructor(statusCode: number, message: string, failures?: Array<{ rule: string; message: string }>) {
    super(message);
    this.statusCode = statusCode;
    this.failures = failures;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message);
  }

  static unprocessable(message: string, failures: Array<{ rule: string; message: string }>): ApiError {
    return new ApiError(422, message, failures);
  }
}
