import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { PageTransition } from "@/components/PageTransition";
import { StructuredData } from "@/components/StructuredData";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://zakariakortam.com'),
  title: {
    default: "Zakaria Kortam | AI Engineer & Product Engineer",
    template: "%s | Zakaria Kortam"
  },
  description: "AI Engineer at Facilis building agentic tools for enterprise. UC San Diego EE student specializing in Machine Learning & Controls. Previously at Incorta. Based in San Jose, CA.",
  keywords: [
    "Zakaria Kortam",
    "AI Engineer",
    "Product Engineer",
    "Machine Learning",
    "Agentic AI",
    "MCP",
    "React",
    "TypeScript",
    "Facilis",
    "UC San Diego",
    "San Jose",
    "Silicon Valley",
    "LLM",
    "GPT-4",
    "Full Stack",
    "Flutter",
  ],
  authors: [{ name: "Zakaria Kortam", url: "https://zakariakortam.com" }],
  creator: "Zakaria Kortam",
  publisher: "Zakaria Kortam",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://zakariakortam.com",
    title: "Zakaria Kortam | AI Engineer & Product Engineer",
    description: "AI Engineer at Facilis building agentic tools for enterprise. UC San Diego EE student specializing in Machine Learning & Controls.",
    siteName: "Zakaria Kortam",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zakaria Kortam - AI Engineer & Product Engineer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zakaria Kortam | AI Engineer & Product Engineer",
    description: "AI Engineer at Facilis building agentic tools for enterprise. UC San Diego EE student.",
    creator: "@zakariakortam",
    site: "@zakariakortam",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="font-inter antialiased">
        <StructuredData />
        <Navigation />
        <PageTransition>
          {children}
        </PageTransition>
        <Footer />
      </body>
    </html>
  );
}
