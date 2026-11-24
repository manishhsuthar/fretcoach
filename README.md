# FretCoach

A guitar coach that runs in your browser. Pick a song and it shows where every finger goes, listens
through your microphone, and tells you when you got it right (or exactly which string is wrong).

## Start it

```sh
./start.sh
```

This opens http://localhost:8765 in your browser. Click **Mic off** in the sidebar (or any
"Turn on microphone" button) and allow microphone access. Press Ctrl+C in the terminal to stop.

Browsers only allow the microphone on `localhost` or `https` pages, so use `start.sh` rather than
double-clicking `index.html`. Everything runs locally: no account, and no audio leaves your computer.
`start.sh` uses Node.js when it's installed (needed for AI song search) and Python otherwise.

## First session (15 minutes)

1. **Tuner**: tune all six strings. Every session, because an out-of-tune guitar makes right chords sound wrong.
2. **Learn → Lesson 1**: finger numbers and the open strings. Pluck each string; FretCoach checks it.
3. **Lessons 4–6**: Em, Am, then G, C and D.
4. **Songs**: *He's Got the Whole World* (2 chords), then *Twinkle, Twinkle* (3 chords).

## The three modes

| Mode | What it does |
|---|---|
| **Practice** | Waits for you. Shows the chord, you strum once, it checks and moves on. Start here. |
| **Play along** | Metronome + one-bar count-in. Chords change on time and every bar is scored. |
| **Listen** | Plays the song so you hear how it should sound while the fretboard follows along. |

## Add any song

**Songs → Add a song**, then either:

- **Find it with AI**: type the song and artist. AI searches chord sites and guitar lessons, and returns
  the chords in the right key, with the capo, tempo, strum pattern and how many beats each chord lasts, so
  Play along matches the real song. Lyrics aren't included, for copyright reasons.
- **Paste it yourself** from any chord website. Chords written above the lyrics and `[C]inline` ChordPro
  both work, and so do section labels and `Capo 2` lines.

A pasted song that doesn't sound right? Open it and click **Find the real chords with AI**.
**Make it easier** in the player finds a capo position with easier chord shapes.

### Turn on AI song search (one time)

AI search runs Claude (model `claude-opus-5-5` with web search) on your own Claude API account, and
needs [Node.js](https://nodejs.org) 20.12 or newer.

1. Create an API key at [platform.claude.com](https://platform.claude.com/settings/keys).
2. Copy `.env.example` to `.env` in this folder and paste your key after `ANTHROPIC_API_KEY=`.
3. Run `./start.sh`. The first run installs the Claude SDK (`npm install`).

Each search uses a little API credit (web searches plus Claude's reading). `.env` is in `.gitignore`, so
your key is never committed, and the key stays in the local server: the browser never sees it.

## Tips for good detection

- Sit 30–80 cm from the laptop or mic, in a quiet room.
- **Settings → Calibrate for my room** sets the noise threshold for your room.
- If it can't hear you, raise **Input boost**. Noisy room or cheap mic: set checking to **Relaxed**.
- Use headphones if you turn on "Guitar plays along", or the mic will hear the app's guitar.

## Files

`index.html` and `css/style.css` hold the layout. `js/` contains: `music.js` (notes, chords,
voicings), `detect.js` (pitch and chord recognition), `audio.js` (synth, metronome, microphone),
`fretboard.js` (diagrams), `songs.js` (songs, lessons, chord-sheet parser), `core.js`, `player.js`
and `views.js` (the app). Progress is saved in your browser's local storage.

`server.js` is the local server: it serves the app on 127.0.0.1 only and runs the AI song finder
(`POST /api/find-song`, which streams progress and the finished chart).
