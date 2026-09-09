import { NotFoundError, ValidationError } from './errors';

/**
 * Input validation for the restaurant endpoints.
 *
 * The types in lib/types.ts are erased at build time, so a body that claims to
 * be a Restaurant is still `unknown` at runtime. These functions are where that
 * claim gets checked - before anything reaches the database, so a bad request
 * fails as a 400 we wrote rather than a constraint violation we translated.
 *
 * Errors are collected rather than thrown one at a time: a caller sending three
 * bad fields should learn about all three from one request.
 */

/** Longest we'll accept for a free-text column. TEXT has no limit of its own. */
const MAX_TEXT = 200;

/** `id` is SERIAL, i.e. int4. Anything larger overflows the column. */
const MAX_INT4 = 2147483647;

export interface RestaurantInput {
  name: string;
  cuisine: string | null;
  address: string | null;
  rating: number | null;
}

/**
 * Parse a path `:id` into a row id.
 *
 * Throws NotFoundError - not ValidationError - for anything that can't be one.
 * `abc`, `-1` and `1.5` are 404s per the contract, and so is 99999999999: it's
 * a syntactically fine integer that overflows int4, and left alone it reaches
 * Postgres and raises 22003 instead of answering the question the caller asked,
 * which is "is there a restaurant here?" There isn't.
 */
export function parseId(raw: string): number {
  if (!/^\d+$/.test(raw)) throw new NotFoundError();

  const id = Number(raw);
  if (id < 1 || id > MAX_INT4) throw new NotFoundError();

  return id;
}

/** True for a plain JSON object - excludes null and arrays, which `typeof` doesn't. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a POST or PUT body.
 *
 * Both endpoints take the same shape: PUT replaces the record rather than
 * merging into it, so a field omitted there is written as NULL, exactly as it
 * would be on create.
 */
export function parseRestaurantInput(body: unknown): RestaurantInput {
  if (!isPlainObject(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  const details: string[] = [];

  // name - required, and a string of only whitespace doesn't count.
  const rawName = body.name;
  let name = '';
  if (rawName === undefined || rawName === null) {
    details.push('name is required');
  } else if (typeof rawName !== 'string') {
    details.push('name must be a string');
  } else if (rawName.trim() === '') {
    details.push('name must not be empty');
  } else if (rawName.trim().length > MAX_TEXT) {
    details.push(`name must be ${MAX_TEXT} characters or fewer`);
  } else {
    name = rawName.trim();
  }

  const cuisine = optionalText(body.cuisine, 'cuisine', details);
  const address = optionalText(body.address, 'address', details);

  // rating - optional, but 0-5 when present. Rejects the numeric string "4.5":
  // JSON can express a real number, so a string here means the caller sent the
  // wrong type, and silently coercing it would hide that.
  let rating: number | null = null;
  const rawRating = body.rating;
  if (rawRating !== undefined && rawRating !== null) {
    if (typeof rawRating !== 'number' || !Number.isFinite(rawRating)) {
      details.push('rating must be a number');
    } else if (rawRating < 0 || rawRating > 5) {
      details.push('rating must be between 0 and 5');
    } else {
      rating = rawRating;
    }
  }

  if (details.length > 0) {
    throw new ValidationError('Invalid request body', details);
  }

  return { name, cuisine, address, rating };
}

/** Optional free-text field: absent, null, or a non-empty string within length. */
function optionalText(
  value: unknown,
  field: string,
  details: string[]
): string | null {
  if (value === undefined || value === null) return null;

  if (typeof value !== 'string') {
    details.push(`${field} must be a string`);
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === '') return null;

  if (trimmed.length > MAX_TEXT) {
    details.push(`${field} must be ${MAX_TEXT} characters or fewer`);
    return null;
  }

  return trimmed;
}
