# Hostel Allotment

Live: https://kamalish07.github.io/hostel-allotment/

Room allotment for a hostel of single rooms in 8-room wings, with a GS console and a student portal.
The rules follow the design document (Hostel-Allotment-Design.pdf).

## Run it

```
npm install
npm run dev
```

Open http://localhost:5173. The sign-in page lets you enter as the GS or as any student (demo only, no passwords).

```
npm test     # replays the worked example from the design document through the engine
npm run build
```

## What's where

| Path | What it is |
| --- | --- |
| `src/lib/engine.js` | Allocation engine: priority classes, choice passes, fallback, final placement. No UI. |
| `src/lib/store.js` | App state (saved in the browser), every GS and student action, validation. |
| `src/lib/seed.js` | Sample hostel H4: 4 wings, 37 students, 13 applications, one pending invite. |
| `src/admin/` | GS console: Overview, Building, Students (with candidate profiles), Applications, Allotment, Settings. |
| `src/student/` | Student portal: Home, Building, Application, Round 2 / late form, My room, Profile. |
| `src/components/` | Side-menu shell, building floor plan, choice picker, profile, buttons, drawer, toasts. |

## Try the full cycle

1. As **Kiran Hegde**, accept Ishaan's invite. As **Ishaan Chopra**, pick three 2-room blocks and submit.
2. As the **GS**, close Round 1 and run it. Review the draft on Allotment, then approve.
3. As **Nikhil Reddy**, choose a new block in Round 2. As **Neel Banerjee**, send a late form.
4. As the **GS**, close Round 2, check the waitlist, move or swap someone with a reason, and publish.
5. As any student, open **My room** to see the room, the wing, and how it was decided.

Settings → Reset demo data puts everything back.

## Production notes

- Data lives in `localStorage`. A real deployment needs a server and database behind the same actions in `store.js`, and the college login instead of the demo sign-in.
- Deadlines are shown to students but rounds close when the GS closes them.

## Deploy to GitHub Pages

```
npm run deploy
```

Builds the site and pushes it to the `gh-pages` branch, which GitHub Pages serves at the address above.

## Publish as a claude.ai Artifact

```
npm run build:publish
```

Writes `../publish/hostel-allotment.html`: one self-contained page (CSS and JS inlined, Inter from Google Fonts) for hosting as a claude.ai Artifact. The hosted build leaves out CSV export, because hosted pages can't download files. Routes use plain hash names (`#gs-rooms`, `#s-24EC249-apply`) so links work on the hosted page.
