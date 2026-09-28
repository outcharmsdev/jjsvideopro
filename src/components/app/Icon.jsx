const PATHS = {
  play: <path d="M5 3.5v9l7-4.5z" />,
  pause: <path d="M5.5 3.5v9M10.5 3.5v9" />,
  copy: <><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" /></>,
  check: <path d="M3 8.5l3 3 7-7" />,
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" />,
  refresh: <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5V5h-2.5" />,
  chevron: <path d="M4 6l4 4 4-4" />,
  sliders: <><path d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7" /><circle cx="11" cy="4.5" r="1.5" /><circle cx="5" cy="11.5" r="1.5" /></>,
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  pencil: <path d="M10.5 3L13 5.5 6 12.5H3.5V10z" />,
  upload: <path d="M8 10.5v-8M5 5.5l3-3 3 3M3 10.5v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" />,
};

export default function Icon({ name }) {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}