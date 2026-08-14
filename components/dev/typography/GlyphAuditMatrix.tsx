"use client";

import { useEffect, useMemo, useState } from "react";
import MeasuredGlyphSplit from "@/components/typography/MeasuredGlyphSplit";
import { buildGlyphOverlayModel, measureGlyph } from "@/lib/typography/glyph-overlay-engine";
import {
  evaluateGlyphAudit,
  formatGuideLabel,
  getGlyphAuditExpectation,
  GLYPH_AUDIT_GROUPS,
  type GlyphAuditEvaluation,
  type GlyphAuditExpectation,
} from "@/lib/dev/typography/glyph-audit-spec";
import { buildGlyphMeasurementProfile } from "@/lib/dev/typography/glyph-measurement-profile-adapter";
import type { GlyphMeasurementProfile } from "@/lib/typography/measurement-profile-contracts";

type AuditProbeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; evaluation: GlyphAuditEvaluation; profile: GlyphMeasurementProfile };

const LEFT = {
  label: "Helvetica Neue",
  family: "Helvetica Neue",
} as const;

const RIGHT = {
  label: "Inter",
  family: "Inter",
} as const;

const AUDIT_STAGE_SIZE = {
  width: 520,
  height: 320,
} as const;

function formatDelta(value: number | null) {
  if (value === null) return "n/a";
  const rounded = value.toFixed(1);
  return `${value > 0 ? "+" : ""}${rounded}px`;
}

function useAuditProbe(family: string, glyph: string, expectation: GlyphAuditExpectation): AuditProbeState {
  const requestKey = `${family}:${glyph}`;
  const [state, setState] = useState<{
    requestKey: string;
    value: AuditProbeState;
  }>({
    requestKey,
    value: { status: "loading" },
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const metrics = await measureGlyph({
          family,
          glyph,
          width: AUDIT_STAGE_SIZE.width,
          height: AUDIT_STAGE_SIZE.height,
        });
        const overlayModel = buildGlyphOverlayModel(glyph, metrics, AUDIT_STAGE_SIZE);
        const evaluation = evaluateGlyphAudit(expectation, overlayModel, metrics);

        if (!cancelled) {
          setState({
            requestKey,
            value: {
              status: "ready",
              evaluation,
              profile: buildGlyphMeasurementProfile({
                fontId: family,
                renderContextId: `glyph-audit:${family}:${glyph}`,
                glyph,
                metrics,
                overlayModel,
                auditEvaluation: evaluation,
              }),
            },
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            requestKey,
            value: {
              status: "error",
              message: error instanceof Error ? error.message : "Audit probe failed",
            },
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [expectation, family, glyph, requestKey]);

  return state.requestKey === requestKey ? state.value : { status: "loading" };
}

function AuditPaneStatus({
  label,
  probe,
}: {
  label: string;
  probe: AuditProbeState;
}) {
  if (probe.status === "loading") {
    return (
      <div
        style={{
          display: "grid",
          gap: "0.35rem",
          padding: "0.75rem 0.85rem",
          borderRadius: "var(--radius)",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.025)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <strong style={{ fontSize: "0.82rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</strong>
          <span className="metrics-validator-badge">loading</span>
        </div>
      </div>
    );
  }

  if (probe.status === "error") {
    return (
      <div
        style={{
          display: "grid",
          gap: "0.35rem",
          padding: "0.75rem 0.85rem",
          borderRadius: "var(--radius)",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.025)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <strong style={{ fontSize: "0.82rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</strong>
          <span className="metrics-validator-badge is-fail">error</span>
        </div>
        <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.8 }}>{probe.message}</p>
      </div>
    );
  }

  const { evaluation } = probe;
  const profile = probe.profile;
  const metricEntries = Object.entries(profile.metrics);

  return (
    <div
      style={{
        display: "grid",
        gap: "0.35rem",
        padding: "0.75rem 0.85rem",
        borderRadius: "var(--radius)",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.025)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <strong style={{ fontSize: "0.82rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</strong>
        <span className={`metrics-validator-badge ${evaluation.pass ? "is-pass" : "is-fail"}`}>
          {evaluation.pass ? "pass" : "fail"}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.8 }}>
        Structure: {evaluation.structuralPass ? "pass" : "fail"} · Geometry: {evaluation.geometryPass ? "pass" : "fail"}
      </p>
      <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.8 }}>
        Guides attendus: {evaluation.expectedGuides.map(formatGuideLabel).join(" + ")}
      </p>
      <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.72 }}>
        Guides rendus: {evaluation.actualGuides.map(formatGuideLabel).join(" + ")}
      </p>
      <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.72 }}>
        Traits verticaux: {evaluation.actualAxisCount}/{evaluation.expectedAxisCount}
      </p>
      <div
        style={{
          display: "grid",
          gap: "0.28rem",
          padding: "0.55rem 0.65rem",
          borderRadius: "var(--radius)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.62 }}>
          GlyphMeasurementProfile
        </p>
        <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.82 }}>
          Confidence: {profile.confidence} · Witnesses: {profile.witnessRoles.join(" + ") || "none"}
        </p>
        <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.82 }}>
          Ink bounds: {profile.inkBounds.width.toFixed(1)} × {profile.inkBounds.height.toFixed(1)}px · Advance:{" "}
          {profile.advanceWidthPx.toFixed(1)}px
        </p>
        <dl style={{ margin: 0, display: "grid", gap: "0.2rem" }}>
          {metricEntries.map(([key, metric]) => {
            if (!metric) return null;

            return (
              <div
                key={`${label}-${key}-metric`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "0.6rem",
                  alignItems: "baseline",
                }}
              >
                <dt style={{ margin: 0, fontSize: "0.76rem", opacity: 0.68 }}>{key}</dt>
                <dd style={{ margin: 0, fontSize: "0.76rem", opacity: 0.9, textAlign: "right" }}>
                  {metric.value.toFixed(1)}px · {metric.status} · {metric.source}
                </dd>
              </div>
            );
          })}
        </dl>
        {profile.overshoots.length ? (
          <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: "0.78rem", opacity: 0.8 }}>
            {profile.overshoots.map((overshoot, index) => (
              <li key={`${label}-overshoot-${overshoot.direction}-${index}`}>
                {overshoot.relatedMetric}: {overshoot.direction} {overshoot.amountPx.toFixed(1)}px ·{" "}
                {overshoot.expected ? "expected" : "unexpected"}
              </li>
            ))}
          </ul>
        ) : null}
        {profile.ambiguityFlags.length ? (
          <p style={{ margin: 0, fontSize: "0.76rem", opacity: 0.7 }}>
            Flags: {profile.ambiguityFlags.join(", ")}
          </p>
        ) : null}
      </div>
      {Object.keys(evaluation.geometry).length ? (
        <dl
          style={{
            margin: 0,
            display: "grid",
            gap: "0.28rem",
            padding: "0.55rem 0.65rem",
            borderRadius: "var(--radius)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          {Object.entries(evaluation.geometry).map(([key, value]) => {
            if (!value) return null;

            return (
              <div
                key={`${label}-${key}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "0.6rem",
                  alignItems: "baseline",
                }}
              >
                <dt style={{ margin: 0, fontSize: "0.78rem", opacity: 0.72 }}>{formatGuideLabel(key as Parameters<typeof formatGuideLabel>[0])}</dt>
                <dd style={{ margin: 0, fontSize: "0.78rem", opacity: 0.88, textAlign: "right" }}>
                  {formatDelta(value.deltaPx)} / {value.tolerancePx.toFixed(1)}px · {value.mode}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      {evaluation.issues.length ? (
        <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: "0.8rem", color: "rgba(255,172,172,0.92)" }}>
          {evaluation.issues.map((issue) => (
            <li key={`${label}-${issue}`}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function GlyphAuditCardReady({ glyph, expectation }: { glyph: string; expectation: GlyphAuditExpectation }) {
  const leftProbe = useAuditProbe(LEFT.family, glyph, expectation);
  const rightProbe = useAuditProbe(RIGHT.family, glyph, expectation);

  const overallPass = useMemo(() => {
    return leftProbe.status === "ready" && rightProbe.status === "ready" && leftProbe.evaluation.pass && rightProbe.evaluation.pass;
  }, [leftProbe, rightProbe]);

  return (
    <article
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "var(--radius)",
        padding: "1rem",
        background: "rgba(255,255,255,0.02)",
        display: "grid",
        gap: "0.9rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexWrap: "wrap" }}>
            <p
              style={{
                margin: 0,
                fontSize: "1.25rem",
                fontWeight: 700,
              }}
            >
              {glyph}
            </p>
            <span className={`metrics-validator-badge ${overallPass ? "is-pass" : "is-fail"}`}>
              {overallPass ? "stable" : "check"}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.78 }}>
            Attendu: {expectation.requiredGuides.map(formatGuideLabel).join(" + ")}
          </p>
          <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.68 }}>
            Overshoot: {expectation.overshoot} · Priorite: {expectation.priority} · Source:{" "}
            {expectation.workbookSource === "CONTROLE LETTRES" ? `CONTROLE LETTRES #${expectation.workbookRow}` : "extension manuelle"}
          </p>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: "0.88rem",
          lineHeight: 1.45,
          opacity: 0.78,
        }}
      >
        {expectation.note}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "0.7rem",
        }}
      >
        <AuditPaneStatus label={LEFT.label} probe={leftProbe} />
        <AuditPaneStatus label={RIGHT.label} probe={rightProbe} />
      </div>

      <div className="compare-stage compare-stage--measure compare-stage--sample-glyph">
        <MeasuredGlyphSplit
          glyph={glyph}
          feature="audit"
          guideLabel="audit"
          left={LEFT}
          right={RIGHT}
          showMeasurements
        />
      </div>
    </article>
  );
}

function GlyphAuditCard({ glyph }: { glyph: string }) {
  const expectation = getGlyphAuditExpectation(glyph);
  if (!expectation) {
    return null;
  }

  return <GlyphAuditCardReady glyph={glyph} expectation={expectation} />;
}

export default function GlyphAuditMatrix() {
  return (
    <div
      style={{
        display: "grid",
        gap: "2rem",
      }}
    >
      {GLYPH_AUDIT_GROUPS.map((group) => (
        <section
          key={group.id}
          style={{
            display: "grid",
            gap: "1rem",
          }}
        >
          <header style={{ display: "grid", gap: "0.3rem" }}>
            <p
              style={{
                margin: 0,
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                opacity: 0.7,
              }}
            >
              {group.title}
            </p>
            <p
              style={{
                margin: 0,
                maxWidth: "78ch",
                fontSize: "0.95rem",
                lineHeight: 1.5,
                opacity: 0.78,
              }}
            >
              {group.note}
            </p>
          </header>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(560px, 1fr))",
              gap: "1rem",
            }}
          >
            {group.glyphs.map((glyph) => (
              <GlyphAuditCard key={`${group.id}-${glyph}`} glyph={glyph} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
