import { useState } from 'react';
import { roomNum } from '../lib/engine.js';
import { FLOOR_NAMES } from '../lib/store.js';

/*
  Floor plan of the hostel. Each floor: west wing | stairs and washrooms | east wing.
  Each wing is a U around its corridor: rooms 1–4 along the north side, 5–8 back along the south,
  so consecutive numbers are always next to each other.

  mode: 'view' | 'pick' (pick a block of `size` rooms) | 'select' (click any room)
  cellInfo(roomId) -> { state: 'free'|'blocked'|'pre'|'taken'|'held'|'mine', label?, sub?, tone?, title? }
*/
const LAYOUT = {
  east: { north: [1, 2, 3, 4], south: [8, 7, 6, 5] },
  west: { north: [4, 3, 2, 1], south: [5, 6, 7, 8] },
};

export default function BuildingMap({ wings, mode = 'view', size = 1, cellInfo, selected = [], focus, slotOf, onPick, onRoom, demand, wingNote, onPreview }) {
  const [hover, setHover] = useState(null);
  const blockAt = (wingId, n) => {
    const start = Math.min(n, 9 - size);
    return Array.from({ length: size }, (_, k) => `${wingId}${start + k}`);
  };
  const pickable = (r) => ['free', 'mine'].includes(cellInfo(r).state);
  const preview = mode === 'pick' && hover ? blockAt(hover[0], roomNum(hover)) : [];
  const previewOk = preview.length > 0 && preview.every(pickable);

  const enter = (r) => {
    setHover(r);
    if (mode === 'pick' && onPreview) {
      const b = blockAt(r[0], roomNum(r));
      onPreview(b, b.every(pickable));
    }
  };

  const click = (r) => {
    if (mode === 'select') { onRoom?.(r); return; }
    if (mode !== 'pick') return;
    const b = blockAt(r[0], roomNum(r));
    if (b.every(pickable)) onPick?.(b);
  };

  const room = (r) => {
    const info = cellInfo(r);
    const isSel = selected.includes(r);
    const inPrev = preview.includes(r);
    const slot = slotOf?.(r);
    const interactive = mode === 'select' || (mode === 'pick' && pickable(r));
    const cls = ['room', `st-${info.state}`, info.tone ? `tone-${info.tone}` : '', isSel ? 'sel' : '', focus === r ? 'focus' : '',
      inPrev ? (previewOk ? 'prev' : 'prev-bad') : '', interactive ? 'clickable' : ''].filter(Boolean).join(' ');
    return (
      <button type="button" key={r} className={cls}
        onMouseEnter={() => enter(r)} onFocus={() => enter(r)} onClick={() => click(r)}
        disabled={mode !== 'view' && !interactive} tabIndex={mode === 'view' ? -1 : 0}
        aria-pressed={mode === 'pick' ? isSel : undefined}
        aria-label={`Room ${r}${info.label ? `, ${info.label}` : ''}${info.sub ? `, ${info.sub}` : ''}`} title={info.title}>
        <span className="room-no">{r}</span>
        {slot && !isSel ? <span className="room-slot">{slot}</span> : null}
        {demand && demand[r] && info.state === 'free' ? <span className="room-demand" title={`${demand[r]} in your class picked this 1st`}>{demand[r]}</span> : null}
        {info.label ? <span className="room-label">{info.label}</span> : null}
        {info.sub ? <span className="room-sub">{info.sub}</span> : null}
      </button>
    );
  };

  const wing = (w) => {
    const lay = LAYOUT[w.side];
    return (
      <div className={`wingplan ${w.side}`} key={w.id}>
        <div className="wp-head">
          <span className="wp-name">{w.name}</span>
          <span className="wp-note">{wingNote ? wingNote(w) : `${w.side} side`}</span>
        </div>
        <div className="wp-body">
          <div className="wp-row">{lay.north.map((n) => room(`${w.id}${n}`))}</div>
          <div className="wp-corridor"><span>Corridor</span></div>
          <div className="wp-row">{lay.south.map((n) => room(`${w.id}${n}`))}</div>
        </div>
      </div>
    );
  };

  const floors = [...new Set(wings.map((w) => w.floor))].sort((a, b) => b - a); // top floor first, like a section drawing
  return (
    <div className="building" onMouseLeave={() => { setHover(null); onPreview?.(null); }}>
      {floors.map((f) => {
        const west = wings.find((w) => w.floor === f && w.side === 'west');
        const east = wings.find((w) => w.floor === f && w.side === 'east');
        return (
          <section className="floor" key={f} aria-label={FLOOR_NAMES[f]}>
            <div className="floor-name">{FLOOR_NAMES[f]}</div>
            <div className="floor-plan">
              {west ? wing(west) : <div />}
              <div className="core" aria-hidden="true">
                <span>Stairs</span>
                <span>Wash&shy;rooms</span>
              </div>
              {east ? wing(east) : <div />}
            </div>
          </section>
        );
      })}
      <div className="compass" aria-hidden="true">North ↑ · Rooms 1–4 on the north side, 5–8 on the south; neighbouring numbers are next to each other.</div>
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
