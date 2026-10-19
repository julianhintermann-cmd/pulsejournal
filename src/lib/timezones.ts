/** Time zones offered in the setup and settings selects. */
export function timeZoneOptions(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = supported ? supported("timeZone") : [];
  const list =
    zones.length > 0 ? zones : ["Europe/Zurich", "Europe/Berlin", "Europe/London", "America/New_York", "UTC"];
  return Array.from(new Set(["Europe/Zurich", ...list, "UTC"]));
}
