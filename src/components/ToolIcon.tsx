interface ToolIconProps {
  /** SVG path `d` from the tool registry. */
  path: string;
  className?: string;
}

/** Renders a tool's stroke icon from a single SVG path. */
export default function ToolIcon({ path, className = 'h-6 w-6' }: ToolIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
