import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  pages: {
    signIn: "/login",   // redirect here when auth is required
  },

  callbacks: {
    // Optional allow-list: set ALLOWED_EMAILS=a@b.com,c@d.com in .env.local
    signIn({ user }) {
      const allowed = process.env.ALLOWED_EMAILS;
      if (!allowed) return true;
      return allowed.split(",").map(e => e.trim()).includes(user.email ?? "");
    },

    // Persist user id in the JWT so we can read it later
    jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },

    // Expose userId on the session object for client components
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId as string | undefined;
      }
      return session;
    },
  },
});
