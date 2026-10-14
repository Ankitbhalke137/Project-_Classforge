import type { ReactNode, SVGProps } from "react";

/**
 * Inline SVG icons so the app ships no icon dependency. Every icon is the same
 * size and inherits `currentColor`, which keeps the Tailwind classes in the
 * components as the single source of styling.
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

export const StudentsIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" />
    <path d="M17 11a3 3 0 1 0 0-6" />
    <path d="M21.5 20v-1a4.5 4.5 0 0 0-3-4.2" />
  </Icon>
);

export const TeachersIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="3" y="3" width="18" height="12" rx="2" />
    <path d="M12 15v3M9 21h6" />
    <path d="m7.5 11 2-3 2 2 2-3 2 4" />
  </Icon>
);

export const ClassesIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Icon>
);

export const AttendanceIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="m8 12 3 3 5-6" />
  </Icon>
);

export const ExamsIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
    <path d="M9 17v-3M12 17v-5M15 17v-2" />
  </Icon>
);

export const AnnouncementsIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" />
    <path d="M14 7a4 4 0 0 1 0 10" />
  </Icon>
);

export const AssignmentsIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1" />
    <path d="M9 11l1.8 1.8L14 9.5" />
    <path d="M9 17h6" />
  </Icon>
);

export const SchoolsIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3 21h18" />
    <path d="M5 21V8l7-5 7 5v13" />
    <path d="M10 21v-6h4v6" />
  </Icon>
);

export const MenuIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);

export const CloseIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="m4 12 5 5L20 6" />
  </Icon>
);

export const ChevronDownIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const LogoutIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </Icon>
);

export const LockIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const AlertIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 16h.01" />
  </Icon>
);

export const EmptyIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3 12h5l2 3h4l2-3h5" />
    <path d="M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z" />
  </Icon>
);

/* ---------- Brand + sign-in ---------- */

/** The open book in the logo tile. Drawn on its own so the tile can clip it. */
export const BookIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 7.5V20" />
    <path d="M3.5 18.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4.5A4 4 0 0 1 12 8a4 4 0 0 1 4-4h4.5a1 1 0 0 1 1 1v12.5a1 1 0 0 1-1 1H16a4 4 0 0 0-4 3.5 4 4 0 0 0-4-3.5Z" />
  </Icon>
);

export const EyeIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M9.9 5.7A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.9" />
    <path d="M6.3 7.8A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.7 9.7 0 0 0 4-.85" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3.5 3.5 17 17" />
  </Icon>
);

export const ShieldCheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 21s7-3.2 7-8.6V5.9L12 3 5 5.9v6.5C5 17.8 12 21 12 21Z" />
    <path d="m9 11.8 2.1 2.1L15 10" />
  </Icon>
);

/* ---------- Workspace chrome ---------- */

export const BellIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5" />
    <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
  </Icon>
);

export const TimetableIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M8 4.5v16M8 15h13" />
  </Icon>
);

export const ClipboardIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M9 4.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="2.5" width="6" height="4" rx="1" />
    <path d="m9 13 1.8 1.8L14.5 11" />
  </Icon>
);

export const CalendarIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);

export const TrendIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3 17.5 9 11l4 4 8-8.5" />
    <path d="M15 6.5h6v6" />
  </Icon>
);

export const MegaphoneIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 10v4a1 1 0 0 0 1 1h3l7 4.5V5.5L8 10H5a1 1 0 0 0-1 1Z" />
    <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
  </Icon>
);

export const ArrowRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 12h15" />
    <path d="m13 6 6 6-6 6" />
  </Icon>
);

export const GraduationIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="m12 4 10 4.5L12 13 2 8.5 12 4Z" />
    <path d="M6.5 10.7V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-5.3" />
    <path d="M21.5 9v5" />
  </Icon>
);