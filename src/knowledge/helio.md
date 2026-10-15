# Helio

Page: /portfolio/helio. Live site: https://helio.education. Year: 2026. Zakaria's role: product, design, and engineering.

## What it is
Helio is a real-time, voice-first AI tutor for math and science that teaches on a whiteboard. It is meant to replace a static lesson video with a live tutor. A student talks to it naturally and can interrupt at any time. Helio explains out loud while it writes, draws, highlights, and animates on an unlimited whiteboard, with speech and drawing synchronized word by word, and every checkable claim verified before it is spoken.

The first subjects are math and science, from upper elementary through university: algebra through calculus, intro mechanics, waves, electromagnetism, general and intro organic chemistry, and elementary arithmetic and fractions. English comes first; the architecture is built to support more languages later.

## Why it is built this way
- Lesson videos are one way: a student cannot ask them to slow down or explain an arrow. Text chatbots bring back conversation but lose the whiteboard. Helio tries to combine both.
- Helio is designed as a performance system, not a chatbot. One server-owned timeline schedules speech, ink, highlights, and camera motion together. On the student's device the audio clock is the master, so network jitter can pause a lesson but never put the voice and drawing out of sync.
- "Nothing false reaches the student": any numeric, symbolic, geometric, or chemical claim needs a verification record before it can be said or drawn.
- "The model names, the engine places": the AI never outputs coordinates, sizes, or colors. Deterministic code handles layout, handwriting, and timing.
- "Compile what repeats, generate what deviates": common explanations are prepared and verified ahead of time; live models handle the parts specific to each student.

## How it works
- Each tutor turn is written as two-line "beats" in a small action language called Helio Script: a head line carrying the claims and the drawing, then a say line with the words. The head line is verified before the say line goes to speech synthesis.
- Four model roles: an on-device Reflex classifier for voice activity and interruptions, a fast Performer that is always the speaker, a Planner that plans ahead off the critical path, and an Assessor that reads how the student is doing.
- A shared deterministic core written in Rust runs on the server and, compiled to WebAssembly, in the browser. It handles the board, layout, typesetting, handwriting ink, the timeline, and verification, and browser and server results match bit for bit.
- A provider layer puts every model and voice vendor behind a typed interface, so vendors can be swapped by configuration.
- Every session is a replayable event log.
- Interruptions are written as acceptance tests. For example, if a student says "wait, go back," the voice ducks within about 70 ms, the pen freezes, and the board pans back to the previous step. A student saying "mm-hmm" should not interrupt it.
- Safety and privacy for minors are set to the strictest applicable standard by default (COPPA, FERPA, GDPR and others). There are accounts for students, parents, teachers, and districts.

## Design and research
The blueprint came from 18 research documents (about 110,000 words and roughly 1,100 cited sources) and seven rounds of adversarial review. Findings it used include: verification has to be structural; free-form animation code is the wrong primitive for an AI teacher; learning science favors short spoken turns with synchronized drawing.

## Stack
Rust (four crates: the core, a WebAssembly binding, provider ports, and a session server), WebAssembly, TypeScript and React for the client, Cloudflare Workers and Durable Objects at the edge, Supabase (Postgres with row-level security), and a SymPy worker for heavier math verification.

## Status
The first build phase is done: the core, the timeline, Helio Script, the provider layer, verify-on-emit, the session server, the web client, the edge, and the database. Seven prepared lessons play end to end, with pause and resume. CI checks that native and WebAssembly replays are bit-identical on every push.

## Measured numbers (from the repository)
262k lines of Rust, 3,503 tests, 1,970 commits in two weeks, 4 Rust crates with one core shared by client and server.
