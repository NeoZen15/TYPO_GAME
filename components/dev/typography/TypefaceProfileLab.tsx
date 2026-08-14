"use client";

import { useEffect, useState } from "react";
import type { TypefaceMeasurementProfile } from "@/lib/typography/measurement-profile-contracts";
import { buildAllTypefaceDevProfiles } from "@/lib/dev/typography/typeface-profile-dev-builder";
import { getSpecimenPreviewFamily } from "@/lib/typography/specimen-data";

type BuildState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; profiles: TypefaceMeasurementProfile[] };

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ProfileCard({ profile }: { profile: TypefaceMeasurementProfile }) {
  return (
    <article
      style={{
        display: "grid",
        gap: "0.9rem",
        padding: "1rem",
        borderRadius: "var(--radius)",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>{profile.familyName}</p>
          <span className={`metrics-validator-badge ${profile.audit.status === "pass" ? "is-pass" : "is-fail"}`}>
            {profile.audit.status}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.74 }}>
          Confidence: {profile.confidence} · Score: {profile.audit.score} · Glyphs: {Object.keys(profile.glyphProfiles).length} · Words:{" "}
          {Object.keys(profile.wordProfiles).length}
        </p>
        <p style={{ margin: 0, fontSize: "0.78rem", opacity: 0.68 }}>
          Provenance: {profile.provenance.kind} · Runtime: {profile.provenance.runtime}
          {profile.provenance.sourceFile ? ` · Source: ${profile.provenance.sourceFile}` : ""}
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => downloadJson(`${profile.source.slug ?? profile.fontId}.measurement-profile.json`, profile)}
            style={{
              appearance: "none",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(245,247,255,0.94)",
              borderRadius: "var(--radius-pill)",
              padding: "0.5rem 0.8rem",
              fontSize: "0.78rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Download JSON
          </button>
        </div>
      </div>

      <dl style={{ margin: 0, display: "grid", gap: "0.28rem", padding: "0.65rem 0.75rem", borderRadius: "var(--radius)", background: "rgba(255,255,255,0.03)" }}>
        {Object.entries(profile.metrics).map(([key, metric]) => {
          if (!metric) return null;
          return (
            <div
              key={`${profile.fontId}-${key}`}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: "0.7rem",
                alignItems: "baseline",
              }}
            >
              <dt style={{ margin: 0, fontSize: "0.78rem", opacity: 0.7 }}>{key}</dt>
              <dd style={{ margin: 0, fontSize: "0.78rem", opacity: 0.9, textAlign: "right" }}>
                {metric.value.toFixed(1)}px · {metric.confidence} · {metric.source}
              </dd>
            </div>
          );
        })}
      </dl>

      <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.72 }}>
        Ambiguities: {profile.ambiguityFlags.length ? profile.ambiguityFlags.join(", ") : "none"}
      </p>
      <p style={{ margin: 0, fontSize: "0.76rem", opacity: 0.66 }}>
        Conventions: font metrics = {profile.measurementConventions.fontMetrics} Ink metrics = {profile.measurementConventions.inkMetrics}
      </p>

      <pre
        style={{
          margin: 0,
          overflowX: "auto",
          padding: "0.9rem",
          borderRadius: "var(--radius)",
          background: "rgba(0,0,0,0.22)",
          fontSize: "0.72rem",
          lineHeight: 1.45,
          color: "rgba(240,245,255,0.92)",
        }}
      >
        {JSON.stringify(profile, null, 2)}
      </pre>
    </article>
  );
}

export default function TypefaceProfileLab() {
  const requestKey = "browser-profile-build";
  const [state, setState] = useState<{
    requestKey: string;
    value: BuildState;
  }>({
    requestKey,
    value: { status: "loading" },
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const profiles = await buildAllTypefaceDevProfiles({
          runtimeKind: "browser",
          devicePixelRatio: window.devicePixelRatio || 1,
          measurementFamilyResolver: (fontId, familyName) => getSpecimenPreviewFamily(fontId) ?? familyName,
        });
        if (!cancelled) {
          setState({
            requestKey,
            value: { status: "ready", profiles },
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            requestKey,
            value: {
              status: "error",
              message: error instanceof Error ? error.message : "Typeface profile build failed",
            },
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const resolvedState = state.requestKey === requestKey ? state.value : ({ status: "loading" } as BuildState);

  if (resolvedState.status === "loading") {
    return <p style={{ margin: 0, fontSize: "0.92rem", opacity: 0.76 }}>Building aggregate typeface profiles from the current glyph and word audit corpora…</p>;
  }

  if (resolvedState.status === "error") {
    return <p style={{ margin: 0, fontSize: "0.92rem", color: "rgba(255,172,172,0.92)" }}>{resolvedState.message}</p>;
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    profileCount: resolvedState.profiles.length,
    fontIds: resolvedState.profiles.map((profile) => profile.fontId),
    profiles: resolvedState.profiles,
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          padding: "0.95rem 1rem",
          borderRadius: "var(--radius)",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.88rem", opacity: 0.76 }}>
          Export de dev disponible. Le batch hors navigateur viendra quand le moteur de mesure ne dépendra plus du
          canvas DOM.
        </p>
        <button
          type="button"
          onClick={() => downloadJson("typeface-measurement-profiles.manifest.json", manifest)}
          style={{
            appearance: "none",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(245,247,255,0.94)",
            borderRadius: "var(--radius-pill)",
            padding: "0.58rem 0.92rem",
            fontSize: "0.78rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Download Manifest
        </button>
      </div>
      {resolvedState.profiles.map((profile) => (
        <ProfileCard key={profile.fontId} profile={profile} />
      ))}
    </div>
  );
}
