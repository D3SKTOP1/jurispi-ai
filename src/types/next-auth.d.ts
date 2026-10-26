import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    organizationId: string;
    organizationName: string;
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  interface User {
    organizationId?: string;
    organizationName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    organizationId?: string;
    organizationName?: string;
  }
}
