import "./globals.css";
import ThemeInit from "@/components/ThemeInit";

export const metadata = {
  title: "Study Video Tracker",
  description: "Track and organize your study videos with role-based access"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://img.youtube.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://img.youtube.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://accounts.google.com" />
      </head>
      <body>
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}