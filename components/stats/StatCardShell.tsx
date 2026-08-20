import styles from "./StatCardShell.module.sass";

type Props = {
  label: string;
  icon?: string;
  iconAlt?: string;
  // Text shown next to the icon (e.g. a weather condition name) - distinct
  // from `label`, which stays the fixed metric name in the top-left corner.
  iconLabel?: string;
  // Emoji alternative to `icon` for tiles that don't have an image asset
  // (e.g. a UV-level glyph) - takes the same slot, image wins if both are set.
  emoji?: string;
  children: React.ReactNode;
};

// Bare stat-tile shell: card box + label/icon header row. Content below the
// header is a free slot - compose premade pieces (DiffPill, Sparkline,
// StepRings, ...) into it instead of extending a card's prop surface for
// every new tile shape. StatCard is the "number + diff + trend" preset built
// on top of this; new tile shapes can use the shell directly.
export default function StatCardShell({ label, icon, iconAlt, iconLabel, emoji, children }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.topRow}>
        <div className={styles.label}>{label}</div>
        {(icon || emoji) && (
          <div className={styles.iconGroup}>
            {iconLabel && <span className={styles.iconLabel}>{iconLabel}</span>}
            {icon ? (
              icon.endsWith(".svg") ? (
                <span
                  className={styles.iconMask}
                  style={{ WebkitMaskImage: `url(${icon})`, maskImage: `url(${icon})` }}
                  role="img"
                  aria-label={iconAlt ?? ""}
                />
              ) : (
                <img className={styles.icon} src={icon} alt={iconAlt ?? ""} />
              )
            ) : (
              <span className={styles.emoji} role="img" aria-label={iconAlt ?? ""}>
                {emoji}
              </span>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
