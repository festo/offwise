import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ThrottledException } from './throttled.exception';

@Catch(ThrottledException)
export class ThrottledExceptionFilter implements ExceptionFilter<ThrottledException> {
  catch(exception: ThrottledException, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(exception.getStatus())
      .setHeader('Retry-After', String(exception.retryAfterSec))
      .json(exception.getResponse());
  }
}
