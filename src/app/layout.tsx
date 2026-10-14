import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { StructuredData } from "@/components/StructuredData";
import { Room } from "@/components/Room";
import { Transitions } from "@/components/Transitions";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Observer } from "@/components/Observer";
import { Nav } from "@/components/Nav";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const HEAD_SCRIPT =
  "(function(){var d=document.documentElement;d.classList.add('js');try{if(location.pathname==='/'&&!sessionStorage.getItem('zk-intro')){d.dataset.intro='play';sessionStorage.setItem('zk-intro','1')}else{d.dataset.intro='done'}}catch(e){d.dataset.intro='done'}})();";

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
    <html lang="en" className={geist.variable} data-tone-top="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
        <meta name="theme-color" content="#14060A" />
      </head>
      <body>
        <a href="#main" className="skip">
          Skip to content
        </a>
        <StructuredData />
        <Room />
        <Transitions>
          <SmoothScroll />
          <Observer />
          <Nav />
          <div id="page">{children}</div>
        </Transitions>
      </body>
    </html>
  );
}
