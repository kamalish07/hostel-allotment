import { useState } from 'react';
import { student, memberIds, readiness, wingOf } from '../lib/store.js';
import { blockLabel } from '../lib/engine.js';
import { FLOOR_NAMES } from '../lib/seed.js';
import BuildingMap, { MapLegend } from './BuildingMap.jsx';
import { useAct } from './ui.jsx';
import Icon from './Icon.jsx';

const ORD = ['1st', '2nd', '3rd'];
const short = (s, sid) => s.students[sid].name.split(' ')[0];
const ini = (s, sid) => s.students[sid].name.split(' ').map((p) => p[0]).slice(0, 2).join('');

/*
  Building plan on the left, choices on the right. Open a wing on the plan, hover to preview a block,
  click to place it in the active choice. Each placed choice shows its rooms as seats with who sleeps
  where; tap a seat to change the person. Clicking a placed choice flies the plan to its wing.
  `side` is extra content for the right column (fallback setting, submit).
*/
export default function ChoicePlanner({ s, app, round = 1, editable, demand, taken = {}, side, readOnlyNote }) {
  const act = useAct();
  const src = round === 1 ? app : app.r2;
  const members = memberIds(app);
  const size = members.length;
  const check = readiness(s, app, round);
  const firstEmpty = src.choices.findIndex((c) => !c || !c.length);
  const [active, setActive] = useState(firstEmpty >= 0 ? firstEmpty : 0);
  const [preview, setPreview] = useState(null);
  const [reveal, setReveal] = useState(null);
  const filled = src.choices.filter((c) => c && c.length).length;

  const cellInfo = (r) => {
    if (s.rooms[r].status !== 'available') return { state: 'blocked', label: 'Unavailable' };
    if (taken[r]) return { state: 'taken', label: 'Taken' };
    return { state: 'free' };
  };
  const slotOf = (r) => {
    const n = src.choices.map((c, i) => (i !== active && c && c.includes(r) ? i + 1 : null)).filter(Boolean);
    return n.length ? n.join(' ') : null;
  };
  const place = (block) => {
    if (!act(() => student.setChoice(app.id, active, block, round))) return;
    const next = src.choices.findIndex((c, i) => i !== active && (!c || !c.length));
    if (next >= 0) setActive(next);
    setPreview(null);
  };
  const choose = (i) => {
    setActive(i);
    const c = src.choices[i];
    if (c && c.length) setReveal({ room: c[0], n: Date.now() });
  };
  const where = (rooms) => {
    const w = wingOf(s, rooms[0]);
    return w ? `${w.name} · ${FLOOR_NAMES[w.floor]} · ${w.dir}` : '';
  };

  let hint;
  if (!editable) hint = <span>{readOnlyNote || 'This form can’t be changed now.'}</span>;
  else if (preview && preview.ok) hint = <span>Click to place <b>{blockLabel(preview.b)}</b> as your {ORD[active]} choice</span>;
  else if (preview) hint = <span><b>{blockLabel(preview.b)}</b> can’t be chosen: some of those rooms are taken or unavailable</span>;
  else hint = <span>Your <b>{ORD[active]} choice</b>: open a wing, then pick {size > 1 ? `${size} rooms side by side` : 'a room'}</span>;

  return (
    <div className="planner">
      <div className="plan-col">
        <div className={`plan-hint ${editable ? '' : 'ro'} ${preview ? (preview.ok ? 'ok' : 'bad') : ''}`} aria-live="polite">
          {editable && <span className="plan-hint-tag">{ORD[active]}</span>}
          {hint}
        </div>
        <BuildingMap wings={s.wings} mode={editable ? 'pick' : 'view'} size={size} cellInfo={cellInfo}
          selected={src.choices[active] || []} slotOf={slotOf} onPick={place} demand={demand} reveal={reveal}
          onPreview={(b, ok) => setPreview(b ? { b, ok } : null)} />
        <MapLegend items={[['sel', `${ORD[active]} choice`], ['slot', 'Your other choices'], ['free', 'Free'],
          ...(Object.keys(taken).length ? [['taken', 'Taken']] : []), ['blocked', 'Unavailable']]} />
      </div>

      <aside className="plan-side">
        <section className="side-card choices-card">
          <div className="cc-head">
            <h3>Your choices</h3>
            <span className="cc-count">{filled}/3</span>
          </div>
          <div className="cc-bar" aria-hidden="true"><i style={{ width: `${(filled / 3) * 100}%` }} /></div>
          <p className="muted small">Best first. Within your priority class, a 1st choice beats anyone else’s 2nd or 3rd.</p>
          {[0, 1, 2].map((i) => {
            const rooms = src.choices[i] && src.choices[i].length ? src.choices[i] : null;
            const map = src.mappings[i] || [];
            // offer to copy this order only when another choice uses a different order
            const others = active === i && src.choices.some((c, j) => j !== i && c && c.length === size && (src.mappings[j] || []).join() !== map.join());
            return (
              <div key={i} className={`ccard ${active === i ? 'active' : ''} ${rooms ? 'filled' : ''} ${check.perChoice[i] ? 'err' : ''}`}>
                <button type="button" className="ccard-head" onClick={() => choose(i)} aria-pressed={active === i}
                  aria-label={`${ORD[i]} choice${rooms ? `, rooms ${blockLabel(rooms)}` : ', not chosen'}`}>
                  <span className="ccard-rank">{i + 1}</span>
                  <span className="ccard-title">
                    <span key={rooms ? blockLabel(rooms) : 'none'} className={`ccard-block ${rooms ? 'pop' : ''}`}>{rooms ? `Rooms ${blockLabel(rooms)}` : 'Not chosen yet'}</span>
                    <span className="ccard-where">{rooms ? where(rooms) : active === i && editable ? 'Pick on the plan →' : `${ORD[i]} choice`}</span>
                  </span>
                  {rooms ? <Icon name="eye" className="ccard-go" /> : null}
                </button>
                {rooms && editable && (
                  <button type="button" className="ccard-clear" aria-label={`Clear ${ORD[i]} choice`}
                    onClick={() => { act(() => student.setChoice(app.id, i, [], round)); setActive(i); }}><Icon name="x" /></button>
                )}
                {rooms && size > 1 && (
                  <div className="seats">
                    {rooms.map((r, k) => (
                      <label key={r} className={`seat ${editable ? '' : 'ro'}`} title={editable ? `Change who gets ${r}` : undefined}>
                        <span className="seat-no">{r}</span>
                        <span className="seat-who"><span className="avatar xs">{map[k] ? ini(s, map[k]) : '?'}</span>{map[k] ? short(s, map[k]) : '—'}</span>
                        {editable && (
                          <select className="seat-select" value={map[k] || ''} aria-label={`Who gets room ${r}`}
                            onChange={(e) => act(() => student.setMapping(app.id, i, k, e.target.value, round))}>
                            {members.map((m) => <option key={m} value={m}>{s.students[m].name}</option>)}
                          </select>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                {rooms && size > 1 && editable && others && (
                  <button type="button" className="link small ccard-copy" onClick={() => act(() => student.copyMapping(app.id, i, round), 'Same order used for every choice')}>
                    Use this order for every choice
                  </button>
                )}
                {check.perChoice[i] && <p className="ccard-err"><Icon name="alert" />{check.perChoice[i]}</p>}
              </div>
            );
          })}
        </section>
        {side}
      </aside>
    </div>
  );
}

export function Checklist({ items }) {
  return (
    <ul className="checklist">
      {items.map(([ok, text]) => (
        <li key={text} className={ok ? 'ok' : ''}><span className="ck">{ok ? <Icon name="check" /> : null}</span>{text}</li>
      ))}
    </ul>
  );
}

export { short, ini };
