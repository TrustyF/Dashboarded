// Port of temperature_singleton.vue.

export default function TemperatureSingleton({
  temperature,
  size = 1,
}: {
  temperature: number;
  size?: number;
}) {
  return (
    <div className="temp_single_wrapper" style={{ "--size": size } as React.CSSProperties}>
      <h1>{temperature}</h1>
      <h1 className="decorator">°</h1>
    </div>
  );
}
