/** Domain-level failure with an HTTP-friendly code. Routes and tools map it, they never invent one. */
export class DomainError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
