export function parseJplHorizons(text: string) {
  const lines = text.split("\n");
  let inside = false;

  for (const line of lines) {
    if (line.includes("$$SOE")) {
      inside = true;
      continue;
    }

    if (line.includes("$$EOE")) {
      break;
    }

    if (!inside) continue;

    const cleaned = line.trim();
    if (!cleaned) continue;

    const parts = cleaned.split(/\s+/);

    if (parts.length < 5) continue;

    const azimuth = Number(parts[3]);
    const altitude = Number(parts[4]);

    if (!Number.isFinite(azimuth) || !Number.isFinite(altitude)) {
      continue;
    }

    return {
      azimuth: Number(azimuth.toFixed(2)),
      altitude: Number(altitude.toFixed(2)),
    };
  }

  return null;
}