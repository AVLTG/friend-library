import type { Metadata } from "next";
import { Merriweather, Inter } from "next/font/google";
import "./globals.css";

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-serif",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "BookShare - Friends Library",
  description: "Share your book library with friends",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${merriweather.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-cream antialiased">
        {children}
      </body>
    </html>
  );
}
