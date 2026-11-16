/**
 * A stage decided the post cannot go out today. Unlike an ordinary error the
 * pipeline does not retry it: trying again would not change the answer.
 */
export class SkipError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'SkipError';
  }
}
