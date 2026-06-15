export interface IpLookupResult {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  isProxy: boolean;
}

export async function ipLookup(params: { ip?: string }): Promise<IpLookupResult> {
  const ip = params.ip ?? '';

  // ip-api.com — free, no key needed (45 requests/min)
  const url = ip
    ? `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,proxy,query`
    : `http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,proxy,query`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`IP lookup failed: ${res.status}`);

  const data = await res.json() as {
    status: string;
    message?: string;
    query: string;
    country: string;
    countryCode: string;
    regionName: string;
    city: string;
    lat: number;
    lon: number;
    timezone: string;
    isp: string;
    org: string;
    proxy: boolean;
  };

  if (data.status !== 'success') throw new Error(`IP lookup failed: ${data.message ?? data.status}`);

  return {
    ip: data.query,
    country: data.country,
    countryCode: data.countryCode,
    region: data.regionName,
    city: data.city,
    lat: data.lat,
    lon: data.lon,
    timezone: data.timezone,
    isp: data.isp,
    org: data.org,
    isProxy: data.proxy,
  };
}
