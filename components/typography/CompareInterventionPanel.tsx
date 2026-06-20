import type { CompareExperienceScript } from "@/lib/typography/compare-assistant-contracts";

type CompareInterventionPanelProps = {
  script: CompareExperienceScript;
};

export default function CompareInterventionPanel({ script }: CompareInterventionPanelProps) {
  return (
    <section className="compare-intervention-panel" aria-labelledby="compare-intervention-title">
      <div className="compare-intervention-panel__hero">
        <div className="compare-intervention-panel__hero-copy">
          <p className="compare-intervention-panel__eyebrow">{script.title}</p>
          <h2 id="compare-intervention-title" className="compare-intervention-panel__title">
            On n&apos;explique plus la paire, on l&apos;eprouve
          </h2>
          <p className="compare-intervention-panel__lead">{script.hypothesis}</p>
        </div>
        <div className="compare-intervention-panel__meta">
          <p className="compare-intervention-panel__chip">
            Lens <span>{script.lensLabel}</span>
          </p>
          <p className="compare-intervention-panel__chip">
            {script.entryLabel} <span>{script.entryValue}</span>
          </p>
          <p className="compare-intervention-panel__chip">
            {script.confidenceLabel} <span>{script.confidenceNote}</span>
          </p>
        </div>
      </div>

      <div className="compare-intervention-panel__prompt-strip" aria-label="Observation prompts">
        {script.stagePrompts.map((prompt) => (
          <p key={prompt} className="compare-intervention-panel__prompt">
            {prompt}
          </p>
        ))}
      </div>

      <div className="compare-intervention-panel__grid">
        {script.blocks.map((block) => (
          <article
            key={block.id}
            className={`compare-intervention-card compare-intervention-card--${block.kind}`}
          >
            <p className="compare-intervention-card__eyebrow">{block.eyebrow}</p>
            <h3 className="compare-intervention-card__title">{block.title}</h3>
            <p className="compare-intervention-card__body">{block.body}</p>
            {block.items?.length ? (
              <ul className="compare-intervention-card__list">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {block.meta ? <p className="compare-intervention-card__meta">{block.meta}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
