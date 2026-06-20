"use client";

import { useEffect, useState } from "react";
import type { WordMeasurementProfile } from "@/lib/typography/measurement-profile-contracts";
import MeasuredWordSplit from "@/components/typography/MeasuredWordSplit";
import { WORD_AUDIT_EXPECTATIONS, evaluateWordAudit, type WordAuditEvaluation } from "@/lib/dev/typography/word-audit-spec";
import { buildWordMeasurementProfile } from "@/lib/dev/typography/word-measurement-profile-adapter";
import { buildWordOverlayModel, measureWordOverlay } from "@/lib/typography/word-overlay-engine";

type AuditProbeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; evaluation: WordAuditEvaluation; profile: WordMeasurementProfile };

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

function formatSigned(value: number) {
  const rounded = value.toFixed(1);
  return `${value > 0 ? "+" : ""}${rounded}px`;
}

function useWordAuditProbe(
  family: string,
  word: string,
  feature: "xHeight" | "aperture" | "terminals" | "contrast"
): AuditProbeState {
  const [state, setState] = useState<AuditProbeState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const metrics = await measureWordOverlay({
          family,
          word,
          width: AUDIT_STAGE_SIZE.width,
          height: AUDIT_STAGE_SIZE.height,
        });
        const model = buildWordOverlayModel({
          word,
          metrics,
          feature,
        });
        const expectation = WORD_AUDIT_EXPECTATIONS.find((entry) => entry.word === word && entry.feature === feature);

        if (!expectation) {
          throw new Error(`Missing word audit expectation for ${feature}/${word}`);
        }

        const evaluation = evaluateWordAudit(expectation, model, metrics);

        if (!cancelled) {
          setState({
            status: "ready",
            evaluation,
            profile: buildWordMeasurementProfile({
              fontId: family,
              renderContextId: `word-audit:${family}:${feature}:${word}`,
              word,
              metrics,
              model,
              auditEvaluation: evaluation,
            }),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Word audit probe failed",
          });
        }
      }
    };

    setState({ status: "loading" });
    run();

    return () => {
      cancelled = true;
    };
  }, [family, feature, word]);

  return state;
}

function AuditPaneStatus({ label, probe }: { label: string; probe: AuditProbeState }) {
  if (probe.status === "loading") {
    return (
      <div style={{ display: "grid", gap: "0.35rem", padding: "0.75rem 0.85rem", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <strong style={{ fontSize: "0.82rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</strong>
          <span className="metrics-validator-badge">loading</span>
        </div>
      </div>
    );
  }

  if (probe.status === "error") {
    return (
      <div style={{ display: "grid", gap: "0.35rem", padding: "0.75rem 0.85rem", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <strong style={{ fontSize: "0.82rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</strong>
          <span className="metrics-validator-badge is-fail">error</span>
        </div>
        <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.8 }}>{probe.message}</p>
      </div>
    );
  }

  const { evaluation, profile } = probe;
  const xGuideDebug = evaluation.debug.guidePlacements.find((entry) => entry.key === "x");
  const metricEntries = Object.entries(profile.metrics);

  return (
    <div style={{ display: "grid", gap: "0.35rem", padding: "0.75rem 0.85rem", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <strong style={{ fontSize: "0.82rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</strong>
        <span className={`metrics-validator-badge ${evaluation.pass ? "is-pass" : "is-fail"}`}>{evaluation.pass ? "pass" : "check"}</span>
      </div>
      <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.8 }}>
        Structure: {evaluation.structuralPass ? "pass" : "fail"} · Geometry: {evaluation.geometryPass ? "pass" : "fail"} · Composition: {evaluation.compositionPass ? "pass" : "fail"}
      </p>
      <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.72 }}>
        Guides: {evaluation.actualGuides.join(" + ")} · Chips: {evaluation.actualChips.join(" + ")}
      </p>
      <div style={{ display: "grid", gap: "0.28rem", padding: "0.55rem 0.65rem", borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}>
        <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.62 }}>
          WordMeasurementProfile
        </p>
        <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.82 }}>
          Confidence: {profile.confidence} · Features: x {profile.featureSupport.xHeight} / aperture {profile.featureSupport.aperture} / terminals{" "}
          {profile.featureSupport.terminals} / contrast {profile.featureSupport.contrast}
        </p>
        <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.82 }}>
          Bounds: {profile.globalBounds.width.toFixed(1)} × {profile.globalBounds.height.toFixed(1)}px · Letters: {profile.letters.length}
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
        {Object.keys(profile.witnesses).length ? (
          <p style={{ margin: 0, fontSize: "0.76rem", opacity: 0.72 }}>
            Witnesses:{" "}
            {Object.entries(profile.witnesses)
              .map(([role, set]) => `${role}(${set?.chosenGlyphs.join("") || "-"})`)
              .join(" · ")}
          </p>
        ) : null}
        {profile.overshoots.length ? (
          <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: "0.78rem", opacity: 0.8 }}>
            {profile.overshoots.map((overshoot, index) => (
              <li key={`${label}-overshoot-${overshoot.direction}-${index}`}>
                {overshoot.glyph}: {overshoot.relatedMetric} {overshoot.direction} {overshoot.amountPx.toFixed(1)}px
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
      <dl style={{ margin: 0, display: "grid", gap: "0.28rem", padding: "0.55rem 0.65rem", borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "0.6rem", alignItems: "baseline" }}>
          <dt style={{ margin: 0, fontSize: "0.78rem", opacity: 0.72 }}>left / right gap</dt>
          <dd style={{ margin: 0, fontSize: "0.78rem", opacity: 0.88 }}>{formatSigned(evaluation.composition.leftGap)} / {formatSigned(evaluation.composition.rightGap)}</dd>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "0.6rem", alignItems: "baseline" }}>
          <dt style={{ margin: 0, fontSize: "0.78rem", opacity: 0.72 }}>top / bottom gap</dt>
          <dd style={{ margin: 0, fontSize: "0.78rem", opacity: 0.88 }}>{formatSigned(evaluation.composition.topGap)} / {formatSigned(evaluation.composition.bottomGap)}</dd>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "0.6rem", alignItems: "baseline" }}>
          <dt style={{ margin: 0, fontSize: "0.78rem", opacity: 0.72 }}>center drift x / y</dt>
          <dd style={{ margin: 0, fontSize: "0.78rem", opacity: 0.88 }}>{formatSigned(evaluation.composition.centeredXDelta)} / {formatSigned(evaluation.composition.centeredYDelta)}</dd>
        </div>
      </dl>
      {xGuideDebug ? (
        <div style={{ display: "grid", gap: "0.35rem", padding: "0.55rem 0.65rem", borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}>
          <p style={{ margin: 0, fontSize: "0.76rem", opacity: 0.72 }}>
            x-height label: {xGuideDebug.usedFallback ? "fallback" : "candidate"} · x {xGuideDebug.chosenX.toFixed(1)} · y {xGuideDebug.chosenY.toFixed(1)}
          </p>
          <p style={{ margin: 0, fontSize: "0.74rem", opacity: 0.64 }}>
            {xGuideDebug.candidates
              .map((candidate, index) => `${index + 1}:${candidate.accepted ? "ok" : candidate.reason} @ ${candidate.x.toFixed(1)},${candidate.y.toFixed(1)}`)
              .join(" · ")}
          </p>
        </div>
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

function WordAuditCard({
  feature,
  title,
  word,
  note,
}: {
  feature: "xHeight" | "aperture" | "terminals" | "contrast";
  title: string;
  word: string;
  note: string;
}) {
  const leftProbe = useWordAuditProbe(LEFT.family, word, feature);
  const rightProbe = useWordAuditProbe(RIGHT.family, word, feature);

  const overallPass = leftProbe.status === "ready" && rightProbe.status === "ready" && leftProbe.evaluation.pass && rightProbe.evaluation.pass;

  return (
    <article style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "1rem", background: "rgba(255,255,255,0.02)", display: "grid", gap: "0.9rem" }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{title}</p>
          <span className={`metrics-validator-badge ${overallPass ? "is-pass" : "is-fail"}`}>{overallPass ? "stable" : "check"}</span>
        </div>
        <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.78 }}>
          Feature: {feature} · Word: <strong>{word}</strong>
        </p>
        <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.68 }}>{note}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.7rem" }}>
        <AuditPaneStatus label={LEFT.label} probe={leftProbe} />
        <AuditPaneStatus label={RIGHT.label} probe={rightProbe} />
      </div>

      <div className="compare-stage compare-stage--measure compare-stage--sample-word">
        <MeasuredWordSplit word={word} feature={feature} left={LEFT} right={RIGHT} showMeasurements />
      </div>
    </article>
  );
}

export default function WordAuditMatrix() {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {WORD_AUDIT_EXPECTATIONS.map((expectation) => (
        <WordAuditCard
          key={expectation.id}
          feature={expectation.feature}
          title={expectation.title}
          word={expectation.word}
          note={expectation.note}
        />
      ))}
    </div>
  );
}
