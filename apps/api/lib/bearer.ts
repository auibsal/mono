import { timingSafeEqual } from "node:crypto";

/** Constant-time check of `Authorization: Bearer <secret>`; fails closed. */
export const hasBearer = (request: Request, secret: string | undefined) => {
  if (!secret) {
    return false;
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
};
