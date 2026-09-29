import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
    accessStatus:
      | "setup_required"
      | "not_member"
      | "missing_role"
      | "authorized"
      | "unavailable";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordAccessToken?: string;
    discordRefreshToken?: string;
    discordAccessTokenExpiresAt?: number;
    discordReauthRequired?: boolean;
  }
}
