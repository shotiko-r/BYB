export function Logo() {
  return (
    <span className="byb-logo">
      <svg className="byb-logo-mark" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M4.5 6.5 14 16l9.5-9.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 16v4.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="14" cy="24.4" r="2.2" fill="var(--byb-amber)" />
      </svg>
      <span className="byb-logo-wordmark">BYB</span>
    </span>
  );
}
