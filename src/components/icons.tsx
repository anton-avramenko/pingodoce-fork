/**
 * Inline SVG icon set drawn from scratch for the POC.
 * Stroke-based, 24x24 viewBox, colored via `currentColor` so active/inactive
 * tinting is pure CSS.
 */

interface IconProps {
  className?: string;
}

function base(className?: string) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function TicketIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2.5 2.5 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-6Z" />
      <path d="M14 5v2.5M14 11v2M14 16.5V19" strokeDasharray="0.1 3.4" />
    </svg>
  );
}

/** Promoções — percentage inside a scalloped seal. */
export function PercentBadgeIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 2.6c1 .9 2.3.9 3.4.4.6 1.2 1.7 2 3 2 .2 1.3 1 2.4 2.2 3-.5 1.2-.5 2.5 0 3.7-1.2.6-2 1.7-2.2 3-1.3 0-2.4.8-3 2-1.1-.5-2.4-.5-3.4.4-.9-.9-2.3-1.3-3.4-.4-.6-1.2-1.7-2-3-2-.2-1.3-1-2.4-2.2-3 .5-1.2.5-2.5 0-3.7 1.2-.6 2-1.7 2.2-3 1.3 0 2.4-.8 3-2 1 -.9 2.4-.5 3.4.4Z" strokeWidth={1.4} />
      <path d="M9.5 14.5 14.5 9.5" />
      <circle cx="9.7" cy="9.7" r="0.9" />
      <circle cx="14.3" cy="14.3" r="0.9" />
    </svg>
  );
}

/** Listas — checklist. */
export function ListCheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M10 7h9M10 12h9M10 17h9" />
      <path d="M4 6.8 5 7.8 6.8 5.8M4 11.8l1 1 1.8-2M4 16.8l1 1 1.8-2" strokeWidth={1.5} />
    </svg>
  );
}

/** Refeições — a serving cloche. */
export function ClocheIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3.5 18h17" />
      <path d="M5 18a7 7 0 0 1 14 0" />
      <path d="M12 5v1.2" />
      <circle cx="12" cy="4.4" r="0.9" />
    </svg>
  );
}

export function CardIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" strokeWidth={1.5} />
      <path d="M6 15h4" strokeWidth={1.4} />
    </svg>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 7l1.9 1.1M17.9 15.9l1.9 1.1M19.8 7l-1.9 1.1M6.1 15.9 4.2 17M2.5 12h2.2M19.3 12h2.2" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function PersonIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="9" y="9" width="11" height="11" rx="2" strokeWidth={1.6} />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" strokeWidth={1.6} />
    </svg>
  );
}

export function FuelPumpIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M3.5 21h13" />
      <rect x="7.5" y="6" width="5" height="4" rx="0.8" />
      <path d="M15 9h1.8a1.2 1.2 0 0 1 1.2 1.2v6.3a1.5 1.5 0 0 0 3 0V9.9a2 2 0 0 0-.6-1.4L18.5 6" />
    </svg>
  );
}

export function TagIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
      <circle cx="8" cy="8" r="1.6" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="m7.5 12.2 3 3 6-6.4" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={2}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={2}>
      <path d="m5 9 7 7 7-7" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={2}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9l1-13" />
    </svg>
  );
}

export function StoreIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 9.5 5.2 5h13.6L20 9.5" />
      <path d="M4 9.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
      <path d="M5.5 11.5V20h13v-8.5" />
    </svg>
  );
}

export function PiggyIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3.5 12.5c0-3 2.7-5 6-5 1 0 1.9.2 2.7.5L15 6.5l.3 2.2c.9.8 1.5 1.8 1.7 3H19v3h-1.4c-.4.8-1 1.5-1.8 2V19h-2.3v-1.2a8 8 0 0 1-2.7 0V19H6.5v-1.5c-1.8-1-3-2.8-3-5Z" />
      <circle cx="7.5" cy="12" r="0.8" fill="currentColor" />
      <path d="M3.6 11.5C2.9 11.3 2.7 10.4 3 10" />
    </svg>
  );
}

/**
 * Placeholder brand mark: a leaf-drop shape in the signature green.
 * Original artwork — swap for the official logo asset before UAT if the
 * brand team provides one.
 */
export function BrandMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.2c3.6 3.9 7.2 7.4 7.2 11.6A7.2 7.2 0 0 1 12 21a7.2 7.2 0 0 1-7.2-7.2C4.8 9.6 8.4 6.1 12 2.2Z" />
      <path d="M9 14.4c1.8.6 4.2.3 5.7-1.2" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.3-2h5.8l1.3 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="12.8" r="3.3" />
    </svg>
  );
}

export function ImageIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m20 15.5-4.3-4.3a1 1 0 0 0-1.4 0L8 17.5" />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.5l-1.6-5.3L5 10.6 10.4 9 12 3.5Z" />
      <path d="M19 16.5v3M17.5 18h3" strokeWidth={1.5} />
    </svg>
  );
}
