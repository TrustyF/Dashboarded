export type NavLink = {
  href: string;
  icon: string;
  iconInactive: string;
  label: string;
};

// Left-to-right page order - drives both Nav.tsx's swipe-to-switch-pages
// gesture and PageTransition.tsx's slide direction, so a nav-pill tap and a
// swipe to the same destination always animate the same way.
export const LINKS: NavLink[] = [
  { href: "/", icon: "bi-house-fill", iconInactive: "bi-house", label: "Home" },
  { href: "/weather", icon: "bi-cloud-fill", iconInactive: "bi-cloud", label: "Weather" },
  { href: "/spotify", icon: "bi-music-note", iconInactive: "bi-music-note", label: "Spotify" },
  { href: "/health", icon: "bi-lungs-fill", iconInactive: "bi-lungs", label: "Health" },
  { href: "/sensors", icon: "bi-thermometer-high", iconInactive: "bi-thermometer-low", label: "Sensors" },
  { href: "/system", icon: "bi-hdd-network-fill", iconInactive: "bi-hdd-network", label: "System" },
  { href: "/settings", icon: "bi-gear-fill", iconInactive: "bi-gear", label: "Settings" },
];
