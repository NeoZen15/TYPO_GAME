"use client";

import { useEffect, useState } from "react";
import { buildFallbackCalibrationReport, type FallbackCalibrationReport } from "@/lib/dev/typography/fallback-calibration";
import { getSpecimenPreviewFamily } from "@/lib/typography/specimen-data";

type CalibrationState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; reports: FallbackCalibrationReport[] };

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

const formatDelta = (value: number) => {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
};

function CalibrationCard({ report }: { report: FallbackCalibrationReport }) {
  return (
    <article
      style={{
        display: "grid",
        gap: "0.95rem",
        padding: "1rem",
        borderRadius: "24px",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>{report.familyName}</p>
          <span className="metrics-validator-badge is-pass">browser vs fallback</span>
        </div>
        <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.74 }}>
          Preset key: {report.presetKey} · Calibration samples: {report.samples.length}
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() =>
              downloadJson(`${report.fontId}.fallback-calibration.json`, {
                fontId: report.fontId,
                familyName: report.familyName,
                currentPreset: report.currentPreset,
                suggestedPreset: report.suggestedPreset,
                metricDelta: report.metricDelta,
                samples: report.samples,
              })
            }
            style={{
              appearance: "none",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(245,247,255,0.94)",
              borderRadius: "999px",
              padding: "0.5rem 0.8rem",
              fontSize: "0.78rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Download Calibration
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <dl style={{ margin: 0, display: "grid", gap: "0.28rem", padding: "0.75rem", borderRadius: "14px", background: "rgba(255,255,255,0.03)" }}>
          <dt style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, opacity: 0.9 }}>Metric Delta</dt>
          {Object.entries(report.metricDelta).map(([key, value]) => (
            <div
              key={`${report.fontId}-metric-${key}`}
              style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "0.6rem", alignItems: "baseline" }}
            >
              <dt style={{ margin: 0, fontSize: "0.78rem", opacity: 0.7 }}>{key}</dt>
              <dd style={{ margin: 0, fontSize: "0.78rem", textAlign: "right" }}>{formatDelta(value)}</dd>
            </div>
          ))}
        </dl>

        <dl style={{ margin: 0, display: "grid", gap: "0.28rem", padding: "0.75rem", borderRadius: "14px", background: "rgba(255,255,255,0.03)" }}>
          <dt style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, opacity: 0.9 }}>Suggested Preset</dt>
          {Object.entries(report.suggestedPreset).map(([key, value]) => (
            <div
              key={`${report.fontId}-preset-${key}`}
              style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "0.6rem", alignItems: "baseline" }}
            >
              <dt style={{ margin: 0, fontSize: "0.78rem", opacity: 0.7 }}>{key}</dt>
              <dd style={{ margin: 0, fontSize: "0.78rem", textAlign: "right" }}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div style={{ display: "grid", gap: "0.65rem" }}>
        <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.74 }}>Sample deltas</p>
        {report.samples.map((sample) => (
          <dl
            key={`${report.fontId}-${sample.key}`}
            style={{
              margin: 0,
              display: "grid",
              gap: "0.24rem",
              padding: "0.7rem 0.75rem",
              borderRadius: "14px",
              background: "rgba(0,0,0,0.16)",
            }}
          >
            <dt style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700 }}>
              {sample.key} · <span style={{ opacity: 0.72 }}>{sample.sample}</span>
            </dt>
            <dd style={{ margin: 0, fontSize: "0.76rem", opacity: 0.86 }}>
              width {formatDelta(sample.delta.width)} · ascent {formatDelta(sample.delta.ascent)} · descent {formatDelta(sample.delta.descent)}
            </dd>
          </dl>
        ))}
      </div>
    </article>
  );
}

export default function FallbackCalibrationLab() {
  const [state, setState] = useState<CalibrationState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const reports = await buildFallbackCalibrationReport({
          measurementFamilyResolver: (fontId, familyName) => getSpecimenPreviewFamily(fontId) ?? familyName,
        });
        if (!cancelled) {
          setState({ status: "ready", reports });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Fallback calibration failed",
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <p style={{ margin: 0, fontSize: "0.92rem", opacity: 0.76 }}>Building browser vs fallback calibration report…</p>;
  }

  if (state.status === "error") {
    return <p style={{ margin: 0, fontSize: "0.92rem", color: "rgba(255,172,172,0.92)" }}>{state.message}</p>;
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div
        style={{
          padding: "0.95rem 1rem",
          borderRadius: "20px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.88rem", opacity: 0.76 }}>
          This board compares direct browser measurements against the fallback runtime and proposes target preset
          values. It is a calibration aid only: nothing here mutates the runtime automatically.
        </p>
      </div>
      {state.reports.map((report) => (
        <CalibrationCard key={report.fontId} report={report} />
      ))}
    </div>
  );
}
