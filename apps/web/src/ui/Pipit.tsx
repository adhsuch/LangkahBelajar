import { forwardRef } from "react";

/** Pipit, the small bird who hops along the engklek tiles with the child. Decorative, so hidden from screen readers. */
export const Pipit = forwardRef<SVGSVGElement, { resting?: boolean; className?: string }>(function Pipit({ resting = false, className = "" }, ref) {
  return (
    <svg ref={ref} className={`pipit ${className}`} viewBox="0 0 98 90" aria-hidden="true" focusable="false">
      <path d="M38 73v12M54 73v12M32 86h13M48 86h13" fill="none" stroke="#171B3D" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 44 2 33l5 22z" fill="#333C8F" />
      <ellipse cx="44" cy="47" rx="32" ry="28" fill="#5561C4" />
      <ellipse cx="53" cy="57" rx="20" ry="16" fill="#FFE0D6" />
      <circle cx="66" cy="28" r="20" fill="#5561C4" />
      <circle cx="71" cy="36" r="5" fill="#FFB59E" />
      <path d="M21 40c12-10 27-3 25 14-10 7-23 1-25-14z" fill="#333C8F" />
      <path d="m84 24 12 6-12 6z" fill="#FF9E80" stroke="#171B3D" strokeWidth="1.500" strokeLinejoin="round" />
      {resting ? (
        <path d="M69 25q4 3.500 8 0" fill="none" stroke="#171B3D" strokeWidth="2.500" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="73" cy="24" r="4" fill="#171B3D" />
          <circle cx="74.500" cy="22.500" r="1.300" fill="#fff" />
        </>
      )}
    </svg>
  );
});
