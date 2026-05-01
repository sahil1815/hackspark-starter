import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RentPi — Smart Rental Platform",
  description:
    "RentPi is an AI-powered rental management platform. Browse products, check real-time availability, and get instant answers from our intelligent assistant.",
  keywords: ["rental", "platform", "AI", "product rental", "availability"],
  openGraph: {
    title: "RentPi — Smart Rental Platform",
    description: "AI-powered rental management made simple.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('rentpi-theme') || 'light';
                document.documentElement.setAttribute('data-theme', theme);
              })()
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
