export type AccessStatus =
  | "setup_required"
  | "unauthenticated"
  | "not_member"
  | "missing_role"
  | "authorized"
  | "rate_limited"
  | "unavailable";
