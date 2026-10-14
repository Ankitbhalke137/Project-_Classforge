/**
 * The line-art school that sits under the headline on the sign-in screen. It is
 * drawn inline rather than shipped as an asset so it scales, themes with the
 * brand tokens, and adds nothing to the bundle but markup.
 */
export function SchoolIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 500 268"
      className={className}
      fill="none"
      role="img"
      aria-label="A school building with lesson cards floating around it"
    >
      {/* Soft backdrop */}
      <circle cx="270" cy="122" r="168" fill="#e2ece0" />

      {/* Ground */}
      <path d="M28 244c60-16 116-24 174-24s112 8 168 24" stroke="#a9bcaf" strokeWidth="1.5" strokeLinecap="round" />

      {/* Tree */}
      <path d="M118 232v-40" stroke="#4e755f" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M94 176a24 24 0 0 1 48 0c0 12-24 22-24 22s-24-10-24-22Z" fill="#dfead9" stroke="#4e755f" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M118 198v-22" stroke="#4e755f" strokeWidth="1.25" strokeLinecap="round" />

      {/* Main block */}
      <rect x="153" y="88" width="244" height="144" rx="3" fill="#eef4ec" stroke="#4e755f" strokeWidth="1.5" />

      {/* Tower */}
      <rect x="235" y="40" width="80" height="192" rx="3" fill="#eef4ec" stroke="#4e755f" strokeWidth="1.5" />
      <path d="M228 42 275 20l47 22" stroke="#4e755f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Clock */}
      <circle cx="275" cy="78" r="12" fill="#ffffff" stroke="#4e755f" strokeWidth="1.5" />
      <path d="M275 71v7.5l4.5 3" stroke="#37634b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Windows */}
      <g fill="#dbe7d9" stroke="#4e755f" strokeWidth="1.25">
        <rect x="170" y="104" width="16" height="22" rx="2" />
        <rect x="206" y="104" width="16" height="22" rx="2" />
        <rect x="328" y="104" width="16" height="22" rx="2" />
        <rect x="364" y="104" width="16" height="22" rx="2" />
        <rect x="170" y="146" width="16" height="22" rx="2" />
        <rect x="206" y="146" width="16" height="22" rx="2" />
        <rect x="328" y="146" width="16" height="22" rx="2" />
        <rect x="364" y="146" width="16" height="22" rx="2" />
      </g>

      {/* Door */}
      <path d="M258 232v-32a17 17 0 0 1 34 0v32" fill="#e2ece0" stroke="#4e755f" strokeWidth="1.5" />
      <path d="M275 208v24" stroke="#4e755f" strokeWidth="1.25" strokeLinecap="round" />

      {/* Floating lesson card */}
      <g>
        <rect x="30" y="64" width="124" height="66" rx="12" fill="#ffffff" stroke="#e6eae7" strokeWidth="1" />
        <g transform="translate(48 80)" stroke="#37634b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="m11 3 10 4.5L11 12 1 7.5 11 3Z" />
          <path d="M5.5 9.7v5.1c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8V9.7" />
          <path d="M20.5 8v5" />
        </g>
        <rect x="82" y="86" width="52" height="6" rx="3" fill="#cfddd1" />
        <rect x="82" y="98" width="34" height="6" rx="3" fill="#e2ece0" />
      </g>

      {/* Floating people card */}
      <g>
        <rect x="364" y="158" width="124" height="52" rx="12" fill="#ffffff" stroke="#e6eae7" strokeWidth="1" />
        <g transform="translate(382 172)" stroke="#37634b" strokeWidth="1.5" strokeLinecap="round" fill="none">
          <circle cx="7" cy="6" r="3.5" />
          <path d="M1 17v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
          <path d="M15.5 8.5a3 3 0 1 0 0-6" />
          <path d="M20 17v-1a4.5 4.5 0 0 0-3-4.2" />
        </g>
        <rect x="418" y="174" width="52" height="6" rx="3" fill="#cfddd1" />
        <rect x="418" y="186" width="34" height="6" rx="3" fill="#e2ece0" />
      </g>

      {/* Sparkles */}
      <circle cx="446" cy="70" r="6" fill="#cfddd1" />
      <circle cx="60" cy="200" r="5" fill="#cfddd1" />
    </svg>
  );
}