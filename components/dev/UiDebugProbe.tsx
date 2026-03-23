"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    render_game_to_text?: () => string;
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

export default function UiDebugProbe() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const existing = window.render_game_to_text;
    if (existing) return;

    window.render_game_to_text = () => {
      const bodyStyle = window.getComputedStyle(document.body);
      const htmlStyle = window.getComputedStyle(document.documentElement);
      const main = document.querySelector("main");
      const mainRect = main?.getBoundingClientRect();

      return JSON.stringify({
        mode: "ui-audit",
        pathname,
        search: searchParams.toString(),
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
      if (window.render_game_to_text === existing) return;
      delete window.render_game_to_text;
    };
  }, [pathname, searchParams]);

  return null;
}
