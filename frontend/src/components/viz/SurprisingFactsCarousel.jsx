import { useState, useCallback } from 'react';
import { SURPRISING_FACTS } from '../../data/surprisingFacts';
import './SurprisingFactsCarousel.css';

export default function SurprisingFactsCarousel({ onExploreQuery, disabled }) {
  const [index, setIndex] = useState(0);
  const n = SURPRISING_FACTS.length;
  const fact = SURPRISING_FACTS[index];

  const prev = useCallback(() => setIndex((i) => (i - 1 + n) % n), [n]);
  const next = useCallback(() => setIndex((i) => (i + 1) % n), [n]);

  return (
    <section className="sfc" aria-label="Insights carousel">
      <div className="sfc-head">
        <span className="sfc-label">Insights</span>
        <div className="sfc-nav">
          <button type="button" className="sfc-arrow" onClick={prev} aria-label="Previous insight">
            ‹
          </button>
          <span className="sfc-counter" aria-live="polite">
            {index + 1} / {n}
          </span>
          <button type="button" className="sfc-arrow" onClick={next} aria-label="Next insight">
            ›
          </button>
        </div>
      </div>
      <p className="sfc-fact">{fact.fact}</p>
      <button
        type="button"
        className="sfc-explore"
        disabled={disabled}
        onClick={() => onExploreQuery?.(fact.exploreQuery)}
      >
        Explore with query
      </button>
    </section>
  );
}
