/**
 * Instant document navigations, for the moments the client router is not in charge.
 *
 * Once the app has hydrated, every internal link is a client navigation (Transitions.tsx) that Next has
 * already prefetched, so a prerendered document would never be used. Before hydration (the first second on
 * a slow phone) and for the no-JS fallback links, a click is a full document navigation: these rules make
 * that one prerendered and instant in Chromium. Warm.tsx removes the rules once hydrated so no hover ever
 * pays for a prerender that cannot be used. Browsers without speculation rules ignore the script type.
 */
export const SPECULATION_RULES = JSON.stringify({
  prerender: [
    {
      source: 'document',
      where: {
        and: [
          { href_matches: '/*' },
          { not: { href_matches: '/_next/*' } },
          { not: { href_matches: '/*opengraph-image*' } },
          { not: { selector_matches: '[target=_blank], [download], [rel~=nofollow]' } },
        ],
      },
      eagerness: 'moderate',
    },
  ],
  prefetch: [
    {
      source: 'document',
      where: {
        and: [{ href_matches: '/*' }, { not: { href_matches: '/_next/*' } }, { not: { href_matches: '/*opengraph-image*' } }],
      },
      eagerness: 'eager',
    },
  ],
})

/**
 * Cross-document view transitions (Chromium 126+, Safari 18.2+): the bar stays put while the page dips,
 * the same choreography as the client transition. The name is set only for the length of the transition:
 * a permanent view-transition-name would make the bar a backdrop root and break its glass.
 * Client navigations never start a document view transition, so the two systems cannot double up.
 */
export const VT_SCRIPT =
  "(function(){function nav(){return document.querySelector('.nav')}addEventListener('pageswap',function(e){var n=nav();if(e.viewTransition&&n)n.style.viewTransitionName='zk-nav'});addEventListener('pagereveal',function(e){var n=nav();if(!e.viewTransition||!n)return;n.style.viewTransitionName='zk-nav';e.viewTransition.finished.finally(function(){n.style.viewTransitionName=''})})})();"
