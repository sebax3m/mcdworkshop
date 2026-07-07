// Motorcycle library — brands and popular models used by the quick booking picker's
// datalist suggestions. Free text is still allowed for anything not listed.

export const BIKE_MAKES: Record<string, string[]> = {
  Yamaha: [
    "MT-03", "MT-07", "MT-09", "MT-10", "YZF-R1", "YZF-R3", "YZF-R6", "YZF-R7",
    "Tracer 700", "Tracer 900", "Tracer 9 GT", "Ténéré 700", "XSR700", "XSR900",
    "Bolt", "V-Max", "FJR1300", "WR250F", "WR450F", "YZ250F", "YZ450F",
  ],
  Honda: [
    "CBR125R", "CBR300R", "CBR500R", "CBR600RR", "CBR650R", "CBR1000RR Fireblade",
    "CB125R", "CB300R", "CB500F", "CB650R", "CB1000R",
    "Africa Twin CRF1100L", "CRF250L", "CRF300L", "CRF450L",
    "NC750X", "X-ADV", "Gold Wing", "Rebel 300", "Rebel 500", "Rebel 1100",
    "Grom", "Monkey", "Super Cub",
  ],
  Kawasaki: [
    "Ninja 300", "Ninja 400", "Ninja 650", "Ninja 1000SX", "Ninja ZX-6R", "Ninja ZX-10R", "Ninja H2",
    "Z400", "Z650", "Z900", "Z1000", "Z H2",
    "Versys 300", "Versys 650", "Versys 1000",
    "KLR650", "KLX230", "KLX300", "Vulcan S", "Vulcan 900", "W800",
  ],
  Suzuki: [
    "GSX-R125", "GSX-R600", "GSX-R750", "GSX-R1000",
    "GSX-S125", "GSX-S750", "GSX-S1000", "GSX-8S",
    "SV650", "V-Strom 250", "V-Strom 650", "V-Strom 1050",
    "Hayabusa", "Katana", "DR-Z400", "RM-Z250", "RM-Z450",
  ],
  KTM: [
    "125 Duke", "200 Duke", "250 Duke", "390 Duke", "690 Duke", "790 Duke", "890 Duke", "1290 Super Duke R",
    "RC 125", "RC 200", "RC 390",
    "390 Adventure", "790 Adventure", "890 Adventure", "1290 Super Adventure",
    "250 EXC", "300 EXC", "450 EXC", "500 EXC",
  ],
  BMW: [
    "G 310 R", "G 310 GS", "F 750 GS", "F 850 GS", "F 900 R", "F 900 XR",
    "R nineT", "R 1250 R", "R 1250 GS", "R 1250 GS Adventure", "R 1250 RS", "R 1250 RT",
    "S 1000 R", "S 1000 RR", "S 1000 XR",
    "K 1600 GT", "K 1600 GTL",
  ],
  Triumph: [
    "Trident 660", "Street Triple 660", "Street Triple 765", "Speed Triple 1200",
    "Daytona 660", "Daytona 765",
    "Tiger Sport 660", "Tiger 900", "Tiger 1200",
    "Bonneville T100", "Bonneville T120", "Bonneville Bobber", "Speedmaster",
    "Rocket 3",
  ],
  Ducati: [
    "Panigale V2", "Panigale V4", "Streetfighter V2", "Streetfighter V4",
    "Monster", "Monster SP", "SuperSport 950",
    "Multistrada V2", "Multistrada V4",
    "Scrambler Icon", "Scrambler Nightshift", "Scrambler Desert Sled",
    "Diavel V4", "XDiavel",
    "DesertX", "Hypermotard 950",
  ],
  "Harley-Davidson": [
    "Iron 883", "Forty-Eight", "Sportster S", "Nightster",
    "Street Bob", "Fat Bob", "Low Rider S", "Fat Boy", "Heritage Classic",
    "Road King", "Street Glide", "Road Glide", "Electra Glide",
    "Pan America 1250",
  ],
  Aprilia: [
    "RS 125", "RS 660", "RSV4",
    "Tuono 660", "Tuono V4",
    "Tuareg 660", "SR GT",
  ],
  Husqvarna: [
    "Svartpilen 125", "Svartpilen 401", "Svartpilen 701",
    "Vitpilen 401", "Vitpilen 701",
    "Norden 901",
    "FE 250", "FE 350", "FE 450", "TE 300",
  ],
  "Royal Enfield": [
    "Meteor 350", "Classic 350", "Hunter 350", "Bullet 350",
    "Interceptor 650", "Continental GT 650", "Super Meteor 650", "Shotgun 650",
    "Himalayan",
  ],
  Indian: [
    "Scout", "Scout Bobber", "Scout Rogue", "Sport Chief",
    "Chief", "Chief Dark Horse", "Super Chief",
    "Springfield", "Roadmaster", "Challenger", "Pursuit",
    "FTR", "FTR Sport", "FTR Rally",
  ],
  "Moto Guzzi": [
    "V7 Stone", "V7 Special", "V9 Bobber", "V9 Roamer",
    "V85 TT", "V100 Mandello",
    "California", "Audace", "Eldorado",
  ],
  MV Agusta: [
    "Brutale 800", "Brutale 1000",
    "F3 800", "F3 RR",
    "Dragster 800", "Turismo Veloce", "Superveloce",
  ],
  Benelli: [
    "TNT 125", "TNT 300", "TNT 600",
    "Leoncino 250", "Leoncino 500", "Leoncino 800",
    "TRK 502", "TRK 502X", "TRK 702", "TRK 702X",
    "302S", "502C", "752S",
  ],
  CFMoto: [
    "300NK", "300SR", "450NK", "450SR", "650NK", "650MT", "700CL-X", "800MT", "800NK", "1250TR-G",
  ],
  "Zero Motorcycles": [
    "S", "SR", "SR/F", "SR/S", "FX", "FXE", "DS", "DSR", "DSR/X",
  ],
  Vespa: [
    "Primavera 50", "Primavera 125", "Primavera 150",
    "Sprint 125", "Sprint 150",
    "GTS 125", "GTS 300", "GTV",
  ],
  Piaggio: [
    "Liberty 150", "Beverly 300", "Beverly 400", "MP3 400", "MP3 530",
  ],
};

export const BIKE_MAKE_NAMES = Object.keys(BIKE_MAKES).sort();

const currentYear = new Date().getFullYear();
export const BIKE_YEARS: number[] = Array.from(
  { length: currentYear - 1989 },
  (_, i) => currentYear + 1 - i, // newest first
);
