import React from 'react';
import Mascot from './Mascot.jsx';

export default function SectionGuide({ line: [pose, text], muted, onToggle }) {
  return (
    <div className="s-guide rv">
      <button type="button" className="s-guide-btn" onClick={onToggle}
        aria-label="Lời giới thiệu của Mascot" aria-pressed={!muted}>
        <Mascot pose={pose} size={64} />
      </button>
      <p className="s-guide-line" hidden={muted}>{text}</p>
    </div>
  );
}
