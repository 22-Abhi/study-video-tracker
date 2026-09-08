import "./globals.css";
import ThemeInit from "@/components/ThemeInit";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><ThemeInit />{children}</body>
    </html>
  );
}