export type Coordinates = { latitude: number; longitude: number };
export function validCoordinates(value: { latitude?: number | null; longitude?: number | null } | null | undefined): value is Coordinates {
  return !!value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && value.latitude! >= -90 && value.latitude! <= 90 && value.longitude! >= -180 && value.longitude! <= 180;
}
export function interpolateTrip(start: Coordinates, end: Coordinates, progress: number): Coordinates {
  const fraction = Math.min(1, Math.max(0, progress));
  return { latitude: start.latitude + (end.latitude - start.latitude) * fraction, longitude: start.longitude + (end.longitude - start.longitude) * fraction };
}
export function formatAddress(place: { streetNumber?: string | null; street?: string | null; name?: string | null; district?: string | null; subregion?: string | null; city?: string | null; region?: string | null; country?: string | null }) {
  const street = place.street ? [place.streetNumber, place.street].filter(Boolean).join(' ') : place.name;
  const parts = [street, place.district, place.subregion, place.city, place.region, place.country].map(part => part?.trim()).filter((part): part is string => !!part);
  return [...new Map(parts.map(part => [part.toLocaleLowerCase('vi'), part])).values()].join(', ');
}
