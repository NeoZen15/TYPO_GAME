import { gateCopy } from "@/content/copy";

export default function ScrollHint() {
  return (
    <div className="scroll-hint" aria-hidden="true">
      <span className="scroll-hint__label">{gateCopy.scrollLabel}</span>
      <span className="scroll-hint__mouse">
        <span className="scroll-hint__dot" />
      </span>
    </div>
  );
}
