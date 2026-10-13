import type { LogLevel as NestLogLevel } from '@nestjs/common';
import type { LogLevel } from './env.validation';

const SEVERITY_ORDER: NestLogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

const NEST_LEVEL: Record<LogLevel, NestLogLevel> = {
  error: 'error',
  warn: 'warn',
  info: 'log',
  debug: 'debug',
};

/** Nest enables an explicit list of levels; return the chosen level and everything more severe. */
export function toNestLogLevels(level: LogLevel): NestLogLevel[] {
  return SEVERITY_ORDER.slice(0, SEVERITY_ORDER.indexOf(NEST_LEVEL[level]) + 1);
}
