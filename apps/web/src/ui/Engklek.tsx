import { useLayoutEffect, useRef } from "react";
import { Icon } from "./Icon";
import { Pipit } from "./Pipit";

export type TileState = "done" | "skipped" | "current" | "todo" | "postponed";
export interface Tile {
  key: string;
  label: string;
  state: TileState;
}

const STATE_TEXT: Record<TileState, string> = { done: "selesai", skipped: "dilewati", current: "sekarang", todo: "berikutnya", postponed: "ditunda" };

export const motionAllowed = (element: Element) =>
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !element.closest('[data-motion="off"]');

/** Moves Pipit between tiles with a FLIP arc, so the hop survives Pipit re-rendering inside a new tile. */
function usePipitHop(index: number) {
  const container = useRef<HTMLDivElement>(null);
  const pipit = useRef<SVGSVGElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const box = container.current?.getBoundingClientRect();
    const rect = pipit.current?.getBoundingClientRect();
    if (!box || !rect || !pipit.current) return;
    const next = { x: rect.left - box.left, y: rect.top - box.top };
    const previous = last.current;
    last.current = next;
    if (!previous || (previous.x === next.x && previous.y === next.y)) return;
    if (!motionAllowed(pipit.current)) {
      pipit.current.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
      return;
    }
    const dx = previous.x - next.x;
    const dy = previous.y - next.y;
    pipit.current.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: `translate(${dx / 2}px, ${dy / 2 - 16}px)` },
        { transform: "translate(0, 0)" },
      ],
      { duration: 400, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
    );
  }, [index]);

  return { container, pipit };
}

/** Engklek, the Indonesian hopscotch: each tile is a real step or stage, and Pipit marks the current one. */
export function Engklek({ tiles, label, size = "md", pipitIndex, resting = false, onCurrent, currentLabel }: {
  tiles: Tile[];
  label: string;
  size?: "sm" | "md" | "lg";
  pipitIndex?: number;
  resting?: boolean;
  onCurrent?: () => void;
  currentLabel?: string;
}) {
  const found = tiles.findIndex((tile) => tile.state === "current");
  const position = pipitIndex ?? (found >= 0 ? found : tiles.length - 1);
  const { container, pipit } = usePipitHop(position);

  return (
    <div ref={container} className={`engklek engklek-${size}`}>
      <ol aria-label={label}>
        {tiles.map((tile, index) => {
          const content = (
            <>
              <span className="tile-mark" aria-hidden="true">{tile.state === "done" ? <Icon name="check" size={size === "sm" ? 12 : 20} /> : index + 1}</span>
              <span className="sr-only">{`${tile.label}, ${STATE_TEXT[tile.state]}`}</span>
            </>
          );
          return (
            <li key={tile.key} className={`tile tile-${tile.state} shape-${index % 3}`} aria-current={tile.state === "current" ? "step" : undefined} title={tile.label}>
              {tile.state === "current" && onCurrent ? (
                <button type="button" className="tile-button" onClick={onCurrent} aria-label={`${index + 1}, ${currentLabel ?? tile.label}`}>{content}</button>
              ) : content}
              {index === position && <Pipit ref={pipit} resting={resting} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
