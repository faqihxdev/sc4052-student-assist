import { AppError } from "../lib/errors";
import { config } from "../lib/config";
import { getApiKeyForService } from "./settings.service";
import { getMockCurrentWeather, getMockForecast } from "../lib/mock-data";

const BASE_URL = "https://api.openweathermap.org/data/2.5";
const DEFAULT_CITY = "Singapore";

function useMockWeather(): boolean {
  if (config.mockMode) return true;
  return !getApiKeyForService("weather");
}

function getApiKey(): string {
  const key = getApiKeyForService("weather");
  if (!key) {
    throw new AppError(
      503,
      "Weather service unavailable: No OpenWeatherMap API key configured. " +
        "Get a free key at https://openweathermap.org/api and add it to your .env file or configure it in Settings."
    );
  }
  return key;
}

export interface CurrentWeather {
  city: string;
  country: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
  timestamp: string;
}

export interface ForecastEntry {
  datetime: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
}

export interface Forecast {
  city: string;
  country: string;
  entries: ForecastEntry[];
}

export async function getCurrentWeather(
  city: string = DEFAULT_CITY
): Promise<CurrentWeather> {
  if (useMockWeather()) return getMockCurrentWeather(city);

  const apiKey = getApiKey();
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new AppError(404, `City "${city}" not found`);
    }
    throw new AppError(res.status, (body as any).message ?? "Weather API error");
  }

  const data: any = await res.json();

  return {
    city: data.name,
    country: data.sys?.country,
    temperature: data.main.temp,
    feels_like: data.main.feels_like,
    humidity: data.main.humidity,
    description: data.weather[0]?.description,
    icon: data.weather[0]?.icon,
    wind_speed: data.wind?.speed,
    timestamp: new Date(data.dt * 1000).toISOString(),
  };
}

export async function getForecast(
  city: string = DEFAULT_CITY
): Promise<Forecast> {
  if (useMockWeather()) return getMockForecast(city);

  const apiKey = getApiKey();
  const url = `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new AppError(404, `City "${city}" not found`);
    }
    throw new AppError(res.status, (body as any).message ?? "Weather API error");
  }

  const data: any = await res.json();

  const entries: ForecastEntry[] = data.list.map((item: any) => ({
    datetime: item.dt_txt,
    temperature: item.main.temp,
    feels_like: item.main.feels_like,
    humidity: item.main.humidity,
    description: item.weather[0]?.description,
    icon: item.weather[0]?.icon,
    wind_speed: item.wind?.speed,
  }));

  return {
    city: data.city.name,
    country: data.city.country,
    entries,
  };
}
