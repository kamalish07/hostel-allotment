import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { FLOOR_NAMES } from '../lib/seed.js';

/*
  Hostel floor plan. Six wings sit around a central courtyard (volleyball court), with the stage at the
  top, lifts in the middle and the entrance lobby at the bottom. Each wing is a U around its corridor:
  its first four rooms run along one side, the last four come back along the other, so rooms next to
  each other in the wing's list are neighbours.

  Floor view: click a wing to zoom into it. Wing view: big room tiles to pick or inspect.
  mode: 'view' | 'pick' (pick a block of `size` rooms) | 'select' (click any room)
  cellInfo(roomId) -> { state: 'free'|'blocked'|'pre'|'taken'|'held'|'mine', label?, sub?, tone?, title? }
*/

const FULL = [0, 0, 1000, 720];
const PLACE = {
  A: { x: 130, y: 180, a: 90, lx: 130, ly: 62 },
  B: { x: 226, y: 398, a: 32, lx: 104, ly: 318 },
  C: { x: 318, y: 572, a: 90, lx: 210, ly: 572 },
  D: { x: 682, y: 572, a: 90, lx: 790, ly: 572 },
  E: { x: 774, y: 398, a: -32, lx: 896, ly: 318 },
  F: { x: 870, y: 180, a: 90, lx: 870, ly: 62 },
};
const HUB = { x: 500, y: 410 };
const TOP_LABEL = { 1: 'Stage', 2: 'Washing machine room', 3: 'Terrace access' };
const LOBBY_LABEL = { 1: 'Entrance lobby', 2: 'TV room', 3: 'Common room' };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function wingBox(letter) {
  const p = PLACE[letter];
  const rad = (p.a * Math.PI) / 180;
  const hw = Math.abs(Math.cos(rad)) * 94 + Math.abs(Math.sin(rad)) * 56;
  const hh = Math.abs(Math.sin(rad)) * 94 + Math.abs(Math.cos(rad)) * 56;
  let w = hw * 2 + 90;
  let h = hh * 2 + 90;
  if (w / h > FULL[2] / FULL[3]) h = w * (FULL[3] / FULL[2]); else w = h * (FULL[2] / FULL[3]);
  return [p.x - w / 2, p.y - h / 2, w, h];
}

export default function BuildingMap({ wings, mode = 'view', size = 1, cellInfo, selected = [], focus, slotOf, onPick, onRoom, demand, wingNote, onPreview, reveal }) {
  const floors = useMemo(() => [...new Set(wings.map((w) => w.floor))].sort((a, b) => a - b), [wings]);
  const [floor, setFloor] = useState(floors[0]);
  const [open, setOpen] = useState(null); // wing id shown in the wing view
  const [zooming, setZooming] = useState(null); // wing id being zoomed into
  const [vb, setVb] = useState(FULL);
  const [hoverWing, setHoverWing] = useState(null);
  const [hover, setHover] = useState(null);
  const [dir, setDir] = useState(0);
  const anim = useRef(0);
  const vbRef = useRef(FULL);
  vbRef.current = vb;

  const timer = useRef(0);
  const animateTo = (target, done) => {
    cancelAnimationFrame(anim.current);
    clearTimeout(timer.current);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(anim.current);
      clearTimeout(timer.current);
      setVb(target);
      if (done) done();
    };
    if (reduced()) { finish(); return; }
    const from = vbRef.current;
    const t0 = performance.now();
    const dur = 460;
    const step = (now) => {
      const k = ease(Math.min(1, (now - t0) / dur));
      setVb(from.map((v, i) => v + (target[i] - v) * k));
      if (k < 1) anim.current = requestAnimationFrame(step);
      else finish();
    };
    anim.current = requestAnimationFrame(step);
    // Animation frames pause in background tabs; make sure the zoom always completes.
    timer.current = setTimeout(finish, dur + 150);
  };
  useEffect(() => () => { cancelAnimationFrame(anim.current); clearTimeout(timer.current); }, []);

  const wingById = useMemo(() => Object.fromEntries(wings.map((w) => [w.id, w])), [wings]);
  const wingOfRoom = useMemo(() => { const m = {}; wings.forEach((w) => w.rooms.forEach((r) => { m[r] = w; })); return m; }, [wings]);

  const openWing = (id) => {
    const w = wingById[id];
    if (!w) return;
    setHover(null);
    setDir(0);
    setZooming(id);
    animateTo(wingBox(w.letter), () => { setOpen(id); setZooming(null); });
  };
  const closeWing = () => {
    setOpen(null);
    setHover(null);
    if (onPreview) onPreview(null);
    animateTo(FULL);
  };
  const stepWing = (delta) => {
    const same = wings.filter((x) => x.floor === floor);
    const i = same.findIndex((x) => x.id === open);
    const next = same[(i + delta + same.length) % same.length];
    setDir(delta);
    setOpen(next.id);
    setHover(null);
    setVb(wingBox(next.letter));
  };
  const changeFloor = (f) => {
    if (f === floor) return;
    cancelAnimationFrame(anim.current); clearTimeout(timer.current);
    setDir(f > floor ? 1 : -1);
    setOpen(null);
    setZooming(null);
    setVb(FULL);
    setFloor(f);
  };

  // Jump to a wing when asked (e.g. clicking a choice card).
  useEffect(() => {
    if (!reveal || !reveal.room) return;
    const w = wingOfRoom[reveal.room];
    if (!w || open === w.id) return;
    if (w.floor !== floor) {
      cancelAnimationFrame(anim.current); clearTimeout(timer.current);
      setFloor(w.floor);
      setOpen(w.id);
      setVb(wingBox(w.letter));
    } else openWing(w.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal && reveal.n]);

  const pickable = (r) => ['free', 'mine'].includes(cellInfo(r).state);
  // The block for a room: prefer one starting at that room, otherwise the nearest free block that contains it.
  const blockIn = (w, r) => {
    const i = w.rooms.indexOf(r);
    const last = w.rooms.length - size;
    const first = Math.max(0, Math.min(i, last));
    const starts = [];
    for (let st = Math.max(0, i - size + 1); st <= Math.min(i, last); st++) starts.push(st);
    starts.sort((a, b) => Math.abs(a - i) - Math.abs(b - i));
    for (const st of starts) {
      const b = w.rooms.slice(st, st + size);
      if (b.every(pickable)) return b;
    }
    return w.rooms.slice(first, first + size);
  };
  const inFreeBlock = (r) => { const w = wingOfRoom[r]; return w ? blockIn(w, r).every(pickable) : false; };
  const openW = open ? wingById[open] : null;
  const preview = mode === 'pick' && hover && openW ? blockIn(openW, hover) : [];
  const previewOk = preview.length > 0 && preview.every(pickable);

  const enterRoom = (r) => {
    setHover(r);
    if (mode === 'pick' && onPreview && openW) { const b = blockIn(openW, r); onPreview(b, b.every(pickable)); }
  };
  const clickRoom = (r) => {
    if (mode === 'select') { if (onRoom) onRoom(r); return; }
    if (mode !== 'pick' || !openW) return;
    const b = blockIn(openW, r);
    if (b.every(pickable) && onPick) onPick(b);
  };

  const freeIn = (w) => w.rooms.filter((r) => cellInfo(r).state === 'free').length;
  const fits = (w) => w.rooms.some((r, i) => i + size <= w.rooms.length && w.rooms.slice(i, i + size).every(pickable));
  const note = (w) => {
    if (wingNote) return wingNote(w);
    if (mode === 'pick' && size > 1) return fits(w) ? `${freeIn(w)} free · fits` : `${freeIn(w)} free · too full`;
    return `${freeIn(w)} free`;
  };
  const floorHasMarks = (f) => wings.filter((w) => w.floor === f).some((w) => w.rooms.some((r) => selected.includes(r) || (slotOf && slotOf(r))));

  // ---------------- floor view (SVG)
  const svgRoom = (w, r, x, y) => {
    const info = cellInfo(r);
    const sel = selected.includes(r);
    const slot = slotOf ? slotOf(r) : null;
    const cls = ['sv-room', `st-${info.state}`, info.tone ? `tone-${info.tone}` : '', sel ? 'sel' : '', slot && !sel ? 'slot' : '', focus === r ? 'focus' : ''].filter(Boolean).join(' ');
    const a = PLACE[w.letter].a;
    return (
      <g key={r} className={cls} transform={`translate(${x} ${y})`}>
        <rect width="40" height="34" rx="6" />
        <text x="20" y="17" transform={`rotate(${-a} 20 17)`}>{r}</text>
        {slot && !sel ? <circle cx="35" cy="5" r="7" className="sv-slot" /> : null}
        {slot && !sel ? <text x="35" y="5.5" className="sv-slot-n" transform={`rotate(${-a} 35 5)`}>{String(slot)[0]}</text> : null}
      </g>
    );
  };

  const busy = zooming || open;
  const svgWing = (w) => {
    const p = PLACE[w.letter];
    const north = w.rooms.slice(0, 4);
    const south = w.rooms.slice(4).reverse();
    const cls = ['sv-wing', hoverWing === w.id ? 'hot' : '', busy && busy !== w.id ? 'dim' : ''].filter(Boolean).join(' ');
    return (
      <g key={w.id} className={cls} transform={`translate(${p.x} ${p.y}) rotate(${p.a})`} role="button" tabIndex={busy ? -1 : 0}
        aria-label={`${w.name}, ${FLOOR_NAMES[w.floor]}, ${note(w)}. Open wing.`}
        onClick={() => openWing(w.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWing(w.id); } }}
        onMouseEnter={() => setHoverWing(w.id)} onMouseLeave={() => setHoverWing(null)} onFocus={() => setHoverWing(w.id)} onBlur={() => setHoverWing(null)}>
        <rect className="sv-wing-body" x="-94" y="-56" width="188" height="112" rx="14" />
        <rect className="sv-corr" x="-85" y="-11" width="170" height="22" rx="5" />
        {north.map((r, k) => svgRoom(w, r, -85 + k * 43, -49))}
        {south.map((r, k) => svgRoom(w, r, -85 + k * 43, 15))}
      </g>
    );
  };

  const wingsHere = wings.filter((w) => w.floor === floor);
  const svgLabels = wingsHere.map((w) => {
    const p = PLACE[w.letter];
    return (
      <g key={`l-${w.id}`} className={`sv-label ${hoverWing === w.id ? 'hot' : ''} ${busy ? 'hide' : ''}`} transform={`translate(${p.lx} ${p.ly})`} pointerEvents="none">
        <rect x="-62" y="-15" width="124" height="30" rx="15" />
        <text y="1"><tspan className="sv-label-b">{w.name}</tspan><tspan dx="6">{note(w)}</tspan></text>
      </g>
    );
  });

  // ---------------- wing view tiles
  const tile = (r) => {
    const info = cellInfo(r);
    const isSel = selected.includes(r);
    const inPrev = preview.includes(r);
    const slot = slotOf ? slotOf(r) : null;
    const interactive = mode === 'select' || (mode === 'pick' && pickable(r) && inFreeBlock(r));
    const cls = ['room', `st-${info.state}`, info.tone ? `tone-${info.tone}` : '', isSel ? 'sel' : '', focus === r ? 'focus' : '',
      inPrev ? (previewOk ? 'prev' : 'prev-bad') : '', interactive ? 'clickable' : '', mode === 'pick' && pickable(r) && !interactive ? 'nofit' : ''].filter(Boolean).join(' ');
    return (
      <button type="button" key={r} className={cls}
        onMouseEnter={() => enterRoom(r)} onFocus={() => enterRoom(r)} onClick={() => clickRoom(r)}
        disabled={mode !== 'view' && !interactive} tabIndex={mode === 'view' ? -1 : 0}
        aria-pressed={mode === 'pick' ? isSel : undefined}
        aria-label={`Room ${r}${info.label ? `, ${info.label}` : ''}${info.sub ? `, ${info.sub}` : ''}`} title={info.title}>
        <span className="room-no">{r}</span>
        {slot && !isSel ? <span className="room-slot">{slot}</span> : null}
        {demand && demand[r] && info.state === 'free' ? <span className="room-demand" title={`${demand[r]} in your priority class put this 1st`}>{demand[r]} want</span> : null}
        {info.label ? <span className="room-label">{info.label}</span> : null}
        {info.sub ? <span className="room-sub">{info.sub}</span> : null}
      </button>
    );
  };

  return (
    <div className="bmap">
      <div className="bmap-bar">
        <div className="floor-tabs" role="tablist" aria-label="Floors">
          {floors.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={floor === f} className={floor === f ? 'on' : ''} onClick={() => changeFloor(f)}>
              {FLOOR_NAMES[f]}{floorHasMarks(f) ? <i className="ft-dot" title="Has your choices" /> : null}
            </button>
          ))}
        </div>
        <span className="bmap-tip">{open ? 'Pick in this wing, or go back to the floor plan' : 'Click a wing to zoom in'}</span>
      </div>

      <div className="bmap-stage" onMouseLeave={() => { setHover(null); if (onPreview) onPreview(null); }}>
        <svg key={floor} className={`bmap-svg ${dir > 0 ? 'in-up' : dir < 0 ? 'in-down' : ''}`} viewBox={vb.join(' ')} preserveAspectRatio="xMidYMid meet" role="group"
          aria-label={`${FLOOR_NAMES[floor]} plan`}>
          <polygon className="sv-court" points="215,108 785,108 900,300 735,478 265,478 100,300" />
          {wingsHere.map((w) => {
            const p = PLACE[w.letter];
            return <line key={`c-${w.id}`} className="sv-path" x1={HUB.x} y1={HUB.y} x2={p.x} y2={p.y} />;
          })}
          <g className="sv-feature court">
            <rect x="410" y="196" width="180" height="104" rx="6" />
            <line x1="500" y1="196" x2="500" y2="300" />
            <text x="500" y="252" className="sv-feature-t">{floor === 1 ? 'Volleyball court' : 'Courtyard below'}</text>
          </g>
          <g className="sv-feature">
            <rect x="410" y="28" width="180" height="58" rx="29" />
            <text x="500" y="61" className="sv-feature-t">{TOP_LABEL[floor] || 'Stage'}</text>
          </g>
          <g className="sv-feature lifts">
            {[0, 1, 2].map((k) => <rect key={k} x={455 + k * 32} y="392" width="26" height="22" rx="4" />)}
            <text x="500" y="432" className="sv-feature-s">Lifts</text>
          </g>
          <g className="sv-feature">
            <polygon points="405,500 595,500 625,640 375,640" />
            <text x="500" y="575" className="sv-feature-t">{LOBBY_LABEL[floor] || 'Lobby'}</text>
          </g>
          {floor === 1 ? (
            <g className="sv-entry">
              <line x1="500" y1="708" x2="500" y2="664" />
              <polygon points="490,668 500,650 510,668" />
              <text x="522" y="694">Entry</text>
            </g>
          ) : null}
          <g className="sv-feature" transform="translate(112 528) rotate(32)"><rect x="-44" y="-20" width="88" height="40" rx="8" /><text y="5" className="sv-feature-s">Toilets</text></g>
          <g className="sv-feature" transform="translate(888 528) rotate(-32)"><rect x="-44" y="-20" width="88" height="40" rx="8" /><text y="5" className="sv-feature-s">Toilets</text></g>
          {wingsHere.map(svgWing)}
          {svgLabels}
        </svg>

        {openW && (
          <div className="wing-view" role="dialog" aria-label={`${openW.name}, ${FLOOR_NAMES[openW.floor]}`}>
            <div className="wv-head">
              <button type="button" className="btn light sm" onClick={closeWing}><Icon name="chevL" />Floor plan</button>
              <div className="wv-title">
                <b>{openW.name} · {FLOOR_NAMES[openW.floor]}</b>
                <span>{openW.dir} wing · {note(openW)}</span>
              </div>
              <div className="wv-nav">
                <button type="button" className="btn light icon sm" onClick={() => stepWing(-1)} aria-label="Previous wing"><Icon name="chevL" /></button>
                <button type="button" className="btn light icon sm" onClick={() => stepWing(1)} aria-label="Next wing"><Icon name="chevR" /></button>
              </div>
            </div>
            <div key={openW.id} className={`wv-plan ${dir > 0 ? 'slide-l' : dir < 0 ? 'slide-r' : ''}`}>
              <div className="wv-row">{openW.rooms.slice(0, 4).map(tile)}</div>
              <div className="wv-corr"><span>Corridor</span></div>
              <div className="wv-row">{openW.rooms.slice(4).reverse().map(tile)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MapLegend({ items }) {
  return (
    <div className="legend">
      {items.map(([cls, text]) => (
        <span key={text} className="legend-item"><span className={`legend-swatch ${cls}`} />{text}</span>
      ))}
    </div>
  );
}
