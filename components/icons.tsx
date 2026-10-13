import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function base(props: P): P {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

export function ApertureIcon(props: P) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v5M19.8 7.5l-4.3 2.5M19.8 16.5L15.5 14M12 21v-5M4.2 16.5L8.5 14M4.2 7.5L8.5 10" />
    </svg>
  );
}

export function XIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

export function PaperclipIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M20 12.5l-8.2 8.2a5.2 5.2 0 0 1-7.4-7.4L13 4.8a3.5 3.5 0 0 1 4.9 4.9l-8.3 8.3a1.75 1.75 0 0 1-2.5-2.5l7.6-7.6" />
    </svg>
  );
}

export function SendIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function StopIcon(props: P) {
  return (
    <svg {...base(props)}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ExpandIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  );
}

export function DownloadIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v11M7 11l5 5 5-5M4 20h16" />
    </svg>
  );
}

export function PlusIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CheckIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function AlertIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M12 4L2.5 20h19L12 4zM12 10v4M12 17.2v.3" />
    </svg>
  );
}

export function CameraIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M3 8h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3zM15 10.5l6-3v9l-6-3" />
    </svg>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/25 border-t-white/90 ${className}`}
      aria-hidden
    />
  );
}
