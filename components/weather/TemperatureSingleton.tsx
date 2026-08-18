import styles from "./TemperatureSingleton.module.sass";

// Port of temperature_singleton.vue.

export default function TemperatureSingleton({
  temperature,
  size = 1,
}: {
  temperature: number;
  size?: number;
}) {
  return (
    <div className={styles.wrapper} style={{ "--size": size } as React.CSSProperties}>
      <h1>{temperature}</h1>
      <h1 className={styles.decorator}>°</h1>
    </div>
  );
}
