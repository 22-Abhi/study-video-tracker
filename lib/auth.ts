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
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const isUploader = user.email.toLowerCase() === UPLOADER_EMAIL.toLowerCase();
      try {
        const { supabase } = await import("./supabase");
        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();

        if (!existing) {
          await supabase.from("users").insert({
            email: user.email,
            name: user.name,
            image: user.image,
            role: isUploader ? "uploader" : "viewer"
          });
        } else if (isUploader) {
          await supabase
            .from("users")
            .update({ name: user.name, image: user.image, role: "uploader" })
            .eq("email", user.email);
        }
      } catch (err) {
        console.error("Error in signIn callback:", err);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (token.email) {
        const isEligible = token.email.toLowerCase() === UPLOADER_EMAIL.toLowerCase();
        token.isUploaderEligible = isEligible;
        
        try {
          const { supabase } = await import("./supabase");
          const { data } = await supabase
            .from("users")
            .select("id,role")
            .eq("email", token.email)
            .maybeSingle();
          if (data && data.role) {
            token.id = data.id;
            token.role = isEligible ? (data.role as "uploader" | "viewer") : "viewer";
          } else {
            token.id = token.id || token.sub || user?.id || token.email;
            token.role = isEligible ? "uploader" : "viewer";
          }
        } catch {
          token.id = token.id || token.sub || user?.id || token.email;
          token.role = isEligible ? "uploader" : "viewer";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const isEligible = Boolean(token.isUploaderEligible || session.user.email?.toLowerCase() === UPLOADER_EMAIL.toLowerCase());
        session.user.id = String(token.id || token.sub || session.user.email || "");
        session.user.isUploaderEligible = isEligible;
        session.user.role = isEligible ? (token.role as "uploader" | "viewer" || "uploader") : "viewer";
      }
      return session;
    }
  }
};
