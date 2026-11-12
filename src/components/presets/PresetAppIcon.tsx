type Props = { presetId: string; className?: string };

export function PresetAppIcon({ presetId, className = "" }: Props) {
  const cn = `preset-app-icon ${className}`.trim();
  switch (presetId) {
    case "tiktok":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M14 4h2.2c.2 1.9 1.6 3.4 3.5 3.6v2.4c-1.2 0-2.4-.4-3.4-1.1v6.7c0 3.1-2.5 5.1-5.6 5.1-3 0-5.4-2.4-5.4-5.4s2.4-5.4 5.4-5.4c.3 0 .6 0 .9.1v2.6c-.3-.1-.5-.1-.8-.1-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7c1.6 0 2.8-1.1 2.8-2.7V4Z"
          />
        </svg>
      );
    case "reels":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="17" cy="7" r="1.25" fill="currentColor" />
        </svg>
      );
    case "shorts":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M17.3 7.2 14.1 5.4a3.1 3.1 0 0 0-4.2 1.1 3.1 3.1 0 0 0 1.1 4.2l1.2.7-1.2.7a3.1 3.1 0 0 0-1.1 4.2 3.1 3.1 0 0 0 4.2 1.1l3.2-1.8a3.9 3.9 0 0 0 0-6.8ZM12.3 8a.8.8 0 0 1 1.1-.3l3.2 1.8a1.5 1.5 0 0 1 0 2.6l-3.2 1.8a.8.8 0 1 1-.8-1.4l2.4-1.4-2.4-1.4a.8.8 0 0 1-.3-1.1Zm-1.6 6.2a.8.8 0 0 1 1.1-.3l2.4 1.4-2.4 1.4a.8.8 0 1 1-.8-1.4l1.2-.7-1.2-.7a.8.8 0 0 1-.3-1.1Z"
          />
        </svg>
      );
    case "youtube":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C17.7 5 12 5 12 5s-5.7 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 9.3 2 12 2 12s0 2.7.4 4.8c.2.9.9 1.6 1.8 1.8 2.1.4 7.8.4 7.8.4s5.7 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-2.1.4-4.8.4-4.8s0-2.7-.4-4.8ZM10 15.5V8.5l6.5 3.5L10 15.5Z"
          />
        </svg>
      );
    case "x":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.963 6.817H1.684l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"
          />
        </svg>
      );
    case "source":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 4v10m0 0 4-4m-4 4-4-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 18h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "edition":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 7h14M5 12h9M5 17h12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="18" cy="12" r="2" fill="currentColor" />
        </svg>
      );
    case "quality-max":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12 2 9.5 9H2l6.5 4.5L6 22l6-4.5L18 22l-2.5-8.5L22 9h-7.5L12 2Z"
          />
        </svg>
      );
    default:
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
  }
}
