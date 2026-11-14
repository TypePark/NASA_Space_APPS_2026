import Icon from "./Icon";

interface TourBarProps {
  part: string;
  step: number;
  count: number;
  text: string;
  /** Shown once a "your turn" step has been completed. */
  doneText: string | null;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
  onExit: () => void;
}

/** The guided tour's caption, fixed to the bottom of the screen. */
export default function TourBar({ part, step, count, text, doneText, nextLabel, onBack, onNext, onExit }: TourBarProps) {
  return (
    <div role="status" className="tour-bar">
      <div className="tour-text">
        <Icon name="play" size={24} />
        <div className="stack-4">
          <span className="tour-label">
            {part} · Step {step} of {count}
          </span>
          {doneText === null ? (
            <span>{text}</span>
          ) : (
            <span>
              <span className="tour-done">
                <Icon name="check" size={18} strokeWidth={2} />
                Done.
              </span>{" "}
              {doneText}
            </span>
          )}
        </div>
      </div>
      <div className="row row-tight tour-buttons">
        <button type="button" className="btn tour-back" disabled={step <= 1} onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn tour-next" onClick={onNext}>
          {nextLabel}
        </button>
        <button type="button" className="icon-btn tour-exit" aria-label="End the tour" onClick={onExit}>
          <Icon name="x" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
