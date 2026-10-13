/** Response of `GET /api/health`. */
export interface HealthResponse {
  status: 'ok' | 'error';
  db: 'up' | 'down';
}
