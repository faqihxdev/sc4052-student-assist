import { Hono } from "hono";
import { getCurrentWeather, getForecast } from "../services/weather.service";

const app = new Hono();

app.get("/current", async (c) => {
  const city = c.req.query("city") || undefined;
  const weather = await getCurrentWeather(city);
  return c.json(weather);
});

app.get("/forecast", async (c) => {
  const city = c.req.query("city") || undefined;
  const forecast = await getForecast(city);
  return c.json(forecast);
});

export default app;
