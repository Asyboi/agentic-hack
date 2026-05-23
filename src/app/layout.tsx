import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolicyGuard — Live demo",
  description:
    "Compliance API for AI agents. Try three policy scenarios: blocked, allowed, modify.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={
          {
            "--font-body":
              '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            "--bg": "#0c0f14",
            "--text": "#e8edf5",
            "--accent": "#5b9fd4",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
