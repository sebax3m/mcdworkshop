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

// Popular models per brand (AU market focus).
const MOTO_MODELS: Record<string, string[]> = {
  Aprilia: ["RS 660", "RSV4", "Tuono 660", "Tuono V4", "Tuareg 660", "SR GT", "RS 125", "Shiver 900", "Dorsoduro 900"],
  Benelli: ["TNT 135", "TRK 502", "TRK 502X", "TRK 702", "Leoncino 500", "Leoncino 800", "752S", "Imperiale 400", "TNT 600"],
  Beta: ["RR 125", "RR 200", "RR 250", "RR 300", "RR 350", "RR 390", "RR 430", "RR 480", "Xtrainer 300", "Evo 300"],
  BMW: ["R 1300 GS", "R 1250 GS", "R 1250 RT", "R nineT", "S 1000 RR", "S 1000 R", "S 1000 XR", "F 900 R", "F 900 XR", "F 850 GS", "F 800 GS", "G 310 R", "G 310 GS", "M 1000 RR", "CE 04"],
  CFMoto: ["300NK", "300SR", "450MT", "450NK", "450SR", "650NK", "650MT", "700CL-X", "800MT", "800NK", "Papio"],
  Ducati: ["Panigale V2", "Panigale V4", "Streetfighter V2", "Streetfighter V4", "Monster", "Monster SP", "Multistrada V2", "Multistrada V4", "DesertX", "Scrambler", "Diavel V4", "Hypermotard 698"],
  Fantic: ["Caballero 500", "Caballero 700", "XEF 250", "XEF 450", "XXF 250", "XXF 450"],
  GasGas: ["MC 50", "MC 65", "MC 85", "MC 125", "MC 250F", "MC 450F", "EC 250", "EC 300", "EC 250F", "EC 350F", "EX 300", "EX 450F", "ES 700", "SM 700"],
  "Harley-Davidson": ["Sportster S", "Nightster", "Street Bob", "Fat Bob", "Low Rider S", "Low Rider ST", "Heritage Classic", "Street Glide", "Road Glide", "Road King", "Pan America 1250", "Fat Boy", "Iron 883"],
  Honda: ["CBR1000RR-R", "CBR650R", "CBR500R", "CB1000R", "CB650R", "CB500F", "CB300R", "CB125F", "Africa Twin", "Transalp 750", "NC750X", "CRF300L", "CRF300 Rally", "CRF450R", "CRF250R", "Grom", "Monkey", "Super Cub", "Rebel 500", "Rebel 1100", "Goldwing", "Forza 350", "ADV350", "PCX160"],
  Husqvarna: ["TC 50", "TC 65", "TC 85", "TC 125", "TC 250", "FC 250", "FC 350", "FC 450", "TE 150i", "TE 250i", "TE 300i", "FE 250", "FE 350", "FE 450", "FE 501", "FX 350", "FX 450", "Svartpilen 401", "Svartpilen 701", "Vitpilen 401", "Norden 901"],
  Hyosung: ["GV125", "GV250", "GV300", "GV650", "GV700", "GT250R", "GT650R"],
  Indian: ["Scout", "Scout Bobber", "Sport Chief", "Chief", "Chief Dark Horse", "Super Chief", "Springfield", "Chieftain", "Roadmaster", "Challenger", "Pursuit", "FTR 1200"],
  Kawasaki: ["Ninja 400", "Ninja 500", "Ninja 650", "Ninja 1000SX", "Ninja ZX-4RR", "Ninja ZX-6R", "Ninja ZX-10R", "Ninja H2", "Z400", "Z500", "Z650", "Z650RS", "Z900", "Z900RS", "Z H2", "Versys 650", "Versys 1000", "Versys-X 300", "KLR650", "KLX230", "KLX300", "KX250", "KX450", "Vulcan S", "Eliminator", "W800"],
  KTM: ["50 SX", "65 SX", "85 SX", "125 SX", "250 SX", "250 SX-F", "350 SX-F", "450 SX-F", "150 EXC", "250 EXC", "300 EXC", "250 EXC-F", "350 EXC-F", "500 EXC-F", "125 Duke", "200 Duke", "390 Duke", "790 Duke", "890 Duke", "990 Duke", "1290 Super Duke R", "RC 390", "RC 8C", "390 Adventure", "790 Adventure", "890 Adventure", "990 Adventure", "1290 Super Adventure", "450 Rally", "690 SMC R", "690 Enduro R", "Freeride E-XC"],
  "Moto Guzzi": ["V7", "V9", "V85 TT", "V100 Mandello", "Stelvio", "Audace", "California"],
  "Moto Morini": ["X-Cape 650", "Seiemmezzo SCR", "Seiemmezzo STR", "Calibro 700"],
  "MV Agusta": ["F3 800", "Brutale 800", "Brutale 1000", "Dragster", "Turismo Veloce", "Superveloce", "Enduro Veloce"],
  Norton: ["Commando 961", "V4SV"],
  Piaggio: ["Liberty 150", "Medley 150", "MP3 530", "Beverly 400"],
  "Royal Enfield": ["Classic 350", "Hunter 350", "Meteor 350", "Bullet 350", "Himalayan 450", "Scram 411", "Continental GT 650", "Interceptor 650", "Super Meteor 650", "Shotgun 650"],
  Segway: ["X160", "X260"],
  Sherco: ["125 SE-R", "250 SE-R", "300 SE-R", "250 SEF-R", "300 SEF-R", "450 SEF-R", "500 SEF-R"],
  Stark: ["Varg", "Varg EX"],
  Surron: ["Light Bee X", "Storm Bee", "Ultra Bee"],
  Suzuki: ["GSX-R1000R", "GSX-R750", "GSX-R600", "GSX-8R", "GSX-8S", "GSX-S1000", "GSX-S1000GT", "Hayabusa", "V-Strom 250", "V-Strom 650", "V-Strom 800DE", "V-Strom 1050DE", "DR650S", "DR-Z400", "RM-Z250", "RM-Z450", "Katana", "SV650", "Boulevard M109R", "Address 110", "Burgman 400"],
  SWM: ["Superdual 600", "Outlaw 500", "Six Days 500", "RS 500R"],
  SYM: ["Jet 14", "Cruisym 300", "Maxsym TL 500", "ADX 125"],
  Triumph: ["Speed 400", "Scrambler 400 X", "Trident 660", "Tiger Sport 660", "Daytona 660", "Street Triple 765", "Speed Triple 1200 RS", "Speed Triple 1200 RR", "Tiger 900", "Tiger 1200", "Bonneville T100", "Bonneville T120", "Scrambler 900", "Scrambler 1200", "Speedmaster", "Bobber", "Rocket 3", "TF 250-X", "TF 450-RX"],
  Vespa: ["Primavera 50", "Primavera 150", "Sprint 150", "GTS 300", "GTV 300", "Elettrica"],
  Vmoto: ["Stash", "TC Wanderer", "TC Max", "Super Soco TS"],
  Yamaha: ["YZF-R1", "YZF-R1M", "YZF-R7", "YZF-R3", "YZF-R125", "YZF-R15", "MT-125", "MT-03", "MT-07", "MT-09", "MT-09 SP", "MT-10", "MT-10 SP", "Tracer 7", "Tracer 9 GT", "Ténéré 700", "Super Ténéré", "WR250F", "WR450F", "YZ65", "YZ85", "YZ125", "YZ250F", "YZ450F", "TT-R110", "TT-R125", "XSR700", "XSR900", "Bolt", "V-Star 250", "NMAX 155", "XMAX 300", "TMAX 560", "Niken"],
  Zero: ["S", "SR", "SR/F", "SR/S", "DS", "DSR", "DSR/X", "FX", "FXE"],
};

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
          list="bike-models"
          placeholder={`Model${star}`}
          value={value.model}
          onChange={(e) => onChange({ ...value, model: e.target.value })}
          className={sel}
          disabled={!value.make}
        />
        <datalist id="bike-models">
          {(MOTO_MODELS[value.make] ?? []).map((m) => <option key={m} value={m} />)}
        </datalist>
      </div>
    </div>
  );
}