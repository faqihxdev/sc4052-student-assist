import { Cloud, Droplets, Wind, Gauge, Eye } from "lucide-react";

interface WeatherData {
  city?: string;
  temperature?: number;
  feels_like?: number;
  description?: string;
  humidity?: number;
  wind_speed?: number;
  icon?: string;
  pressure?: number;
  visibility?: number;
  forecast?: ForecastItem[];
}

interface ForecastItem {
  date?: string;
  temperature?: number;
  description?: string;
  icon?: string;
  humidity?: number;
}

interface WeatherCardProps {
  data: unknown;
}

const WEATHER_EMOJI: Record<string, string> = {
  "01d": "☀️", "01n": "🌙",
  "02d": "⛅", "02n": "☁️",
  "03d": "☁️", "03n": "☁️",
  "04d": "☁️", "04n": "☁️",
  "09d": "🌧️", "09n": "🌧️",
  "10d": "🌦️", "10n": "🌧️",
  "11d": "⛈️", "11n": "⛈️",
  "13d": "🌨️", "13n": "🌨️",
  "50d": "🌫️", "50n": "🌫️",
};

function getEmoji(icon?: string): string {
  if (!icon) return "🌤️";
  return WEATHER_EMOJI[icon] || "🌤️";
}

export default function WeatherCard({ data }: WeatherCardProps) {
  const w = data as WeatherData;

  if (!w || (!w.temperature && !w.forecast)) {
    return (
      <div className="rounded-xl border border-[var(--color-card-weather-border)] bg-[var(--color-card-weather)] p-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-card-weather-accent)]">
          <Cloud className="h-4 w-4" />
          <span className="font-medium">No weather data</span>
        </div>
      </div>
    );
  }

  if (w.forecast && w.forecast.length > 0) {
    return <ForecastCard weather={w} />;
  }

  return (
    <div className="rounded-xl border border-[var(--color-card-weather-border)] bg-[var(--color-card-weather)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-card-weather-border)] px-4 py-2.5">
        <Cloud className="h-4 w-4 text-[var(--color-card-weather-accent)]" />
        <span className="text-xs font-semibold text-[var(--color-card-weather-accent)] uppercase tracking-wide">
          Weather
        </span>
        {w.city && <span className="text-xs text-[var(--color-text-muted)]">{w.city}</span>}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{getEmoji(w.icon)}</span>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-[var(--color-text-primary)]">
                {Math.round(w.temperature ?? 0)}°
              </span>
              <span className="text-sm text-[var(--color-text-muted)]">C</span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] capitalize">{w.description}</p>
            {w.feels_like != null && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Feels like {Math.round(w.feels_like)}°
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {w.humidity != null && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--color-card-weather-accent)]/10 px-3 py-2 text-xs text-[var(--color-card-weather-accent)]">
              <Droplets className="h-3.5 w-3.5" />
              <span>{w.humidity}% humidity</span>
            </div>
          )}
          {w.wind_speed != null && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--color-card-weather-accent)]/10 px-3 py-2 text-xs text-[var(--color-card-weather-accent)]">
              <Wind className="h-3.5 w-3.5" />
              <span>{w.wind_speed} m/s wind</span>
            </div>
          )}
          {w.pressure != null && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--color-card-weather-accent)]/10 px-3 py-2 text-xs text-[var(--color-card-weather-accent)]">
              <Gauge className="h-3.5 w-3.5" />
              <span>{w.pressure} hPa</span>
            </div>
          )}
          {w.visibility != null && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--color-card-weather-accent)]/10 px-3 py-2 text-xs text-[var(--color-card-weather-accent)]">
              <Eye className="h-3.5 w-3.5" />
              <span>{(w.visibility / 1000).toFixed(1)} km</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ForecastCard({ weather }: { weather: WeatherData }) {
  return (
    <div className="rounded-xl border border-[var(--color-card-weather-border)] bg-[var(--color-card-weather)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-card-weather-border)] px-4 py-2.5">
        <Cloud className="h-4 w-4 text-[var(--color-card-weather-accent)]" />
        <span className="text-xs font-semibold text-[var(--color-card-weather-accent)] uppercase tracking-wide">
          Forecast
        </span>
        {weather.city && <span className="text-xs text-[var(--color-text-muted)]">{weather.city}</span>}
      </div>
      <div className="p-3 flex gap-2 overflow-x-auto scrollbar-thin">
        {weather.forecast!.slice(0, 8).map((f, i) => {
          const d = f.date ? new Date(f.date) : null;
          return (
            <div
              key={i}
              className="flex shrink-0 flex-col items-center rounded-lg bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)] px-3 py-2 text-center min-w-[72px]"
            >
              <span className="text-[10px] text-[var(--color-text-muted)] mb-1">
                {d
                  ? d.toLocaleDateString([], {
                      weekday: "short",
                      hour: "numeric",
                    })
                  : ""}
              </span>
              <span className="text-xl mb-1">{getEmoji(f.icon)}</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {Math.round(f.temperature ?? 0)}°
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] capitalize truncate w-full">
                {f.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
