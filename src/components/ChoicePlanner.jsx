import { useState } from 'react';
import { student, memberIds, readiness, wingPlace } from '../lib/store.js';
import { blockLabel } from '../lib/engine.js';
import BuildingMap, { MapLegend } from './BuildingMap.jsx';
import { useAct } from './ui.jsx';
import Icon from './Icon.jsx';

const ORD = ['1st', '2nd', '3rd'];
const short = (s, sid) => s.students[sid].name.split(' ')[0];
const ini = (s, sid) => s.students[sid].name.split(' ').map((p) => p[0]).slice(0, 2).join('');

/*
  Plan on the left, choices on the right. Hover the plan to preview a block, click to place it in the
  active choice. Each placed choice lists its rooms with who sleeps where.
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
  const where = (rooms) => {
    const w = s.wings.find((x) => x.id === rooms[0][0]);
    return `${w.name} · ${wingPlace(w)}`;
  };

  let hint;
  if (!editable) hint = <span>{readOnlyNote || 'This form can’t be changed now.'}</span>;
  else if (preview && preview.ok) hint = <span>Click to place <b>{blockLabel(preview.b)}</b> as your {ORD[active]} choice</span>;
  else if (preview) hint = <span><b>{blockLabel(preview.b)}</b> can’t be chosen: some of those rooms are taken or unavailable</span>;
  else hint = <span>Placing your <b>{ORD[active]} choice</b> · {size > 1 ? `${size} rooms next to each other` : 'one room'} · hover the plan to preview</span>;

  return (
    <div className="planner">
      <div className="plan-col">
        <div className={`plan-hint ${editable ? '' : 'ro'} ${preview ? (preview.ok ? 'ok' : 'bad') : ''}`} aria-live="polite">
          {editable && <span className="plan-hint-tag">{ORD[active]}</span>}
          {hint}
        </div>
        <BuildingMap wings={s.wings} mode={editable ? 'pick' : 'view'} size={size} cellInfo={cellInfo}
          selected={src.choices[active] || []} slotOf={slotOf} onPick={place} demand={demand}
          onPreview={(b, ok) => setPreview(b ? { b, ok } : null)} />
        <MapLegend items={[['sel', `${ORD[active]} choice`], ['slot', 'Your other choices'], ['free', 'Free'],
          ...(Object.keys(taken).length ? [['taken', 'Taken']] : []), ['blocked', 'Unavailable']]} />
      </div>

      <aside className="plan-side">
        <section className="side-card">
          <div className="side-card-head">
            <h3>Your choices</h3>
            <span className="muted small">Best first. Inside your priority class, a 1st choice beats anyone’s 2nd or 3rd.</span>
          </div>
          {[0, 1, 2].map((i) => {
            const rooms = src.choices[i] && src.choices[i].length ? src.choices[i] : null;
            const map = src.mappings[i] || [];
            const others = src.choices.some((c, j) => j !== i && c && c.length === size);
            return (
              <div key={i} className={`ccard ${active === i && editable ? 'active' : ''} ${check.perChoice[i] ? 'err' : ''}`}
                onClick={() => editable && setActive(i)} role={editable ? 'button' : undefined} tabIndex={editable ? 0 : -1}
                onKeyDown={(e) => { if (editable && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setActive(i); } }}
                aria-label={`${ORD[i]} choice${rooms ? `, ${blockLabel(rooms)}` : ', not chosen'}`}>
                <div className="ccard-head">
                  <span className="ccard-rank">{i + 1}</span>
                  <div className="ccard-title">
                    <span className="ccard-block">{rooms ? blockLabel(rooms) : 'Not chosen'}</span>
                    <span className="ccard-where">{rooms ? where(rooms) : active === i && editable ? 'Click a room on the plan' : `${ORD[i]} choice`}</span>
                  </div>
                  {editable && rooms && (
                    <button type="button" className="btn xs ghost" onClick={(e) => { e.stopPropagation(); act(() => student.setChoice(app.id, i, [], round)); setActive(i); }}>Clear</button>
                  )}
                </div>
                {rooms && size > 1 && (
                  <div className="assign" onClick={(e) => e.stopPropagation()}>
                    {rooms.map((r, k) => (
                      <label className="assign-row" key={r}>
                        <span className="assign-room">{r}</span>
                        <span className="avatar xs">{map[k] ? ini(s, map[k]) : '?'}</span>
                        <select className="input sm" value={map[k] || ''} disabled={!editable} aria-label={`Who gets ${r}`}
                          onChange={(e) => act(() => student.setMapping(app.id, i, k, e.target.value, round))}>
                          {members.map((m) => <option key={m} value={m}>{s.students[m].name}</option>)}
                        </select>
                      </label>
                    ))}
                    {editable && others && (
                      <button type="button" className="link small" onClick={() => act(() => student.copyMapping(app.id, i, round), 'Same order used for every choice')}>
                        Use this order for every choice
                      </button>
                    )}
                  </div>
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
