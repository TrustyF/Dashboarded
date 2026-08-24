import { GET } from "@/app/api/fitbit/debug/route";

// Standalone diagnostic page for the steps-graph-is-empty issue - not part of
// ViewHost's swipeable kiosk views (see app/page.tsx), just a plain route you
// hit directly at /debug/fitbit. Renders the same JSON /api/fitbit/debug
// returns, with a pass/fail summary on top for a quick read.

export const dynamic = "force-dynamic";

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ padding: "6px 10px", borderRadius: 6, background: ok ? "#1e3a1e" : "#3a1e1e", color: ok ? "#8f8" : "#f88", fontFamily: "monospace" }}>
      {ok ? "OK" : "FAIL"} — {label}
    </div>
  );
}

export default async function FitbitDebugPage() {
  const res = await GET();
  const data = await res.json();

  const tzLooksLikeUtc = data.time.resolvedTimeZone === "UTC" || data.time.processEnvTZ == null;
  const tokenOk = data.tokenFile.readable && data.tokenFile.hasRefreshToken;
  const accessOk = data.accessToken.ok;
  const probeOk = data.liveStepsProbe.ran && data.liveStepsProbe.ok;
  const rollupPoints = probeOk ? (data.liveStepsProbe.body?.rollupDataPoints ?? []) : [];
  const cachedSteps = data.cache.steps[0]?.data as Array<{ dateTime: string; value: number }> | undefined;

  return (
    <div style={{ padding: 24, background: "#111", color: "#eee", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <h1>Fitbit / Google Health steps debug</h1>
      <p style={{ opacity: 0.7 }}>Generated at {data.time.nowIso}. Reload to re-run everything (including a live, uncached upstream call).</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "16px 0" }}>
        <Badge ok={!tzLooksLikeUtc} label={`container timezone resolves to "${data.time.resolvedTimeZone}" (TZ env: ${data.time.processEnvTZ ?? "unset"})`} />
        <Badge ok={tokenOk} label="token file readable with a refresh_token" />
        <Badge ok={accessOk} label={`access token exchange${data.accessToken.error ? " — " + data.accessToken.error : ""}`} />
        <Badge ok={probeOk} label={`live dailyRollUp call${data.liveStepsProbe.ran ? ` — HTTP ${data.liveStepsProbe.status}` : " — not attempted (no access token)"}`} />
        <Badge ok={rollupPoints.length > 0} label={`upstream returned ${rollupPoints.length} of 7 days with step data for the queried week`} />
      </div>

      <h2>Computed week window</h2>
      <p>
        Querying <code>{week(data)}</code> ({data.week.civilDatesQueried[0]} .. {data.week.civilDatesQueried[6]}), cache key <code>{data.week.cacheKey}</code>
      </p>

      <h2>Cached steps entry (what the real /api/fitbit route is currently serving)</h2>
      {cachedSteps ? (
        <pre style={{ background: "#000", padding: 12, overflowX: "auto" }}>{JSON.stringify(data.cache.steps[0], null, 2)}</pre>
      ) : (
        <p style={{ opacity: 0.7 }}>Nothing cached yet under {data.week.cacheKey} - the real route hasn&apos;t been hit since this key started, or the cache was cleared by a redeploy.</p>
      )}

      <h2>Full diagnostic JSON</h2>
      <pre style={{ background: "#000", padding: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function week(data: { week: { startLocal: string; endLocal: string } }) {
  return `${data.week.startLocal} → ${data.week.endLocal}`;
}
