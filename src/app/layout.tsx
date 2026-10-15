import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import "./visual.css";
import { StructuredData } from "@/components/StructuredData";
import { Room } from "@/components/Room";
import { Transitions } from "@/components/Transitions";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Observer } from "@/components/Observer";
import { Assistant } from "@/components/assistant/Assistant";
import { Nav } from "@/components/Nav";
import { QuietLayer } from "@/components/QuietLayer";
import { LiquidGlass } from "@/components/LiquidGlass";
import { KineticType } from "@/components/KineticType";
import { Warm } from "@/components/Warm";
import { ThemeColor } from "@/components/ThemeColor";
import { Wordmark } from "@/components/Wordmark";
import { CardLight } from "@/components/CardLight";
import { CursorView } from "@/components/CursorView";
import { TOD_SCRIPT } from "@/lib/tod";
import { SPECULATION_RULES, VT_SCRIPT } from "@/lib/instant";
import { SITE_URL } from "@/lib/seo";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Metadata (years, labels, figures' captions) in mono; pull quotes in a serif italic. Both are accents only.
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// Sets html.js and the intro mode before first paint. The opening titles are CSS; they hold on the closed
// gate until the portrait has decoded (900ms cap), so the first frames of the film are never lost to loading.
const HEAD_SCRIPT =
  "(function(){var d=document.documentElement;d.classList.add('js');try{if(location.pathname==='/'&&!sessionStorage.getItem('zk-intro')){d.dataset.intro='play';sessionStorage.setItem('zk-intro','1');var on=0,go=function(){if(on)return;on=1;requestAnimationFrame(function(){requestAnimationFrame(function(){d.classList.add('go')})})};setTimeout(go,900);var w=function(){var i=document.querySelector('.hero-portrait img');if(!i)return go();var f=function(){i.decode?i.decode().then(go,go):go()};if(i.complete)f();else{i.addEventListener('load',f);i.addEventListener('error',go)}};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',w):w()}else{d.dataset.intro='done'}}catch(e){d.dataset.intro='done'}})();";

const HOME_TITLE = "Zakaria Kortam | Product Manager & Builder";
const HOME_DESCRIPTION =
  "Zakaria Kortam, Product Manager (Innovation) at DigiCert, builds products 0 to 1: Helio, Surf, Surf Messenger, SPICE++, RTL++, and AiroFind.";

// viewport-fit=cover lets the oxblood run under notches, islands and the home indicator; the safe-area
// insets in globals.css keep every control clear of them. theme-color starts oxblood and then follows the
// section under the bar (ThemeColor). Android Chrome resizes the page above the keyboard.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#14060A",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/brand/icon.svg', type: 'image/svg+xml' },
      { url: '/brand/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/icon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
  },
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
    "Facilis",
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
    <html lang="en" className={`${geist.variable} ${mono.variable} ${serif.variable}`} data-tone-top="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: TOD_SCRIPT + VT_SCRIPT }} />
        <script id="zk-spec" type="speculationrules" dangerouslySetInnerHTML={{ __html: SPECULATION_RULES }} />
      </head>
      <body>
        <a href="#main" className="skip">
          Skip to content
        </a>
        <StructuredData />
        <div className="print-head" aria-hidden="true">
          <Wordmark as="p" />
        </div>
        <Room />
        <Transitions>
          <SmoothScroll />
          <Warm />
          <ThemeColor />
          <Observer />
          <Nav />
          <Assistant />
          <LiquidGlass />
          <KineticType />
          <CardLight />
          <CursorView />
          <div id="page">{children}</div>
        </Transitions>
        <QuietLayer />
      </body>
    </html>
  );
}
