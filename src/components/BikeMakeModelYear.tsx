import { useQuery } from "@tanstack/react-query";

type Value = { make: string; model: string; year: string };

const NHTSA = "https://vpic.nhtsa.dot.gov/api/vehicles";
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1979 + 1 }, (_, i) => CURRENT_YEAR + 1 - i);

async function fetchMakes(): Promise<string[]> {
  const res = await fetch(`${NHTSA}/GetMakesForVehicleType/motorcycle?format=json`);
  if (!res.ok) throw new Error("Failed to load makes");
  const json = await res.json();
  const names: string[] = (json.Results ?? []).map((r: any) => String(r.MakeName));
  return Array.from(new Set(names.map((n) => n.trim()))).sort((a, b) => a.localeCompare(b));
}

async function fetchModels(make: string, year: string): Promise<string[]> {
  if (!make) return [];
  const url = year
    ? `${NHTSA}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelYear/${year}/vehicleType/motorcycle?format=json`
    : `${NHTSA}/GetModelsForMake/${encodeURIComponent(make)}?format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load models");
  const json = await res.json();
  const names: string[] = (json.Results ?? []).map((r: any) => String(r.Model_Name));
  return Array.from(new Set(names.map((n) => n.trim()))).sort((a, b) => a.localeCompare(b));
}

export function BikeMakeModelYear({
  value,
  onChange,
  required,
}: {
  value: Value;
  onChange: (v: Value) => void;
  required?: boolean;
}) {
  const makes = useQuery({ queryKey: ["nhtsa-moto-makes"], queryFn: fetchMakes, staleTime: 24 * 60 * 60 * 1000 });
  const models = useQuery({
    queryKey: ["nhtsa-moto-models", value.make, value.year],
    queryFn: () => fetchModels(value.make, value.year),
    enabled: !!value.make,
    staleTime: 24 * 60 * 60 * 1000,
  });

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
        {(makes.data ?? []).map((m) => <option key={m} value={m} />)}
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
          list="bike-models"
          placeholder={models.isFetching ? "Loading models…" : `Model${star}`}
          value={value.model}
          onChange={(e) => onChange({ ...value, model: e.target.value })}
          className={sel}
          disabled={!value.make}
        />
        <datalist id="bike-models">
          {(models.data ?? []).map((m) => <option key={m} value={m} />)}
        </datalist>
      </div>
    </div>
  );
}