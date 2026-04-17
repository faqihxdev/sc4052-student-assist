import { Hono } from "hono";
import { google } from "googleapis";
import { config } from "../lib/config";
import { AppError } from "../lib/errors";
import { getSetting, setSetting, deleteSetting } from "../services/settings.service";

const app = new Hono();

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

function getOAuth2Client() {
  const clientId = config.googleClientId;
  const clientSecret = config.googleClientSecret;

  if (!clientId || !clientSecret) {
    throw new AppError(
      503,
      "Google OAuth not configured: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required. " +
        "Set them up in Google Cloud Console and add to your .env file."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, config.googleRedirectUri);
}

app.get("/google", (c) => {
  const oauth2Client = getOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  return c.redirect(authUrl);
});

app.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");

  if (error) {
    const redirectUrl = config.isProd
      ? "/settings?auth=error&message=" + encodeURIComponent(error)
      : "http://localhost:5173/settings?auth=error&message=" + encodeURIComponent(error);
    return c.redirect(redirectUrl);
  }

  if (!code) {
    throw new AppError(400, "Missing authorization code");
  }

  const oauth2Client = getOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new AppError(
      500,
      "No refresh token received. This can happen if the app was previously authorized. " +
        "Revoke access at https://myaccount.google.com/permissions and try again."
    );
  }

  setSetting("google_oauth_token", JSON.stringify(tokens));

  const redirectUrl = config.isProd
    ? "/settings?auth=success"
    : "http://localhost:5173/settings?auth=success";
  return c.redirect(redirectUrl);
});

app.delete("/google", (c) => {
  const deleted = deleteSetting("google_oauth_token");

  return c.json({
    message: deleted
      ? "Google account disconnected"
      : "No Google account was connected",
    alreadyDisconnected: !deleted,
  });
});

app.get("/google/status", (c) => {
  const tokenJson = getSetting("google_oauth_token");
  const hasClientCredentials = !!(config.googleClientId && config.googleClientSecret);

  if (!hasClientCredentials) {
    return c.json({
      connected: false,
      configured: false,
      message: "Google OAuth credentials not configured",
    });
  }

  if (!tokenJson) {
    return c.json({
      connected: false,
      configured: true,
      message: "Google account not connected; click Connect to authorize",
    });
  }

  return c.json({
    connected: true,
    configured: true,
    message: "Google account connected",
  });
});

export default app;
