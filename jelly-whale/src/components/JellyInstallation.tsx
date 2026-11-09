import { useEffect, useRef, useState } from 'react';
import type { createWhale } from '../whale/scene';
import './JellyInstallation.css';

declare global { interface Window { blueWhale?: ReturnType<typeof createWhale> } }

export function JellyInstallation() {
  const hostRef = useRef<HTMLDivElement>(null);
  const studyRef = useRef<ReturnType<typeof createWhale> | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    document.title = 'vaalatarretis';
    let study: ReturnType<typeof createWhale> | undefined;
    let cancelled = false;
    void import('../whale/scene').then(module => {
      if (cancelled) return;
      study = module.createWhale(host);
      studyRef.current = study;
      window.blueWhale = study;
      setReady(true);
    }).catch(error => {
      if (!cancelled) {
        console.warn('Interactive rendering unavailable; showing the still whale.', error);
        setUnavailable(true);
      }
    });
    return () => {
      cancelled = true;
      study?.dispose();
      studyRef.current = null;
      if (window.blueWhale === study) delete window.blueWhale;
    };
  }, []);
  useEffect(() => {studyRef.current?.setInteractive(interactive);}, [interactive]);
  return (
    <main className="jelly-installation" aria-label="Blue Whale Jelly · Material Studies No. 058">
      <div className="jelly-stage" ref={hostRef} />
      {!unavailable && <div className="mode-controls">
        <p id="whale-mode-label" className="mode-label" role="status">{interactive ? 'jiggly mode on' : 'floppy mode on'}</p>
        <button className="mode-toggle" type="button" role="switch" aria-label="Interactive mode" aria-describedby="whale-mode-label" aria-checked={interactive} disabled={!ready} onClick={() => setInteractive(value => !value)}>
          <span className="mode-toggle-track" aria-hidden="true"><span /></span>
        </button>
      </div>}
      {unavailable && <svg className="whale-fallback" viewBox="0 0 800 400" role="img" aria-label="Blue jelly whale. Interactive rendering requires WebGL2.">
        <defs>
          <linearGradient id="blue-jelly" x1="0" y1="0" x2="0.1" y2="1"><stop stopColor="#96dcff"/><stop offset="0.4" stopColor="#3a8ef0"/><stop offset="1" stopColor="#a2cbdc"/></linearGradient>
          <radialGradient id="contact"><stop stopColor="#abc4d5" stopOpacity=".3"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient>
        </defs>
        <ellipse cx="395" cy="295" rx="310" ry="34" fill="url(#contact)"/>
        <path d="M551 233Q621 225 677 178L741 143 716 201 749 226 684 217Q625 265 551 259" fill="url(#blue-jelly)"/>
        <path d="M101 193C105 127 177 111 279 115S455 151 526 199Q569 221 640 225L640 257Q550 271 472 273L197 277Q104 276 101 237Z" fill="url(#blue-jelly)"/>
        <path d="M297 251Q311 295 368 315L343 266" fill="#378bde"/>
        <ellipse cx="254" cy="213" rx="4" ry="4" fill="#163c59"/>
        <path d="M128 167Q206 129 309 146" stroke="#dff4ff" strokeWidth="12" strokeLinecap="round" fill="none" opacity=".7"/>
      </svg>}
    </main>
  );
}
