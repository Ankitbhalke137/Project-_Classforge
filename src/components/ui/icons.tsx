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