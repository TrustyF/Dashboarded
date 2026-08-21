import styles from "./DiffPill.module.sass";

type Props = {
  value: number | null;
  unit: string;
  // Whether a decrease counts as improvement (weight/fat/BMI) vs an increase
  // (weight loss framing) - "neutral" skips the green/red judgment entirely
  // for metrics where up/down isn't good or bad (e.g. weather trends).
  goodDirection?: "down" | "up" | "neutral";
};

// Compact inline badge replacement for DiffNumber's big stacked layout -
// fits inline next to a stat card's headline value, Google Fit/Health style.
export default function DiffPill({ value, unit, goodDirection = "down" }: Props) {
  if (value == null) return <span className={styles.pill} style={{visibility:"hidden"}}>—</span>;
  if (value === 0) return <span className={styles.pill} style={{visibility:"hidden"}}>No change</span>;

  const direction = value > 0 ? "up" : "down";
  const judgment = goodDirection === "neutral" ? null : direction === goodDirection ? styles.good : styles.bad;

  return (
    <span className={`${styles.pill} bi ${direction === "up" ? "bi-caret-up-fill" : "bi-caret-down-fill"} ${judgment ?? ""}`}>
      {Math.abs(value)}
      {unit}
    </span>
  );
}
