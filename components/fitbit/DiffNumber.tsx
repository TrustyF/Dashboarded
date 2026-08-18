import styles from "./DiffNumber.module.sass";

// Port of DiffNumber.vue - a signed diff readout with a caret indicating
// direction (red up = weight gain, green down = weight loss).

export default function DiffNumber({
  number,
  title,
  showArrow = true,
}: {
  number: number | null;
  title: string;
  showArrow?: boolean;
}) {
  const arrow = showArrow && number != null && number !== 0 ? (number > 0 ? "up" : "down") : null;
  const arrowClasses = [
    arrow === "up" && `bi-caret-up-fill ${styles.red}`,
    arrow === "down" && `bi-caret-down-fill ${styles.green}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.wrapper}>
      <div className={styles.numberWrapper}>
        <h1 className={`${styles.number} bi ${arrowClasses}`}>{number != null ? Math.abs(number) : "—"}</h1>
        <h3 className={styles.decorator}>Kg</h3>
      </div>
      {title && <h1 className={styles.title}>{title}</h1>}
    </div>
  );
}
