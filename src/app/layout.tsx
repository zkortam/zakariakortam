import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { StructuredData } from "@/components/StructuredData";
import { Room } from "@/components/Room";
import { Transitions } from "@/components/Transitions";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Observer } from "@/components/Observer";
import { Assistant } from "@/components/assistant/Assistant";
import { Nav } from "@/components/Nav";
import { QuietLayer } from "@/components/QuietLayer";
import { SITE_URL } from "@/lib/seo";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Sets html.js and the intro mode before first paint. The opening titles are CSS; they hold on the closed
// gate until the portrait has decoded (900ms cap), so the first frames of the film are never lost to loading.
const HEAD_SCRIPT =
  "(function(){var d=document.documentElement;d.classList.add('js');try{if(location.pathname==='/'&&!sessionStorage.getItem('zk-intro')){d.dataset.intro='play';sessionStorage.setItem('zk-intro','1');var on=0,go=function(){if(on)return;on=1;requestAnimationFrame(function(){requestAnimationFrame(function(){d.classList.add('go')})})};setTimeout(go,900);var w=function(){var i=document.querySelector('.hero-portrait img');if(!i)return go();var f=function(){i.decode?i.decode().then(go,go):go()};if(i.complete)f();else{i.addEventListener('load',f);i.addEventListener('error',go)}};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',w):w()}else{d.dataset.intro='done'}}catch(e){d.dataset.intro='done'}})();";

const HOME_TITLE = "Zakaria Kortam | Product Manager & Builder";
const HOME_DESCRIPTION =
  "Zakaria Kortam, Associate Product Manager (Innovation) at DigiCert, builds products 0 to 1: Helio, Surf, Surf Messenger, SPICE++, RTL++, and AiroFind.";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Android Chrome: the page resizes above the keyboard, so the sheet needs no JS tracking.
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: HOME_TITLE,
    template: "%s | Zakaria Kortam"
  },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  keywords: [
    "Zakaria Kortam",
    "Product Manager",
    "DigiCert",
    "Helio",
    "Surf",
    "SPICE++",
    "Surf Messenger",
    "RTL++",
    "AiroFind",
    "Product Design",
    "AI Engineer",
    "Machine Learning",
    "Agentic AI",
    "MCP",
    "React",
    "TypeScript",
    "FacilisAI",
    "UC San Diego",
    "San Jose",
    "Silicon Valley",
    "LLM",
  ],
  authors: [{ name: "Zakaria Kortam", url: SITE_URL }],
  creator: "Zakaria Kortam",
  publisher: "Zakaria Kortam",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "profile",
    locale: "en_US",
    url: "/",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    siteName: "Zakaria Kortam",
    firstName: "Zakaria",
    lastName: "Kortam",
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
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
          <Assistant />
          <div id="page">{children}</div>
        </Transitions>
        <QuietLayer />
      </body>
    </html>
  );
}
