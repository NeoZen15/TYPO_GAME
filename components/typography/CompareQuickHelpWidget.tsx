"use client";

import { useState } from "react";
import type { CompareQuickQuestion } from "@/lib/typography/compare-profile-insights";

type CompareQuickHelpWidgetProps = {
  questions: CompareQuickQuestion[];
};

export default function CompareQuickHelpWidget({ questions }: CompareQuickHelpWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!questions.length) return null;

  const activeQuestion = questions[Math.min(activeIndex, questions.length - 1)] ?? questions[0];
  const groupedQuestions = questions.reduce<Record<string, Array<{ item: CompareQuickQuestion; index: number }>>>((groups, item, index) => {
    const category = item.category ?? "Guide";
    if (!groups[category]) groups[category] = [];
    groups[category]?.push({ item, index });
    return groups;
  }, {});
  const categories = Object.keys(groupedQuestions);
  const activeCategory =
    categories.find((category) =>
      groupedQuestions[category]?.some((entry) => entry.index === activeIndex)
    ) ?? categories[0] ?? "Guide";
  const visibleQuestions = groupedQuestions[activeCategory] ?? [];
  const activeQuestionPosition = visibleQuestions.findIndex((entry) => entry.index === activeIndex);

  return (
    <div className={`compare-help-widget ${isOpen ? "is-open" : ""}`}>
      {isOpen ? (
        <section id="compare-help-widget-panel" className="compare-help-widget__panel" aria-label="Quick help">
          <div className="compare-help-widget__header-lens">
            <div className="compare-help-widget__lens-mark" aria-hidden="true" />
            <div className="compare-help-widget__header-copy">
              <p className="compare-help-widget__eyebrow">Observation guide</p>
              <h2 className="compare-help-widget__title">Read this view</h2>
            </div>
            <span className="compare-help-widget__counter">
              {activeQuestionPosition + 1}/{visibleQuestions.length || 1}
            </span>
            <button
              type="button"
              className="compare-help-widget__close"
              onClick={() => setIsOpen(false)}
              aria-label="Close quick help"
            >
              ×
            </button>
          </div>

          <div className="compare-help-widget__categories" aria-label="Question categories">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`compare-help-widget__category ${category === activeCategory ? "is-active" : ""}`}
                onClick={() => {
                  const nextIndex = groupedQuestions[category]?.[0]?.index ?? 0;
                  setActiveIndex(nextIndex);
                }}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="compare-help-widget__question-strip" aria-label="Suggested questions">
            {visibleQuestions.map(({ item, index }) => (
              <button
                key={item.question}
                type="button"
                className={`compare-help-widget__question ${index === activeIndex ? "is-active" : ""}`}
                onClick={() => setActiveIndex(index)}
              >
                <span className="compare-help-widget__question-title">{item.question}</span>
                {item.preview ? <span className="compare-help-widget__question-preview">{item.preview}</span> : null}
              </button>
            ))}
          </div>

          <div className="compare-help-widget__answer">
            <div className="compare-help-widget__answer-head">
              <p className="compare-help-widget__answer-label">{activeQuestion.category ?? "Guide"}</p>
              {activeQuestion.preview ? (
                <span className="compare-help-widget__answer-meta">{activeQuestion.preview}</span>
              ) : null}
            </div>
            <h3 className="compare-help-widget__answer-title">{activeQuestion.question}</h3>
            <p className="compare-help-widget__answer-copy">{activeQuestion.answer}</p>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="compare-help-widget__toggle"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="compare-help-widget-panel"
      >
        <span className="compare-help-widget__toggle-mark" aria-hidden="true" />
        <span className="compare-help-widget__toggle-label">Guide</span>
      </button>
    </div>
  );
}
