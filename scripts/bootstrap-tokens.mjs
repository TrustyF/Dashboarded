#!/usr/bin/env node
/**
 * One-time OAuth bootstrap for Google Calendar / Fitbit / Spotify.
 *
 * Run this on a machine with a browser (your laptop) - never needs to run on
 * the Pi. Refresh tokens aren't tied to the machine that requested them, so
 * once this writes the token files under ./data/tokens/, copy that folder
 * onto the Pi (into the `dashboard-tokens` docker volume) and you're done -
 * no need to repeat the bootstrap there.
 *
 * Usage:
 *   node scripts/bootstrap-tokens.mjs google
 *   node scripts/bootstrap-tokens.mjs google-health
 *   node scripts/bootstrap-tokens.mjs fitbit
 *   node scripts/bootstrap-tokens.mjs spotify
 *   node scripts/bootstrap-tokens.mjs all
 *
 * Reads client_id/secret and *_TOKEN_PATH from .env in the repo root.
 */

import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { exec } from "node:child_process";
import { createInterface } from "node:readline/promises";

async function loadEnv() {
  let raw;
  for (const name of [".env.local", ".env"]) {
    try {
      raw = await readFile(new URL(`../${name}`, import.meta.url), "utf-8");
      break;
    } catch {
      // try the next candidate
    }
  }
  if (raw === undefined) {
    console.error("No .env.local or .env found in repo root - fill in client IDs/secrets there first.");
    process.exit(1);
  }
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

function openBrowser(url) {
  console.log(`\nOpen this URL if it doesn't open automatically:\n${url}\n`);
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data));
  console.log(`Wrote ${path}`);
}

function waitForCallback(port, path) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname !== path) {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(error ? `<h1>Failed: ${error}</h1>` : "<h1>Success - you can close this tab.</h1>");
      server.close();
      if (error) reject(new Error(error));
      else resolve(code);
    });
    server.listen(port, "127.0.0.1");
  });
}

async function bootstrapGoogle() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const tokenPath = process.env.GOOGLE_TOKEN_PATH ?? "./data/tokens/google_refresh_token.json";
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing from .env");

  // Google's "Desktop app" OAuth clients accept any loopback port/path as a
  // redirect URI without pre-registering it - this mirrors what Python's
  // InstalledAppFlow.run_local_server() does under the hood.
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  server.close();

  const redirectUri = `http://localhost:${port}/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent", // forces a refresh_token even if you've authorized this app before
  }).toString();

  const callbackPromise = waitForCallback(port, "/callback");
  openBrowser(authUrl.toString());
  const code = await callbackPromise;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json();
  if (!json.refresh_token) {
    throw new Error(
      `No refresh_token in response (${JSON.stringify(json)}). If you've authorized this app before, ` +
        "revoke access at https://myaccount.google.com/permissions and re-run."
    );
  }

  await writeJson(tokenPath, { refresh_token: json.refresh_token });
}

async function bootstrapGoogleHealth() {
  // Reuses the same Cloud project/OAuth client as bootstrapGoogle() (Calendar) -
  // scopes are requested per auth call, not baked into the client, so the one
  // client_id/secret works as long as the Google Health API is enabled and
  // these two scopes are added to that project's OAuth consent screen.
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const tokenPath = process.env.GOOGLE_HEALTH_TOKEN_PATH ?? "./data/tokens/google_health_token.json";
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing from .env");

  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  server.close();

  const redirectUri = `http://localhost:${port}/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
      "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
  }).toString();

  const callbackPromise = waitForCallback(port, "/callback");
  openBrowser(authUrl.toString());
  const code = await callbackPromise;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json();
  if (!json.refresh_token) {
    throw new Error(
      `No refresh_token in response (${JSON.stringify(json)}). If you've authorized this app before, ` +
        "revoke access at https://myaccount.google.com/permissions and re-run."
    );
  }

  await writeJson(tokenPath, { refresh_token: json.refresh_token });
}

async function bootstrapFitbit() {
  const clientId = process.env.FITBIT_CLIENT_ID;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;
  const tokenPath = process.env.FITBIT_TOKEN_PATH ?? "./data/tokens/fitbit_token.json";
  if (!clientId || !clientSecret) throw new Error("FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET missing from .env");

  // Fitbit needs the redirect URI to exactly match what's registered on the
  // app (http://localhost, no port/path, per the original app's registration)
  // - nothing is listening there, so this can't be automated with a local
  // server. Approve in the browser, then paste the `code` param from the
  // resulting "can't reach this page" URL.
  const redirectUri = "http://localhost";
  const authUrl = `https://www.fitbit.com/oauth2/authorize?${new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "weight",
  })}`;

  openBrowser(authUrl);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question("Paste the `code` value from the redirected URL: ")).trim();
  rl.close();

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);

  await writeJson(tokenPath, json);
}

async function bootstrapSpotify() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const cachePath = process.env.SPOTIFY_TOKEN_CACHE_PATH ?? "./data/tokens/.spotify_cache";
  if (!clientId || !clientSecret) throw new Error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET missing from .env");

  // Must match the redirect URI registered on the Spotify app exactly. Spotify
  // rejects "http://localhost" as an insecure redirect URI now - only
  // "https://" or the literal loopback IP "http://127.0.0.1" are accepted,
  // so the app's registered redirect URI needs to be updated to match too
  // (Spotify Developer Dashboard -> your app -> Settings -> Redirect URIs).
  const port = 8888;
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope:
      "user-read-playback-state streaming user-modify-playback-state user-read-currently-playing " +
      "app-remote-control user-read-private user-read-email",
  })}`;

  const callbackPromise = waitForCallback(port, "/callback");
  openBrowser(authUrl);
  const code = await callbackPromise;

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);

  await writeJson(cachePath, {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() / 1000 + json.expires_in,
  });
}

const SERVICES = {
  google: bootstrapGoogle,
  "google-health": bootstrapGoogleHealth,
  fitbit: bootstrapFitbit,
  spotify: bootstrapSpotify,
};

async function main() {
  const target = process.argv[2];
  if (!target || (!(target in SERVICES) && target !== "all")) {
    console.error(`Usage: node scripts/bootstrap-tokens.mjs <${Object.keys(SERVICES).join("|")}|all>`);
    process.exit(1);
  }

  await loadEnv();

  const targets = target === "all" ? Object.keys(SERVICES) : [target];
  for (const name of targets) {
    console.log(`\n=== ${name} ===`);
    try {
      await SERVICES[name]();
    } catch (err) {
      console.error(`${name} bootstrap failed:`, err.message);
    }
  }
}

main();
