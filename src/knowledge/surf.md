# Surf and Surf Messenger

## Surf
Page: /portfolio/surf. Live site: https://surfsocial.org. Years: 2022 to now. Zakaria's role: product, design, and engineering. He builds it on his own.

Surf is a full social network built by one person, running on the web, iOS, and Android from one Next.js codebase. It has feeds, posts, shorts with a video editor in the browser, messaging and calls, live streaming, creator analytics, subscriptions, moderation, and family controls. Surf started in 2022 and the current version is the fourth, rebuilt on Next.js and Supabase.

How it is built:
- A Next.js App Router app (React, TypeScript) backed by Supabase (Postgres, Auth, Realtime). Server code owns privileged work; Postgres functions and row-level security (RLS) own data authorization close to the data.
- The iOS and Android apps are Capacitor shells that load the same web app. Native features go through one platform layer, so product code asks what the device can do instead of checking which platform it is on. A shell supplies capabilities, never screens.
- Security rules: what the UI shows is not authorization. Every database function is treated as a public endpoint, so access is enforced in the database itself. A migration lint and a test suite fail the build if a function is left callable by anyone or writes without checking its caller.
- Access rules are tested against a live database with real roles. Every release has to pass type checks, lint, unit tests, and end-to-end browser tests (Playwright).
- Media runs on Cloudflare R2 and Stream; payments on Stripe.

Measured numbers: 823k lines of TypeScript, 24,249 tests, 1,935 database migrations, 5,969 commits this year, 150+ routes on web, iOS, and Android.

## Surf Messenger
Page: /portfolio/surf-messenger. Live site: https://surfmessenger.com. Code: https://github.com/zkortam/SurfMessengerDesktop. Year: 2026.

Surf Messenger takes Surf's messaging and calls and makes them a separate app for macOS, Windows, iOS, and Android, on the same backend as Surf. Electron powers the desktop builds and Capacitor the mobile ones; every version loads the same web app, so a change ships everywhere at once. Messages are end-to-end encrypted with X3DH key agreement and the Double Ratchet (a new key for every message), across 51 crypto modules. The project page has a live demo that runs real encryption in the visitor's browser and shows what a server would see.
