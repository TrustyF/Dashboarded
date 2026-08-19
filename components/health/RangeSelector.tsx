import styles from "./RangeSelector.module.sass";

const RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 29 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

type Props = {
  value: number;
  onChange: (days: number) => void;
};

export default function RangeSelector({ value, onChange }: Props) {
  return (
    <div className={styles.wrapper}>
      {RANGES.map((r) => (
        <button
          key={r.days}
          className={`${styles.chip} ${value === r.days ? styles.active : ""}`}
          onClick={() => onChange(r.days)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
