import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Afterimage — Places remembered in time",
  description:
    "Explore how cities and rooms change through shared memory. Walk the map, scrub through years, and preserve your own spaces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
