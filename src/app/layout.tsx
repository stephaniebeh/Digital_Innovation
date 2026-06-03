import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Afterimage — A Wayback Machine for 3D",
  description:
    "Explore how a place changes through collective memory. Upload photos, walk a spatial timeline.",
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
