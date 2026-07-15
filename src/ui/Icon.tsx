// Inline SVG icons: original minimal glyphs per unit/building/upgrade/action.
export function Icon({ id, size = 28 }: { id: string; size?: number }) {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 32 32' };
  const cyan = '#3fd2ff';
  const orange = '#ff9c41';
  const acid = '#9dff3f';
  const magenta = '#ff4dd2';
  const steel = '#aebfd9';
  switch (id) {
    case 'attack':
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="10" fill="none" stroke="#f87171" strokeWidth="2" />
          <circle cx="16" cy="16" r="3" fill="#f87171" />
          <path d="M16 2v6M16 24v6M2 16h6M24 16h6" stroke="#f87171" strokeWidth="2" />
        </svg>
      );
    case 'stop':
      return (
        <svg {...common}>
          <rect x="8" y="8" width="16" height="16" rx="2" fill="#f87171" />
        </svg>
      );
    case 'hold':
      return (
        <svg {...common}>
          <path d="M16 4l10 6v12l-10 6-10-6V10z" fill="none" stroke={orange} strokeWidth="2.5" />
          <circle cx="16" cy="16" r="3" fill={orange} />
        </svg>
      );
    case 'patrol':
      return (
        <svg {...common}>
          <path d="M6 10a12 12 0 0120 6M26 22a12 12 0 01-20-6" fill="none" stroke={cyan} strokeWidth="2.5" />
          <path d="M26 10v6h-6M6 22v-6h6" fill="none" stroke={cyan} strokeWidth="2.5" />
        </svg>
      );
    case 'rally':
      return (
        <svg {...common}>
          <path d="M8 28V6" stroke={steel} strokeWidth="2.5" />
          <path d="M8 6h16l-4 6 4 6H8" fill={cyan} opacity="0.9" />
        </svg>
      );
    case 'ability:emp':
      return (
        <svg {...common}>
          <path d="M18 3L8 18h7l-2 11 11-16h-7z" fill={cyan} />
        </svg>
      );
    case 'ability:nanobloom':
      return (
        <svg {...common}>
          <path d="M16 6v20M6 16h20" stroke="#5cff9d" strokeWidth="5" strokeLinecap="round" />
          <circle cx="16" cy="16" r="11" fill="none" stroke="#5cff9d" strokeWidth="1.5" opacity="0.6" />
        </svg>
      );
    case 'u:splicer':
      return (
        <svg {...common}>
          <path d="M22 16l-6 6-6-6 6-6z" fill={steel} />
          <path d="M22 20l4 4M10 8l6 0" stroke={orange} strokeWidth="2.5" />
        </svg>
      );
    case 'u:sentinel':
      return (
        <svg {...common}>
          <path d="M14 4l8 8-4 12H10L6 12z" fill={steel} />
          <path d="M14 14h14" stroke={cyan} strokeWidth="3" />
        </svg>
      );
    case 'u:bulwark':
      return (
        <svg {...common}>
          <path d="M26 16l-6 10H8l-4-10 4-10h12z" fill={steel} />
          <path d="M30 16l-6 4v-8z" fill={orange} />
        </svg>
      );
    case 'u:arccaster':
      return (
        <svg {...common}>
          <ellipse cx="14" cy="20" rx="10" ry="6" fill={steel} />
          <path d="M10 14l-2-8M18 14l2-8" stroke={cyan} strokeWidth="2.5" />
          <circle cx="14" cy="12" r="4" fill={cyan} opacity="0.7" />
        </svg>
      );
    case 'u:patchwright':
      return (
        <svg {...common}>
          <circle cx="14" cy="16" r="9" fill={steel} />
          <path d="M24 12l6-2-2 6" fill="none" stroke="#5cff9d" strokeWidth="2.5" />
          <path d="M14 12v8M10 16h8" stroke="#5cff9d" strokeWidth="2.5" />
        </svg>
      );
    case 'b:citadel':
      return (
        <svg {...common}>
          <path d="M16 3l12 7v12l-12 7-12-7V10z" fill="none" stroke={cyan} strokeWidth="2" />
          <rect x="12" y="10" width="8" height="12" fill={steel} />
        </svg>
      );
    case 'b:fabricator':
      return (
        <svg {...common}>
          <path d="M4 26V12l8 5v-5l8 5V9h8v17z" fill={steel} />
          <circle cx="24" cy="6" r="2" fill={orange} />
        </svg>
      );
    case 'b:uplink':
      return (
        <svg {...common}>
          <path d="M16 28V8" stroke={steel} strokeWidth="3" />
          <path d="M8 12a11 11 0 0116 0M11 16a7 7 0 0110 0" fill="none" stroke={cyan} strokeWidth="2" />
          <circle cx="16" cy="6" r="2.5" fill={cyan} />
        </svg>
      );
    case 'b:capacitor':
      return (
        <svg {...common}>
          <path d="M16 4l6 8-2 10h-8l-2-10z" fill={steel} />
          <ellipse cx="16" cy="26" rx="9" ry="3" fill="none" stroke={orange} strokeWidth="2" />
        </svg>
      );
    case 'b:turret':
      return (
        <svg {...common}>
          <path d="M16 14a6 6 0 016 6v6H10v-6a6 6 0 016-6z" fill={steel} />
          <path d="M16 14V4M12 8l4-4 4 4" stroke={orange} strokeWidth="2.5" fill="none" />
        </svg>
      );
    case 'b:spawner':
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="10" fill={magenta} opacity="0.7" />
          <circle cx="16" cy="16" r="4" fill={acid} />
        </svg>
      );
    case 'r:plating':
      return (
        <svg {...common}>
          <path d="M16 3l11 5v9c0 7-5 10-11 12-6-2-11-5-11-12V8z" fill={steel} />
          <path d="M16 8l7 3v6c0 4-3 6-7 8-4-2-7-4-7-8v-6z" fill={cyan} opacity="0.5" />
        </svg>
      );
    case 'r:overclock':
      return (
        <svg {...common}>
          <circle cx="16" cy="17" r="11" fill="none" stroke={orange} strokeWidth="2.5" />
          <path d="M16 17l6-6M16 10V6M12 4h8" stroke={orange} strokeWidth="2.5" />
        </svg>
      );
    case 'res:shards':
      return (
        <svg {...common}>
          <path d="M16 4l7 10-7 14-7-14z" fill={cyan} />
        </svg>
      );
    case 'res:flux':
      return (
        <svg {...common}>
          <path d="M18 3L9 18h6l-2 11 10-16h-6z" fill={orange} />
        </svg>
      );
    case 'supply':
      return (
        <svg {...common}>
          <circle cx="11" cy="12" r="5" fill={steel} />
          <circle cx="22" cy="14" r="4" fill={steel} opacity="0.7" />
          <path d="M4 26c0-5 14-5 14 0M15 26c0-4 13-4 13 0" stroke={steel} strokeWidth="2.5" fill="none" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M16 4l10 6v12l-10 6-10-6V10z" fill="none" stroke={steel} strokeWidth="2" />
        </svg>
      );
  }
}
