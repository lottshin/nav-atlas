import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getAdminPassword, getAdminUsername, getAuthSecret } from "@/lib/auth-env";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: getAuthSecret(),
  trustHost: true,
  pages: {
    signIn: "/admin/login"
  },
  session: {
    strategy: "jwt"
  },
  providers: [
    Credentials({
      name: "admin login",
      credentials: {
        username: { label: "username", type: "text" },
        password: { label: "password", type: "password" }
      },
      authorize(credentials) {
        const adminUsername = getAdminUsername();
        const adminPassword = getAdminPassword();

        if (credentials?.username === adminUsername && credentials?.password === adminPassword) {
          return {
            id: "admin",
            name: adminUsername
          };
        }

        return null;
      }
    })
  ]
});
