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
  const arrowClass =
    showArrow && number != null ? (number > 0 ? "bi-caret-up-fill red" : number < 0 ? "bi-caret-down-fill green" : "") : "";

  return (
    <div className="diff_number_wrapper">
      <div className="number_wrapper">
        <h1 className={`number bi ${arrowClass}`}>{number != null ? Math.abs(number) : "—"}</h1>
        <h3 className="decorator">Kg</h3>
      </div>
      {title && <h1 className="diff_title">{title}</h1>}
    </div>
  );
}
