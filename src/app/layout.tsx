import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Debian Web Terminal",
  description: "Persistent Debian GNU/Linux 11 cloud terminal with 24/7 process recovery",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: "var(--bg-primary)" }}>
        {children}
      </body>
    </html>
  );
}
