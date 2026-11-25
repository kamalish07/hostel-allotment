# Hostel Allotment

Live: https://kamalish07.github.io/hostel-allotment/

Room allotment for Hostel H4, with a GS console and a student portal. The hostel has three floors of six
8-room wings around a central courtyard (144 single rooms, numbered 101–148, 201–248, 301–348). Students
are labelled by graduating class: Class of 2028 (final year) and Class of 2029 (incoming).

## Run it

```
npm install
npm run dev
```

Open http://localhost:5173. The sign-in page lets you enter as the GS or as any student (demo only, no passwords).

```
npm test          # replays the worked example from the design document through the engine
npm run simulate  # 60 full allotments on the 150-student sample, checking every rule
npm run build
```

## What's where

| Path | What it is |
| --- | --- |
| `src/lib/engine.js` | Allocation engine: priority classes, choice passes, fallback, final placement. No UI. |
| `src/lib/store.js` | App state (saved in the browser), every GS and student action, validation. |
| `src/lib/seed.js` | The building and a 150-student sample with 75 applications. |
| `src/components/BuildingMap.jsx` | Floor plan: switch floors, click a wing to zoom in, pick rooms. |
| `src/components/ChoicePlanner.jsx` | Plan plus the three choices, with who gets which room. |
| `src/admin/` | GS console: Overview, Building, Students (with profiles), Applications, Allotment, Settings. |
| `src/student/` | Student portal: Home, Choose rooms, Round 2 / late form, My room, Building, Profile. |
| `scripts/simulate.mjs` | Stress test of the whole allotment. |

## Try the full cycle

1. As **Ishaan Chopra** (25CE013), open Choose rooms. Click a wing on the plan, pick 2 rooms side by side for
   each of the three choices, tap a room in a choice to change who sleeps there, and submit.
2. As the **GS**, close Round 1 and run it. Review the draft on Allotment, then approve.
3. As any student in Round 2, choose again from free rooms. As **Neel Banerjee** (25ME012), send a late form.
4. As the **GS**, close Round 2, check the waitlist, move or swap someone with a reason, and publish.
5. As any student, open **My room** to see the room, the wing, and how it was decided.

Settings → Reset demo data puts everything back.

## Deploy to GitHub Pages

```
npm run deploy
```

Builds the site and pushes it to the `gh-pages` branch, which GitHub Pages serves at the address above.

## Publish as a claude.ai Artifact

```
npm run build:publish
```

Writes `../publish/hostel-allotment.html`: one self-contained page. The hosted build leaves out CSV export,
because hosted pages can't download files.

## Production notes

- Data lives in `localStorage`. A real deployment needs a server and database behind the same actions in
  `store.js`, and the college login instead of the demo sign-in.
- Deadlines are shown to students but rounds close when the GS closes them.
