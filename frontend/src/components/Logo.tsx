/** Two meeting chevrons form a diamond with an open center. */
export function Logo() {
  return (
    <span className="byb-logo">
      <svg width="42" height="34" viewBox="0 0 42 34" fill="none" aria-hidden="true">
        <path d="M21 1 5 17l16 16v-9l-7-7 7-7V1Z" fill="#0F5F4F" />
        <path d="m21 1 16 16-16 16v-9l7-7-7-7V1Z" fill="#FF9F1C" />
      </svg>
      <span>BYB</span>
    </span>
  );
}
