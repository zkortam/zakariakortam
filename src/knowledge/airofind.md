# AiroFind

Page: /portfolio/airofind. Live site: https://airofind.com. Year: 2026. Zakaria's role: product, design, and engineering.

## What it is
AiroFind is a flight search that prices every departure and return date pair around your trip and finds the cheapest. It has a plain black interface that keeps out of the way of the results. Most flight search sites are slow and crowded; AiroFind asks a few questions one step at a time (where from, where to, airports, travel window, how long to stay, passengers, cabin, stops, airlines, and how deep to search), then searches.

## How the search works
AiroFind reads Google Flights with a real headless browser, because Google Flights renders its results in the browser. Instead of brute force, the search is price guided:
1. Survey: a few page loads read Google's date picker calendar (the cheapest round trip for every departure day at a given trip length) and its 7 by 7 date grid, which prices 49 departure and return combinations at once. The whole travel window gets priced in a handful of page loads.
2. Focus: it repeatedly opens the cheapest date pair it has not inspected yet. Each load returns the real itineraries for those dates and a fresh 7 by 7 grid around them, so the search climbs toward neighboring cheaper dates and trip lengths.
3. Stop: once the remaining candidates are clearly pricier than the best found, or the time budget runs out.

Users pick a search depth (quick, balanced, or deep) that trades time for how many date pairs get priced. For the cheapest results it also reads the actual return flight, so a cheap fare with a punishing return is visible. Filters such as airports, passengers, cabin, stops, and airlines are applied by Google itself through its structured query, and prices are totals for all passengers. The same search asked again within a few minutes is answered from a cache.

## Stack
A Next.js front end on Vercel, with a Three.js globe on the home screen and Framer Motion. The scraper is a headless Chromium service Zakaria runs in a locked-down container on its own Azure VM (non-root, read-only, no extra capabilities, firewalled from private networks).

## Measured numbers
49 fares priced per grid read, 105 commits, 1 scraper on its own Azure VM.
