import { NextResponse } from 'next/server';

/**
 * Error handling for the API route handlers, in one place.
 *
 * Handlers don't build error responses themselves. They throw one of the
 * classes below and let `handleError` turn it into a response:
 *
 *   try {
 *     ...
 *   } catch (err) {
 *     return handleError(err);
 *   }
 *
 * The rule the mapping enforces: a client can be told why *its own* request
 * failed, but nothing about how the server failed. Known errors carry a message
 * written to be read by a caller. Everything else - a dropped connection, a
 * constraint we forgot about, a genuine bug - is logged server-side and comes
 * back as a bare 500, because its message could name a table, a column, or a
 * file path.
 */

/** Base class for failures that map to a known status code. */
export class ApiError extends Error {
  readonly status: number;
  /** Per-field problems, for validation failures. */
  readonly details?: string[];

  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.details = details;
  }
}

/** 400 - the request body is missing something, or has the wrong shape. */
export class ValidationError extends ApiError {
  constructor(message = 'Invalid request body', details?: string[]) {
    super(400, message, details);
  }
}

/**
 * 404 - no such record.
 *
 * Also the answer for an :id that can't identify one (`abc`, `-1`, `1.5`). The
 * contract asks for 404 rather than 400 there: either way there's no such
 * restaurant, and distinguishing the two would leak how ids are shaped.
 */
export class NotFoundError extends ApiError {
  constructor(message = 'Restaurant not found') {
    super(404, message);
  }
}

/** 409 - the request conflicts with a record that already exists. */
export class ConflictError extends ApiError {
  constructor(message = 'Resource already exists') {
    super(409, message);
  }
}

/**
 * Postgres error codes worth translating.
 *
 * These are the failures that are the *caller's* fault but only surface once
 * the query runs. Validation should catch most of them first; this is the net
 * underneath, so a constraint added later can't turn into a 500.
 *
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG_STATUS: Record<string, number> = {
  '23505': 409, // unique_violation
  '23503': 409, // foreign_key_violation - referenced row missing, or still referenced
  '23502': 400, // not_null_violation
  '23514': 400, // check_violation
  '22P02': 400, // invalid_text_representation - e.g. 'abc' where a number was expected
  '22003': 400, // numeric_value_out_of_range
};

/** Narrow an unknown error to something carrying a Postgres error code. */
function pgCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export function handleError(err: unknown): NextResponse {
  // Thrown deliberately by a handler - status and message are both intended
  // for the caller.
  if (err instanceof ApiError) {
    return NextResponse.json(
      err.details?.length
        ? { error: err.message, details: err.details }
        : { error: err.message },
      { status: err.status }
    );
  }

  // `await req.json()` on a body that isn't valid JSON. A client mistake, so a
  // 400 - but the parser's message points at byte offsets in the input and
  // isn't worth returning.
  if (err instanceof SyntaxError) {
    return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 });
  }

  // A constraint the request tripped. The driver's message quotes the
  // constraint and table name, so send a generic line instead.
  const code = pgCode(err);
  if (code && code in PG_STATUS) {
    const status = PG_STATUS[code];
    console.error(`Database constraint violation (${code}):`, err);
    return NextResponse.json(
      { error: status === 409 ? 'Resource conflict' : 'Invalid request' },
      { status }
    );
  }

  // Anything else is ours, not the caller's. Log it in full; return nothing.
  console.error('Unhandled API error:', err);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
