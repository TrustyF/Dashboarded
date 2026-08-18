import styles from "./StatChip.module.sass";

// Small reusable "icon + value + label" tile - used to pack several live
// readouts (sensor, device vitals, etc.) into a compact strip.

export default function StatChip({
  icon,
  value,
  unit,
  label,
}: {
  icon: string;
  value: string | number;
  unit?: string;
  label: string;
}) {
  return (
    <div className={styles.chip}>
      <i className={`bi ${icon} ${styles.icon}`} />
      <div className={styles.valueWrap}>
        <span className={styles.value}>{value}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
