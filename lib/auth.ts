import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

const UPLOADER_EMAIL = "abhi.ukande22@gmail.com";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ""
    })
  ],
  secret: process.env.NEXTAUTH_SECRET || "a_random_32_character_secret_phrase_here",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const isUploader = user.email.toLowerCase() === UPLOADER_EMAIL.toLowerCase();

      // Run DB sync non-blocking in background so sign-in redirect is instant
      (async () => {
        try {
          const { supabase } = await import("./supabase");
          await supabase.from("users").upsert(
            {
              email: user.email!,
              name: user.name,
              image: user.image,
              role: isUploader ? "uploader" : "viewer"
            },
            { onConflict: "email" }
          );
        } catch {}
      })();

      return true;
    },
    async jwt({ token, user }) {
      if (token.email) {
        const isEligible = token.email.toLowerCase() === UPLOADER_EMAIL.toLowerCase();
        token.isUploaderEligible = isEligible;
        token.role = isEligible ? "uploader" : "viewer";
        token.id = token.id || token.sub || user?.id || token.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const isEligible = Boolean(
          token.isUploaderEligible || session.user.email?.toLowerCase() === UPLOADER_EMAIL.toLowerCase()
        );
        session.user.id = String(token.id || token.sub || session.user.email || "");
        session.user.isUploaderEligible = isEligible;
        session.user.role = isEligible ? (token.role as "uploader" | "viewer" || "uploader") : "viewer";
      }
      return session;
    }
  }
};
