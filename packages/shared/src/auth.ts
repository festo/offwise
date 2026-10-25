/** Every user role. Only `admin` grants extra rights in module 1. */
export const ROLES = ['employee', 'manager', 'admin', 'auditor'] as const;

export type Role = (typeof ROLES)[number];

/** Every POST, PUT, PATCH and DELETE must send this header with this exact value (CSRF defence). */
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_HEADER_VALUE = 'offwise';

/** Password policy: length only, no composition rules. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Response of `POST /api/auth/login` and `GET /api/auth/me`. */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** The user's BCP 47 locale, or the company default when they have not set one. */
  locale: string;
  /** The user's IANA time zone, or the company default when they have not set one. */
  timeZone: string;
}

/** Body of `POST /api/auth/login`. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Body of `POST /api/auth/password-reset`. */
export interface PasswordResetRequest {
  email: string;
}

/** Body of `POST /api/auth/password-reset/confirm`. */
export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
}
