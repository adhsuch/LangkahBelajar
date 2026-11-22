import type { SkillCode } from "@langkahbelajar/shared";

const PATHS = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v10h4.5v-6h4v6h4.5V10",
  steps: "M4 20h4v-5h4v-5h4V5h4",
  library: "M5 4h4v16H5zM10 4h4v16h-4zM15.5 5l3.8-.9 3 15.2-3.8.9z",
  user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10",
  play: "M8 5l11 7-11 7z",
  pause: "M9 5v14M15 5v14",
  speaker: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4zM15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11",
  bulb: "M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.8 10.6c.8.7 1.3 1.5 1.3 2.4h5c0-.9.5-1.7 1.3-2.4A6 6 0 0 0 12 3",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  eyeOff: "M3 3l18 18M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6M6.6 6.8A16 16 0 0 0 2.5 12S6 18.500 12 18.500c1.600 0 3-.4 4.300-1.100M9.900 9.900a3 3 0 0 0 4.200 4.200",
  exit: "M14 4H6v16h8M10 12h11M17.500 8.500 21 12l-3.500 3.500",
  check: "M5 12.500l4.500 4.500L19 7.500",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  skip: "M6 5l9 7-9 7zM18.500 5v14",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  back: "M15 5l-7 7 7 7",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.500V12l3 2",
  retry: "M4 5v5h5M4.600 15a8 8 0 1 0 .9-7.500L4 10",
  offline: "M3 3l18 18M8.500 16a5 5 0 0 1 7 0M5 12.300a10 10 0 0 1 3.200-2.100M19 12.300a10 10 0 0 0-5.300-2.700M2 8.800a15 15 0 0 1 3.800-2.500M22 8.800A15 15 0 0 0 10.500 5M12 19.500h.01",
  online: "M8.500 16a5 5 0 0 1 7 0M5 12.300a10 10 0 0 1 14 0M2 8.800a15 15 0 0 1 20 0M12 19.500h.01",
  book: "M12 7v13M12 7c-1.500-1.500-4-2-8-2v13c4 0 6.500.5 8 2 1.500-1.500 4-2 8-2V5c-4 0-6.500.5-8 2z",
  pencil: "M4 20l1-4.500L16.500 4a2.100 2.100 0 0 1 3 0l.5.5a2.100 2.100 0 0 1 0 3L8.500 19 4 20zM14.500 6l3.500 3.500",
  count: "M9 4 7 20M17 4l-2 16M4.500 9h16M3.500 15h16",
  hand: "M9 11V5a1.500 1.500 0 0 1 3 0v5.500M12 10.500V9a1.500 1.500 0 0 1 3 0v2M15 11a1.500 1.500 0 0 1 3 0v3.500a6.500 6.500 0 0 1-6.500 6.500c-2.300 0-3.700-.9-5-2.500l-3-4a1.500 1.500 0 0 1 2.300-1.900L9 15",
  sprout: "M12 21v-9M12 12C12 8 9 5.500 4.500 5.500 4.500 10 7.500 12 12 12zM12 15c0-3.500 3-6 7.500-6 0 4.500-3 6-7.500 6z",
  calendar: "M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4",
} as const;

export type IconName = keyof typeof PATHS;

export const SKILL_ICONS: Record<SkillCode, IconName> = {
  READING: "book",
  WRITING: "pencil",
  COUNTING: "count",
  INSTRUCTIONS: "hand",
  ENGAGEMENT: "sprout",
  ROUTINE: "calendar",
};

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
