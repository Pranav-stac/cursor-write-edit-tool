export class EditError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "EditError";
    this.details = details;
  }
}
