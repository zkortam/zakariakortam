import type { Metadata } from "next";
import { Fraunces, Inter_Tight } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Dock } from "@/components/Dock";
import { Ambient } from "@/components/Ambient";
import { PageTransition } from "@/components/PageTransition";
import { StructuredData } from "@/components/StructuredData";
import { MotionProvider } from "@/components/MotionProvider";

const sans = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://zakariakortam.com'),
  title: {
    default: "Zakaria Kortam | Product Manager & Builder",
    template: "%s | Zakaria Kortam"
  },
  description: "Associate Product Manager, Innovation at DigiCert. Builder of Helio, Surf, Surf Messenger, SPICE++, and AiroFind. Previously founding AI engineer at FacilisAI and product engineering at Incorta. UC San Diego EE. Based in San Jose, CA.",
  keywords: [
    "Zakaria Kortam",
    "Product Manager",
    "DigiCert",
    "Helio",
    "Surf",
    "SPICE++",
    "AiroFind",
    "AI Engineer",
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
    title: "Zakaria Kortam | Product Manager & Builder",
    description: "Associate Product Manager, Innovation at DigiCert. Builder of Helio, Surf, SPICE++, and AiroFind.",
    siteName: "Zakaria Kortam",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zakaria Kortam | Product Manager & Builder",
    description: "Associate Product Manager, Innovation at DigiCert. UC San Diego EE.",
    creator: "@zakariakortam",
    site: "@zakariakortam",
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${fraunces.variable}`}>
      <head>
        <meta name="theme-color" content="#040304" />
      </head>
      <body className="grain font-sans antialiased">
        <StructuredData />
        <MotionProvider>
          <Ambient />
          <Navigation />
          <PageTransition>
            {children}
          </PageTransition>
          <Footer />
          <Dock />
        </MotionProvider>
      </body>
    </html>
  );
}
