function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function envOptional(key: string): string | undefined {
  return process.env[key];
}

export const config = {
  port: parseInt(env("PORT", "3000"), 10),
  dbPath: env("DB_PATH", "./data/student-assist.db"),

  openaiApiKey: envOptional("OPENAI_API_KEY"),
  openaiModel: env("OPENAI_MODEL", "gpt-4o-mini"),

  googleClientId: envOptional("GOOGLE_CLIENT_ID"),
  googleClientSecret: envOptional("GOOGLE_CLIENT_SECRET"),
  googleRedirectUri: env(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:3000/api/v1/auth/google/callback"
  ),

  githubToken: envOptional("GITHUB_TOKEN"),

  openweathermapApiKey: envOptional("OPENWEATHERMAP_API_KEY"),

  nodeEnv: env("NODE_ENV", "development"),
  isProd: process.env.NODE_ENV === "production",
} as const;
