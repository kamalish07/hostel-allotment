import { useState } from 'react';
import { useStore, gs, resetDemo } from '../lib/store.js';
import { Button, ConfirmButton, useAct } from '../components/ui.jsx';
import { PageHead } from '../components/Shell.jsx';

export default function Settings() {
  const s = useStore();
  const act = useAct();
  const [seed, setSeed] = useState(String(s.settings.seed));
  const [r1, setR1] = useState(s.settings.r1Deadline);
  const [r2, setR2] = useState(s.settings.r2Deadline);
  const locked = Object.keys(s.lotteries).length > 0;

  const save = () => act(() => {
    const n = Number(seed);
    if (!Number.isInteger(n) || n < 1 || n > 999999) throw new Error('The seed must be a whole number between 1 and 999999.');
    gs.setSettings({ seed: locked ? s.settings.seed : n, r1Deadline: r1, r2Deadline: r2 });
  }, 'Settings saved');

  return (
    <>
      <PageHead title="Settings" />
      <div className="content settings">
        <section className="form-sec">
          <h2 className="h-sec">Deadlines</h2>
          <p className="muted measure">Shown to students. Rounds close when you close them on the Overview page.</p>
          <div className="form-grid">
            <label className="field"><span>Round 1 closes</span><input className="input" type="datetime-local" value={r1} onChange={(e) => setR1(e.target.value)} /></label>
            <label className="field"><span>Round 2 closes</span><input className="input" type="datetime-local" value={r2} onChange={(e) => setR2(e.target.value)} /></label>
          </div>
        </section>

        <section className="form-sec">
          <h2 className="h-sec">Lottery seed</h2>
          <p className="muted measure">Publish this number before Round 1 opens. Every lottery number and every random placement comes from it, so anyone can re-run the draw and get the same result.</p>
          <div className="form-grid">
            <label className="field">
              <span>Seed</span>
              <input className="input mono" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value)} disabled={locked} />
              {locked && <small className="muted">Locked: lottery numbers were drawn when Round 1 closed.</small>}
            </label>
          </div>
        </section>

        <div><Button kind="primary" onClick={save}>Save settings</Button></div>

        <section className="form-sec">
          <h2 className="h-sec">Rules in force</h2>
          <ol className="rules">
            <li><b>Type first.</b> Wing groups (5–8), then groups (2–4), then individuals.</li>
            <li><b>Then seniority.</b> Final years (Class of 2028) before incoming students (Class of 2029). A mixed group ranks with its incoming members.</li>
            <li><b>Then choice.</b> Within the same type and class, a 1st choice beats a 2nd, a 2nd beats a 3rd.</li>
            <li><b>Then size, then lottery.</b> Bigger group first; the lower lottery number settles exact ties.</li>
            <li><b>Blocks are all or nothing.</b> One taken room fails the whole choice.</li>
            <li><b>Late forms</b> come after every on-time application in Round 2.</li>
          </ol>
        </section>

        <section className="form-sec">
          <h2 className="h-sec">Demo data</h2>
          <ConfirmButton label="Reset demo data" kind="secondary" danger confirmLabel="Reset everything" onConfirm={() => act(resetDemo, 'Demo data reset')}>
            Restores the sample hostel and applications, and clears every run and override.
          </ConfirmButton>
        </section>
      </div>
    </>
  );
}
