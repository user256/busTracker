import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "busTracker",
  description: "Live bus tracking, timetables, and tickets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
