interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
  types: string[];
}

interface ReverseGeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  components: Array<{ types: string[]; longName: string; shortName: string }>;
}

export async function mapsGeocode(params: {
  address?: string;
  lat?: number;
  lng?: number;
}): Promise<GeocodeResult | ReverseGeocodeResult> {
  const { address, lat, lng } = params;
  const apiKey = process.env['GOOGLE_MAPS_API_KEY'];

  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY environment variable is not set');

  if (lat !== undefined && lng !== undefined) {
    // Reverse geocode
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json() as {
      status: string;
      results: Array<{
        formatted_address: string;
        address_components: Array<{ types: string[]; long_name: string; short_name: string }>;
      }>;
    };
    if (data.status !== 'OK') throw new Error(`Geocoding failed: ${data.status}`);
    const r = data.results[0];
    return {
      lat, lng,
      formattedAddress: r.formatted_address,
      components: r.address_components.map((c) => ({ types: c.types, longName: c.long_name, shortName: c.short_name })),
    };
  }

  if (!address) throw new Error('Either address or lat/lng is required');

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json() as {
    status: string;
    results: Array<{
      place_id: string;
      types: string[];
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  };

  if (data.status !== 'OK') throw new Error(`Geocoding failed: ${data.status}`);
  const r = data.results[0];
  return {
    address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formattedAddress: r.formatted_address,
    placeId: r.place_id,
    types: r.types,
  };
}
