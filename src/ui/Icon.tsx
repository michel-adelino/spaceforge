import { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  select: <path d="M5 3l14 8-6 2-2 6z" />,
  wall: (
    <>
      <path d="M3 20h18M3 20V9h18v11" />
      <path d="M3 14.5h18M9 9v5.5M15 14.5V20M9 20v-5.5" />
    </>
  ),
  room: (
    <>
      <rect x="4" y="5" width="16" height="14" />
      <path d="M4 12h6" />
    </>
  ),
  door: (
    <>
      <path d="M6 21V3h10v18M3 21h18" />
      <path d="M16 5l4 1.5v13L16 21" />
      <circle cx="13" cy="12.5" r=".6" />
    </>
  ),
  window: (
    <>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M12 4v16M4 12h16" />
    </>
  ),
  measure: (
    <>
      <path d="M3 17L17 3l4 4L7 21z" />
      <path d="M7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 010 12h-3" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 000 12h3" />
    </>
  ),
  move: (
    <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
  ),
  rotate: (
    <>
      <path d="M20 12a8 8 0 11-2.6-5.9" />
      <path d="M20 4v5h-5" />
    </>
  ),
  scale: (
    <>
      <rect x="4" y="10" width="10" height="10" />
      <path d="M14 4h6v6M20 4l-8 8" />
    </>
  ),
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
  save: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </>
  ),
  folder: <path d="M3 6h6l2 2h10v11H3z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0113 0" />
      <path d="M16 4.6a3.5 3.5 0 010 6.8M18 14a6.5 6.5 0 013.5 6" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" />
      <path d="M16 8V4H4v12h4" />
    </>
  ),
  layers: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  panelL: (
    <>
      <rect x="3" y="4" width="18" height="16" />
      <path d="M9 4v16" />
    </>
  ),
  panelR: (
    <>
      <rect x="3" y="4" width="18" height="16" />
      <path d="M15 4v16" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  logo: (
    <>
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M9 21v-7h6v7" />
    </>
  ),
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}
