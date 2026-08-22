import styles from "./NumberUnit.module.sass";

type Props = {
  value: React.ReactNode;
  unit?: string;
  // Scales the whole thing relative to `baseSize` - same --size-variable
  // convention as Clock/WeatherSummary.
  size?: number;
  // The number's font-size at size=1 - callers pick their own scale
  // (StatCard's headline vs WeatherSummary/Clock's much bigger digits)
  // instead of this component assuming one.
  baseSize?: string;
  // Unit's font-size as a fraction of the number's, so it stays
  // proportional as `size` changes instead of being pinned to some
  // unrelated fixed size.
  unitRatio?: number;
  muted?: boolean;
  className?: string;
};

// Shared "big number + smaller unit" primitive - StatCard's %/mm/degree
// values and WeatherSummary's degree symbol were each their own bespoke
// markup, which is how they drifted out of sync. Both now render in normal
// flow so a unit can never overflow its container the way an
// absolutely-positioned one used to (see TemperatureSingleton's prior
// implementation) - alignment still differs on purpose, though: a degree
// sign reads correctly as a raised superscript (align-items:flex-start),
// while a word/abbreviation unit ("%", "mm", "Moderate") reads correctly
// sitting on the number's own baseline like normal text next to it.
export default function NumberUnit({
  value,
  unit,
  size = 1,
  baseSize = "1.8rem",
  unitRatio = 0.4,
  muted = false,
  className,
}: Props) {
  const raised = unit === "°";

  return (
    <div
      className={[styles.wrapper, raised ? styles.raised : "", className].filter(Boolean).join(" ")}
      style={{ "--base-size": baseSize, "--size": size, "--unit-ratio": unitRatio } as React.CSSProperties}
    >
      <span className={styles.number}>{value}</span>
      {unit && <span className={[styles.unit, muted ? styles.muted : ""].filter(Boolean).join(" ")}>{unit}</span>}
    </div>
  );
}
