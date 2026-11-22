import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "../ui/Icon";

const segmenter = new Intl.Segmenter("id", { granularity: "grapheme" });
const graphemes = (text: string) => [...segmenter.segment(text)].map((part) => part.segment).filter((part) => part.trim());
const isTextual = (value: string) => /[\p{L}\p{N}]/u.test(value);

function optionLabel(option: string) {
  if (isTextual(option)) return option;
  const parts = graphemes(option);
  return parts.length > 1 ? `${parts.length} gambar ${parts[0]}` : option;
}

export function ChoiceResponse({ options, disabled, onAnswer, onHear }: { options: string[]; disabled: boolean; onAnswer: (value: string) => void; onHear?: (value: string) => void }) {
  return (
    <div className="choices">
      {options.map((option) => (
        <div className="choice-wrap" key={option}>
          <button type="button" className={`choice ${option.length > 3 ? "choice-long" : ""}`} aria-label={optionLabel(option)} disabled={disabled} onClick={() => onAnswer(option)}>{option}</button>
          {onHear && isTextual(option) && (
            <button type="button" className="choice-sound" aria-label={`Dengar ${option}`} onClick={() => onHear(option)}><Icon name="speaker" size={20} /></button>
          )}
        </div>
      ))}
    </div>
  );
}

export const countableObjects = (visual?: string) => {
  if (!visual) return [];
  const parts = graphemes(visual);
  return parts.some((part) => part !== "+" && isTextual(part)) ? [] : parts;
};

/** The child touches each object and sees the running count, so counting is done rather than guessed. */
export function CountBoard({ tokens, onCount }: { tokens: string[]; onCount?: (count: number) => void }) {
  const [order, setOrder] = useState<number[]>([]);
  function toggle(index: number) {
    const next = order.includes(index) ? order.filter((item) => item !== index) : [...order, index];
    setOrder(next);
    if (next.length > order.length) onCount?.(next.length);
  }
  return (
    <div className="count-board">
      <div className="count-objects">
        {tokens.map((token, index) =>
          token === "+" ? (
            <span className="count-plus" key={index} role="img" aria-label="tambah">+</span>
          ) : (
            <button type="button" key={index} className="count-object" aria-pressed={order.includes(index)} aria-label={`Benda ${index + 1}`} onClick={() => toggle(index)}>
              <span aria-hidden="true">{token}</span>
              {order.includes(index) && <b aria-hidden="true">{order.indexOf(index) + 1}</b>}
            </button>
          ),
        )}
      </div>
      <p className="count-total" aria-live="polite">{order.length > 0 ? `Sudah dihitung: ${order.length}` : "Sentuh satu per satu"}</p>
    </div>
  );
}

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function OrderResponse({ options, disabled, onAnswer }: { options: string[]; disabled: boolean; onAnswer: (values: string[]) => void }) {
  const [placed, setPlaced] = useState<string[]>([]);
  const list = useRef<HTMLOListElement>(null);
  const drag = useRef<{ index: number; startY: number; step: number; target: number; rows: HTMLElement[] } | null>(null);
  const tray = options.filter((option) => !placed.includes(option));

  function start(event: ReactPointerEvent<HTMLElement>, index: number) {
    if (event.button !== 0 || drag.current || !list.current) return;
    const rows = [...list.current.children] as HTMLElement[];
    const row = rows[index]!;
    const gap = rows[1] ? rows[1].getBoundingClientRect().top - rows[0]!.getBoundingClientRect().bottom : 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { index, startY: event.clientY, step: row.getBoundingClientRect().height + gap, target: index, rows };
    row.dataset.dragging = "true";
  }

  function track(event: ReactPointerEvent<HTMLElement>) {
    const state = drag.current;
    if (!state) return;
    const raw = event.clientY - state.startY;
    const min = -state.index * state.step;
    const max = (state.rows.length - 1 - state.index) * state.step;
    // Past either end the row follows at a fraction of the distance instead of hitting a wall.
    const offset = raw < min ? min + (raw - min) * 0.2 : raw > max ? max + (raw - max) * 0.2 : raw;
    state.rows[state.index]!.style.transform = `translateY(${offset}px) scale(1.02)`;
    state.target = Math.max(0, Math.min(state.rows.length - 1, state.index + Math.round(offset / state.step)));
    state.rows.forEach((row, index) => {
      if (index === state.index) return;
      const shift = index > state.index && index <= state.target ? -state.step : index < state.index && index >= state.target ? state.step : 0;
      row.style.transform = shift ? `translateY(${shift}px)` : "";
    });
  }

  function end() {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    for (const row of state.rows) {
      row.style.transition = "none";
      row.style.transform = "";
      delete row.dataset.dragging;
    }
    requestAnimationFrame(() => state.rows.forEach((row) => (row.style.transition = "")));
    if (state.target !== state.index) setPlaced((current) => move(current, state.index, state.target));
  }

  return (
    <div className="order">
      <ol ref={list} className="order-list" aria-label="Urutanmu">
        {placed.map((item, index) => (
          <li key={item} className="order-row">
            <span className="order-number" aria-hidden="true">{index + 1}</span>
            <span
              className="order-grip"
              aria-hidden="true"
              onPointerDown={(event) => start(event, index)}
              onPointerMove={track}
              onPointerUp={end}
              onPointerCancel={end}
            >
              <Icon name="grip" />
            </span>
            <span className="order-text">{item}</span>
            <span className="order-moves">
              <button type="button" className="icon-button" aria-label={`Naikkan ${item}`} disabled={disabled || index === 0} onClick={() => setPlaced(move(placed, index, index - 1))}><Icon name="up" /></button>
              <button type="button" className="icon-button" aria-label={`Turunkan ${item}`} disabled={disabled || index === placed.length - 1} onClick={() => setPlaced(move(placed, index, index + 1))}><Icon name="down" /></button>
            </span>
          </li>
        ))}
        {tray.map((item, index) => <li key={item} className="order-slot" aria-hidden="true">{placed.length + index + 1}</li>)}
      </ol>
      {tray.length > 0 && (
        <div className="choices">
          {tray.map((option) => <button type="button" key={option} className="choice choice-long" disabled={disabled} onClick={() => setPlaced([...placed, option])}>{option}</button>)}
        </div>
      )}
      <div className="row">
        <button type="button" className="button big" disabled={disabled || tray.length > 0} onClick={() => onAnswer(placed)}><Icon name="check" size={22} /> Kirim urutan</button>
        <button type="button" className="button quiet" disabled={disabled || placed.length === 0} onClick={() => setPlaced([])}><Icon name="retry" size={20} /> Ulang</button>
      </div>
    </div>
  );
}

// shortcut: stroke guides cover the provider's current letters, others get a start dot on the glyph until content grows.
const GUIDES: Record<string, { d: string; x: number; y: number }[]> = {
  A: [{ d: "M150 45 L72 255", x: 133, y: 91 }, { d: "M150 45 L228 255", x: 167, y: 91 }, { d: "M102 180 L198 180", x: 102, y: 180 }],
  B: [{ d: "M92 45 L92 255", x: 92, y: 45 }, { d: "M92 45 H160 C212 45 212 148 160 148 H92", x: 122, y: 45 }, { d: "M92 148 H168 C226 148 226 255 166 255 H92", x: 122, y: 148 }],
  I: [{ d: "M150 45 L150 255", x: 150, y: 45 }],
};

export function TraceResponse({ letter, disabled, onDone }: { letter: string; disabled: boolean; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [drawn, setDrawn] = useState(false);
  const guide = GUIDES[letter];

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    element.width = 300 * ratio;
    element.height = 300 * ratio;
    context.scale(ratio, ratio);
    context.lineWidth = 13;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#333C8F";
  }, [letter]);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left) * (300 / box.width), y: (event.clientY - box.top) * (300 / box.height) };
  };

  function draw(event: ReactPointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!last.current || !context) return;
    for (const item of event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent]) {
      const box = event.currentTarget.getBoundingClientRect();
      const next = { x: (item.clientX - box.left) * (300 / box.width), y: (item.clientY - box.top) * (300 / box.height) };
      context.beginPath();
      context.moveTo(last.current.x, last.current.y);
      context.lineTo(next.x, next.y);
      context.stroke();
      last.current = next;
    }
  }

  function clear() {
    canvas.current?.getContext("2d")?.clearRect(0, 0, 300, 300);
    setDrawn(false);
  }

  return (
    <div className="trace-wrap">
      <div className="trace">
        <svg viewBox="0 0 300 300" aria-hidden="true" focusable="false">
          <defs>
            <marker id="trace-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1l7 4-7 4" fill="none" stroke="#333C8F" strokeWidth="2" /></marker>
          </defs>
          {guide ? (
            <>
              {guide.map((stroke) => <path key={stroke.d} d={stroke.d} fill="none" stroke="#E6E8F8" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />)}
              {guide.map((stroke) => <path key={`line-${stroke.d}`} d={stroke.d} fill="none" stroke="#5561C4" strokeWidth="3" strokeDasharray="4 12" strokeLinecap="round" markerEnd="url(#trace-arrow)" />)}
              {guide.map((stroke, index) => (
                <g key={`dot-${stroke.d}`}>
                  <circle cx={stroke.x} cy={stroke.y} r="15" fill="#FF9E80" stroke="#171B3D" strokeWidth="2" />
                  <text x={stroke.x} y={stroke.y + 6} textAnchor="middle" fontSize="17" fontWeight="700" fill="#171B3D">{index + 1}</text>
                </g>
              ))}
            </>
          ) : (
            <>
              <text x="150" y="160" textAnchor="middle" dominantBaseline="middle" fontSize="240" fontWeight="700" fill="#E6E8F8">{letter}</text>
              <circle cx="150" cy="48" r="15" fill="#FF9E80" stroke="#171B3D" strokeWidth="2" />
            </>
          )}
        </svg>
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Area menelusuri huruf ${letter}`}
          onPointerDown={(event) => {
            if (last.current) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            last.current = point(event);
            setDrawn(true);
          }}
          onPointerMove={draw}
          onPointerUp={() => (last.current = null)}
          onPointerCancel={() => (last.current = null)}
        />
      </div>
      <div className="row">
        <button type="button" className="button big" disabled={disabled} onClick={onDone}><Icon name="check" size={22} /> Selesai</button>
        <button type="button" className="button quiet" disabled={!drawn} onClick={clear}><Icon name="retry" size={20} /> Hapus</button>
      </div>
    </div>
  );
}

export function StepStrip({ steps, active }: { steps: string[]; active: number }) {
  return (
    <ol className="step-strip">
      {steps.map((step, index) => (
        <li key={step} className={index < active ? "past" : index === active ? "active" : ""} aria-current={index === active ? "step" : undefined}>
          <span aria-hidden="true">{index < active ? <Icon name="check" size={18} /> : index + 1}</span>
          {step}
        </li>
      ))}
    </ol>
  );
}

/** Multi-step tasks highlight one instruction at a time and confirm each before moving on. */
export function DoneResponse({ steps, disabled, onDone }: { steps: string[]; disabled: boolean; onDone: () => void }) {
  const [active, setActive] = useState(0);
  const last = active >= steps.length - 1;
  return (
    <div className="stack">
      {steps.length > 1 && <StepStrip steps={steps} active={active} />}
      <button type="button" className="button big" disabled={disabled} onClick={() => (last ? onDone() : setActive(active + 1))}>
        <Icon name="check" size={22} /> {last ? "Selesai" : "Sudah"}
      </button>
    </div>
  );
}
