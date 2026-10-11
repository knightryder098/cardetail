export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public details?: unknown) { super(message); }
}
export function requireValue<T>(value: T | null | undefined, code = 'NOT_FOUND', message = 'This item is unavailable.'): T {
  if (value == null) throw new AppError(code, message, 404);
  return value;
}
