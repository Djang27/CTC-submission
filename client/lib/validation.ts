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
 *
 * `notFound` names the thing that's missing: /api/visits/abc is a missing
 * visit, not a missing restaurant.
 */
export function parseId(raw: string, notFound = 'Restaurant not found'): number {
  if (!/^\d+$/.test(raw)) throw new NotFoundError(notFound);

  const id = Number(raw);
  if (id < 1 || id > MAX_INT4) throw new NotFoundError(notFound);

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

// --- visits -----------------------------------------------------------------

/** `amountSpent` is NUMERIC(10, 2): ten digits total, two of them decimal. */
const MAX_AMOUNT = 99999999.99;

/** Notes are free text and can reasonably run longer than a cuisine name. */
const MAX_NOTES = 1000;

export interface VisitInput {
  date: string;
  amountSpent: number | null;
  notes: string | null;
}

/**
 * Validate a visit body. `restaurantId` is deliberately not read from here -
 * it comes from the path, so a body can't disagree with the URL it was sent to.
 */
export function parseVisitInput(body: unknown): VisitInput {
  if (!isPlainObject(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  const details: string[] = [];

  const date = parseVisitDate(body.date, details);
  const amountSpent = parseAmount(body.amountSpent, details);

  let notes: string | null = null;
  const rawNotes = body.notes;
  if (rawNotes !== undefined && rawNotes !== null) {
    if (typeof rawNotes !== 'string') {
      details.push('notes must be a string');
    } else if (rawNotes.trim().length > MAX_NOTES) {
      details.push(`notes must be ${MAX_NOTES} characters or fewer`);
    } else {
      notes = rawNotes.trim() || null;
    }
  }

  if (details.length > 0) {
    throw new ValidationError('Invalid request body', details);
  }

  return { date, amountSpent, notes };
}

/**
 * Required calendar date, "YYYY-MM-DD".
 *
 * Checked by round-tripping through Date rather than by regex alone: the shape
 * check passes "2026-02-31", which is not a day. Rebuilding the string from the
 * parsed date catches anything Postgres would reject - and rejects it here,
 * with a message, instead of as a translated driver error.
 *
 * Future dates are refused. This logs money already spent; a visit that hasn't
 * happened has no amount, and allowing it would quietly corrupt the totals.
 */
function parseVisitDate(value: unknown, details: string[]): string {
  if (value === undefined || value === null || value === '') {
    details.push('date is required');
    return '';
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    details.push('date must be a string in YYYY-MM-DD format');
    return '';
  }

  // Parse as UTC so the comparison below doesn't shift by the server's offset.
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    details.push('date must be a real calendar date');
    return '';
  }

  const today = new Date().toISOString().slice(0, 10);
  if (value > today) {
    details.push('date must not be in the future');
    return '';
  }

  return value;
}

/** Optional money amount: non-negative, at most two decimals, fits NUMERIC(10,2). */
function parseAmount(value: unknown, details: string[]): number | null {
  if (value === undefined || value === null) return null;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    details.push('amountSpent must be a number');
    return null;
  }
  if (value < 0) {
    details.push('amountSpent must not be negative');
    return null;
  }
  if (value > MAX_AMOUNT) {
    details.push(`amountSpent must be ${MAX_AMOUNT} or less`);
    return null;
  }
  // Postgres would round a third decimal away silently. Rejecting it means the
  // caller is told the stored value wouldn't match what they sent.
  //
  // Compared with a tolerance, not for equality: 19.99 * 100 is
  // 1998.9999999999998 in binary floating point, so an exact check rejects
  // amounts that are perfectly valid. The epsilon is far smaller than the
  // 0.005 gap that a real third decimal would produce.
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-9) {
    details.push('amountSpent must have at most 2 decimal places');
    return null;
  }

  return value;
}
