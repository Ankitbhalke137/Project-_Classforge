/**
 * The animated campus that closes the dashboard greeting.
 *
 * Drawn inline rather than shipped as an asset so it scales, themes with the
 * brand tokens and adds nothing to the bundle but markup. The motion classes
 * live in globals.css and are disabled under `prefers-reduced-motion`.
 */
export function CampusScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 460 140"
      className={className}
      fill="none"
      role="img"
      aria-label="The school campus on a bright morning"
    >
      <defs>
        <linearGradient id="cf-sky" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#ecfdf5" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#d1fae5" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="cf-hill-back" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="cf-hill-front" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      <rect fill="url(#cf-sky)" height="140" rx="16" width="460" />

      <g className="cf-sun">
        <circle cx="390" cy="32" fill="#fef08a" opacity="0.8" r="16" />
        <circle cx="390" cy="32" opacity="0.6" r="22" stroke="#fef08a" strokeDasharray="3 3" strokeWidth="1.5" />
      </g>

      <g className="cf-cloud" opacity="0.75">
        <path d="M70 38 a10 10 0 0 1 18 -4 a14 14 0 0 1 24 2 a8 8 0 0 1 12 7 l-54 0 z" fill="#ffffff" />
        <path d="M310 26 a8 8 0 0 1 14 -3 a11 11 0 0 1 18 2 a7 7 0 0 1 9 5 l-41 0 z" fill="#ffffff" opacity="0.85" />
      </g>

      <path d="M-20 140 Q 90 95 210 118 T 480 105 L 480 140 Z" fill="url(#cf-hill-back)" />
      <path d="M-10 140 Q 130 115 260 112 T 480 120 L 480 140 Z" fill="url(#cf-hill-front)" />

      <g className="cf-tree">
        <circle cx="140" cy="102" fill="#10b981" opacity="0.65" r="18" />
        <circle cx="160" cy="108" fill="#059669" opacity="0.55" r="14" />
        <rect fill="#0f382c" height="16" opacity="0.6" rx="1.5" width="4" x="138" y="112" />
        <rect fill="#0f382c" height="12" opacity="0.5" rx="1" width="3" x="159" y="116" />
        <circle cx="320" cy="104" fill="#10b981" opacity="0.65" r="16" />
        <circle cx="302" cy="109" fill="#047857" opacity="0.55" r="13" />
        <rect fill="#0f382c" height="14" opacity="0.6" rx="1.5" width="4" x="318" y="114" />
        <rect fill="#0f382c" height="12" opacity="0.5" rx="1" width="3" x="301" y="117" />
      </g>

      {/* Centre block, side wings, pediment, cupola and portico. */}
      <g transform="translate(170, 42)">
        <rect fill="#ffffff" height="46" rx="1" stroke="#0f382c" strokeWidth="1.2" width="70" x="25" y="42" />
        <rect fill="#f8fafc" height="36" rx="1" stroke="#0f382c" strokeWidth="1.2" width="35" x="-10" y="52" />
        <rect fill="#f8fafc" height="36" rx="1" stroke="#0f382c" strokeWidth="1.2" width="35" x="95" y="52" />

        <path d="M-12 52 L7.5 44 L27 52 Z" fill="#10b981" stroke="#0f382c" strokeWidth="1" />
        <path d="M93 52 L112.5 44 L132 52 Z" fill="#10b981" stroke="#0f382c" strokeWidth="1" />
        <path d="M22 42 L60 22 L98 42 Z" fill="#059669" stroke="#0f382c" strokeWidth="1.2" />

        <circle cx="60" cy="33" fill="#ffffff" r="5" stroke="#0f382c" strokeWidth="0.8" />
        <line stroke="#0f382c" strokeWidth="0.7" x1="60" x2="60" y1="30" y2="33" />
        <line stroke="#0f382c" strokeWidth="0.7" x1="60" x2="63" y1="33" y2="33" />

        <rect fill="#ffffff" height="16" rx="0.5" stroke="#0f382c" strokeWidth="1" width="16" x="52" y="6" />
        <path d="M50 6 L60 -3 L70 6 Z" fill="#0f382c" />
        <rect fill="#10b981" height="10" opacity="0.4" rx="4" width="8" x="56" y="9" />

        <line stroke="#0f382c" strokeWidth="1.2" x1="60" x2="60" y1="-3" y2="-18" />
        <path className="cf-flag" d="M60 -18 Q67 -20 74 -18 Q67 -14 60 -12 Z" fill="#10b981" />

        <rect fill="#f1f5f9" height="44" stroke="#0f382c" strokeWidth="0.8" width="4" x="33" y="44" />
        <rect fill="#f1f5f9" height="44" stroke="#0f382c" strokeWidth="0.8" width="4" x="47" y="44" />
        <rect fill="#f1f5f9" height="44" stroke="#0f382c" strokeWidth="0.8" width="4" x="69" y="44" />
        <rect fill="#f1f5f9" height="44" stroke="#0f382c" strokeWidth="0.8" width="4" x="83" y="44" />
        <path d="M54 88 L54 66 A6 6 0 0 1 66 66 L66 88 Z" fill="#0f382c" />

        <rect fill="#ecfdf5" height="11" rx="1" stroke="#0f382c" strokeWidth="0.7" width="8" x="-4" y="58" />
        <rect fill="#ecfdf5" height="11" rx="1" stroke="#0f382c" strokeWidth="0.7" width="8" x="11" y="58" />
        <rect fill="#ecfdf5" height="11" rx="1" stroke="#0f382c" strokeWidth="0.7" width="8" x="-4" y="73" />
        <rect fill="#ecfdf5" height="11" rx="1" stroke="#0f382c" strokeWidth="0.7" width="8" x="11" y="73" />
        <rect fill="#ecfdf5" height="11" rx="1" stroke="#0f382c" strokeWidth="0.7" width="8" x="101" y="58" />
        <rect fill="#ecfdf5" height="11" rx="1" stroke="#0f382c" strokeWidth="0.7" width="8" x="116" y="58" />
        <rect fill="#ecfdf5" height="11" rx="1" stroke="#0f382c" strokeWidth="0.7" width="8" x="101" y="73" />
        <rect fill="#ecfdf5" height="11" rx="1" stroke="#0f382c" strokeWidth="0.7" width="8" x="116" y="73" />

        <rect fill="#e2e8f0" height="5" rx="1" stroke="#0f382c" strokeWidth="1" width="156" x="-18" y="88" />
      </g>

      <path d="M210 135 L224 140 L236 140 L250 135 Z" fill="#cbd5e1" opacity="0.6" />
      <circle cx="188" cy="133" fill="#10b981" r="6" />
      <circle cx="197" cy="135" fill="#059669" r="5" />
      <circle cx="262" cy="134" fill="#10b981" r="6" />
      <circle cx="271" cy="135" fill="#047857" r="5" />
    </svg>
  );
}