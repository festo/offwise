import type { Role } from './auth';

/** Default and maximum `pageSize` of paginated lists. */
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Limits on user fields, enforced by the API. */
export const USER_NAME_MAX_LENGTH = 200;
export const USER_EMAIL_MAX_LENGTH = 254;

/** A page of a list endpoint. `page` counts from 1. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** A user as the admin screens see it. Never includes the password hash. */
export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** As stored; null means the company default. */
  locale: string | null;
  /** As stored; null means the company default. */
  timeZone: string | null;
  hasPassword: boolean;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601 when the account is closed, otherwise null. */
  closedAt: string | null;
}

/** Query of `GET /api/users`. Sorted by name. */
export interface UserListQuery {
  /** Matches name or email, case-insensitively. */
  search?: string;
  /** Include closed users (default false). */
  includeClosed?: boolean;
  /** From 1 (default 1). */
  page?: number;
  /** 1 to MAX_PAGE_SIZE (default DEFAULT_PAGE_SIZE). */
  pageSize?: number;
}

/** Body of `POST /api/users`. */
export interface CreateUserRequest {
  name: string;
  email: string;
  role: Role;
  /** BCP 47; null or omitted means the company default. */
  locale?: string | null;
  /** IANA name; null or omitted means the company default. */
  timeZone?: string | null;
}

/** Body of `PATCH /api/users/:id`. */
export type UpdateUserRequest = Partial<CreateUserRequest>;

/** `rule` of the 409 returned when a change would leave no active admin. */
export const LAST_ADMIN_RULE = 'last-admin';
