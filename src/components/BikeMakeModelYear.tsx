type Value = { make: string; model: string; year: string };

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1979 + 1 }, (_, i) => CURRENT_YEAR + 1 - i);

// Motorcycle brands stocked / serviced by major AU distributors
// (Whites Powersports, Darbi, Moto1). Curated list.
const MOTO_BRANDS: string[] = [
  "Aprilia", "Benelli", "Beta", "BMW", "Bultaco", "Cake", "CFMoto",
  "Ducati", "Energica", "Fantic", "GasGas", "Harley-Davidson", "Honda",
  "Husaberg", "Husqvarna", "Hyosung", "Indian", "Jawa", "Kawasaki",
  "KTM", "Kymco", "Lambretta", "Lexmoto", "Mash", "Moto Guzzi",
  "Moto Morini", "MV Agusta", "Norton", "Peugeot", "Piaggio", "Polaris",
  "Royal Enfield", "Segway", "Sherco", "Stark", "Surron", "Suzuki",
  "SWM", "SYM", "Triumph", "TM Racing", "Ural", "Vespa", "Victory",
  "Vmoto", "Yamaha", "Zero",
].sort((a, b) => a.localeCompare(b));

export function BikeMakeModelYear({
  value,
  onChange,
  required,
}: {
  value: Value;
  onChange: (v: Value) => void;
  required?: boolean;
}) {
  const star = required ? " *" : "";
  const sel = "w-full rounded-md bg-input border border-border px-3 py-2 text-sm";

  return (
    <div className="grid grid-cols-2 gap-2">
      <input
        list="bike-makes"
        placeholder={`Make${star}`}
        value={value.make}
        onChange={(e) => onChange({ ...value, make: e.target.value, model: "" })}
        className={sel}
      />
      <datalist id="bike-makes">
        {MOTO_BRANDS.map((m) => <option key={m} value={m} />)}
      </datalist>

      <select
        value={value.year}
        onChange={(e) => onChange({ ...value, year: e.target.value, model: "" })}
        className={sel}
      >
        <option value="">Year</option>
        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>

      <div className="col-span-2">
        <input
          placeholder={`Model${star}`}
          value={value.model}
          onChange={(e) => onChange({ ...value, model: e.target.value })}
          className={sel}
          disabled={!value.make}
        />
      </div>
    </div>
  );
}