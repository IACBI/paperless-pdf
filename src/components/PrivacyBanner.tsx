/**
 * The privacy notice. This is intentionally always visible (not dismissible)
 * because the "your files never leave this device" guarantee is the core
 * promise of the app. See CLAUDE.md → "Privacy invariant".
 */
export default function PrivacyBanner() {
  return (
    <div
      role="note"
      className="flex items-center justify-center gap-2 bg-brand-900 px-4 py-2 text-center text-sm font-medium text-brand-50"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
      >
        <path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
      <span>
        Your files never leave this device — all processing happens locally in your browser.
      </span>
    </div>
  );
}
