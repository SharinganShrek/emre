export class AiPermissionError extends Error {
  constructor(
    message: string,
    public status: number = 403,
  ) {
    super(message);
    this.name = "AiPermissionError";
  }
}
