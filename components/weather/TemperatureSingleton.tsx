import NumberUnit from "@/components/common/NumberUnit";

// Port of temperature_singleton.vue.

export default function TemperatureSingleton({
  temperature,
  size = 1,
}: {
  temperature: number;
  size?: number;
}) {
  return <NumberUnit value={temperature} unit="°" size={size} baseSize="5em" />;
}
