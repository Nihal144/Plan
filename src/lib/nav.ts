/**
 * The three destinations, defined once so the desktop rail and the mobile bottom
 * bar can never drift apart.
 *
 * `icon` holds only the inner SVG path data; each nav component supplies its own
 * <svg> wrapper so it controls sizing and stroke weight.
 */
export type NavItem = {
  href: "/home" | "/plan" | "/partner";
  label: string;
  icon: string[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/home",
    label: "Home",
    icon: ["M3 10.5L12 3l9 7.5", "M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5"],
  },
  {
    href: "/plan",
    label: "Plan",
    icon: ["M3 4h18v17H3z", "M3 9h18M8 2v4M16 2v4", "M8 14l2.5 2.5L16 12"],
  },
  {
    href: "/partner",
    label: "Partner",
    icon: [
      "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11Z",
      "M2.5 20a6.5 6.5 0 0 1 13 0",
      "M16.5 7.2a3 3 0 0 1 0 5.6",
      "M18.5 20a6.4 6.4 0 0 0-1.8-4.4",
    ],
  },
];

/** Matches nested routes too, so /plan/tasks still lights up the Plan tab. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
