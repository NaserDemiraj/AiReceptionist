import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, totp: {} },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
        });
        if (!user) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        // 2FA enforced here too — the login form pre-checks for friendly
        // errors, but this is the gate a direct POST can't skip
        if (user.totpEnabledAt && user.totpSecret) {
          const { verifyTotp } = await import("./totp");
          if (!parsed.data.totp || !verifyTotp(user.totpSecret, parsed.data.totp)) {
            return null;
          }
        }

        const membership = user.memberships[0];
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: membership?.organizationId ?? null,
          role: membership?.role ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.orgId = user.orgId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.orgId = (token.orgId as string | null) ?? null;
      session.user.role = (token.role as string | null) ?? null;
      return session;
    },
  },
});
