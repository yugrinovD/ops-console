export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class UpstreamError extends AppError {
  readonly service: string;
  readonly upstreamStatus?: number;

  constructor(
    service: string,
    message: string,
    options: { status?: number; code?: string; details?: unknown } = {},
  ) {
    super(
      options.status ?? 502,
      options.code ?? `upstream_${service}_error`,
      message,
      options.details,
    );
    this.name = "UpstreamError";
    this.service = service;
    this.upstreamStatus = options.status;
  }
}
