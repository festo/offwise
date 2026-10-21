/** Body of every API error response. */
export interface ApiErrorBody {
  statusCode: number;
  /** A message, or the list of field errors from validation. */
  message: string | string[];
  error?: string;
  /** For 409 responses: the conflicting field, e.g. `email`. */
  field?: string;
  /** For 409 responses: the broken rule, e.g. `last-admin`. */
  rule?: string;
  /** For 429 responses: seconds until another attempt is allowed. */
  retryAfter?: number;
}
