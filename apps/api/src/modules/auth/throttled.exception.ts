import { HttpException, HttpStatus } from '@nestjs/common';

export const THROTTLED_MESSAGE = 'Too many attempts. Try again later.';

/** 429 with `retryAfter` (seconds) in the body; ThrottledExceptionFilter adds the Retry-After header. */
export class ThrottledException extends HttpException {
  constructor(readonly retryAfterSec: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: THROTTLED_MESSAGE,
        retryAfter: retryAfterSec,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
