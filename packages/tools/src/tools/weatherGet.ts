interface WeatherResult {
  location: string;
  country: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  windSpeed: number;
  units: 'metric' | 'imperial';
}

export async function weatherGet(params: {
  location: string;
  units?: 'metric' | 'imperial';
}): Promise<WeatherResult> {
  const { location, units = 'metric' } = params;
  const apiKey = process.env['OPENWEATHER_API_KEY'];

  if (!apiKey) throw new Error('OPENWEATHER_API_KEY environment variable is not set');

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Weather API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    name: string;
    sys: { country: string };
    main: { temp: number; feels_like: number; humidity: number };
    weather: Array<{ description: string }>;
    wind: { speed: number };
  };

  return {
    location: data.name,
    country: data.sys.country,
    temperature: Math.round(data.main.temp),
    feelsLike: Math.round(data.main.feels_like),
    humidity: data.main.humidity,
    description: data.weather[0]?.description ?? '',
    windSpeed: data.wind.speed,
    units,
  };
}
