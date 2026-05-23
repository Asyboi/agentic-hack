import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

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
        className={ibmPlex.className}
        style={{
          margin: 0,
          minHeight: "100vh",
          backgroundColor: "#0c0f14",
          color: "#e8edf5",
        }}
      >
        {children}
      </body>
    </html>
  );
}
