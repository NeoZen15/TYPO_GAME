"use client";

import { useEffect } from "react";

import { isDevRuntime } from "@/lib/dev-mode";

// ---------------------------------------------------------------------------
// Internal interface audit tool. `app/layout.tsx` mounts it on every page, so
// it is the one dev component that sits in the product render tree, and it must
// stay out of production: the guard below is what `check:dev-routes` verifies.
//
// The global is named `render_ui_audit_to_text`, not `render_game_to_text`. The
// game screens own the latter and the end to end specs wait on it to know a
// round is ready. Sharing one name made the two probes interchangeable: when
// the layout hydrated first, the training spec read this audit payload, found no
// `status` field, and failed on a misleading message about DATABASE_URL.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    render_ui_audit_to_text?: () => string;
  }
}

const AUDIT_SELECTORS = [
  ".theme-switch",
  ".mode-select-shell",
  ".mode-select-grid",
  ".mode-select-card",
  ".mode-rules-shell",
  ".mode-rules-content",
  ".mode-rules-section",
  ".mode-placeholder-shell",
  ".mode-placeholder-actions",
  ".mode-placeholder-btn",
  ".game-v1-shell.game-v2-shell",
  ".game-v2-word",
  ".game-v2-options",
  ".game-v2-option",
  ".game-link",
  ".onboarding-shell",
  ".onboarding-title--speech",
  ".onboarding-option",
  ".block-1-hero",
  ".choice-panel",
  ".block-4-reel",
  ".site-mascot",
];

const collectNodeSnapshot = (selector: string) => {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) return null;

  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);

  return {
    selector,
    className: node.className,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    top: Math.round(rect.top),
    left: Math.round(rect.left),
    display: style.display,
    position: style.position,
    color: style.color,
    backgroundColor: style.backgroundColor,
    borderRadius: style.borderRadius,
    borderTop: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
    boxShadow: style.boxShadow,
    gap: style.gap,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
  };
};

// The effect lives in its own component so the exported one can bail out before
// any hook runs. An early return placed above a `useEffect` would call the hook
// conditionally, which the rules of hooks forbid.
function UiAuditProbeEffect() {
  useEffect(() => {
    const existing = window.render_ui_audit_to_text;
    if (existing) return;

    window.render_ui_audit_to_text = () => {
      const bodyStyle = window.getComputedStyle(document.body);
      const htmlStyle = window.getComputedStyle(document.documentElement);
      const main = document.querySelector("main");
      const mainRect = main?.getBoundingClientRect();

      return JSON.stringify({
        mode: "ui-audit",
        pathname: window.location.pathname,
        search: window.location.search.replace(/^\?/, ""),
        theme: document.documentElement.dataset.theme ?? null,
        body: {
          backgroundColor: bodyStyle.backgroundColor,
          color: bodyStyle.color,
          fontFamily: bodyStyle.fontFamily,
        },
        html: {
          backgroundColor: htmlStyle.backgroundColor,
          colorScheme: document.documentElement.style.colorScheme || null,
        },
        main: main
          ? {
              className: main.className,
              width: Math.round(mainRect?.width ?? 0),
              height: Math.round(mainRect?.height ?? 0),
            }
          : null,
        nodes: AUDIT_SELECTORS.map(collectNodeSnapshot).filter(Boolean),
      });
    };

    return () => {
      if (window.render_ui_audit_to_text === existing) return;
      delete window.render_ui_audit_to_text;
    };
  }, []);

  return null;
}

export default function UiDebugProbe() {
  if (!isDevRuntime()) {
    return null;
  }

  return <UiAuditProbeEffect />;
}
