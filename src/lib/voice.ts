/** Copy written in Zakaria's voice for the Principles and Now pages. */

export const PRINCIPLES: { head: string; body: string; proof: string; id?: string }[] = [
  {
    head: 'Start from zero.',
    body: 'The best products begin as one clear idea and a working thing you can hold, not a deck. I get to the working thing fast.',
    proof: 'Helio reached 1,970 commits in its first two weeks.',
    id: 'helio',
  },
  {
    head: 'Build the whole thing.',
    body: 'Product, design, and code are one job to me, not three handoffs. Owning all of it is how the details stay right.',
    proof: 'Surf runs web, iOS, and Android from one codebase I design and write.',
    id: 'surf',
  },
  {
    head: 'Design is how it works and how it feels.',
    body: 'I care about the details people notice without knowing why: the timing of a transition, the weight of a word, the one fewer step.',
    proof: 'RTL++ answers why a test failed, not just that it did.',
    id: 'rtl-plus-plus',
  },
  {
    head: 'Ship, then ship again.',
    body: 'Small releases, real feedback, fast fixes. Getting it into people’s hands beats getting it perfect in a document.',
    proof: 'Surf is on its fourth version since 2021.',
    id: 'surf',
  },
  {
    head: 'Use every tool.',
    body: 'AI and the cloud change how fast an idea becomes a product. I use them every day, and I check their work.',
    proof: '28,295 tests check the code agents help me write.',
  },
]

export const NOW_UPDATED = 'October 2026'

export const NOW: { label: string; text: string; href?: string }[] = [
  { label: 'Work', text: 'New products in digital trust, on the Innovation team at DigiCert.', href: '/portfolio/digicert' },
  { label: 'Building', text: 'Helio, a voice AI tutor that teaches math and science on a live whiteboard.', href: '/portfolio/helio' },
  { label: 'Just shipped', text: 'RTL++, Verilog and FPGA design in the browser, launched this month.', href: '/portfolio/rtl-plus-plus' },
  { label: 'Ongoing', text: 'Surf, the social platform I started in 2021, now on its fourth version.', href: '/portfolio/surf' },
  { label: 'This site', text: 'Rebuilt so each project page runs that project’s real code in your browser.' },
]
