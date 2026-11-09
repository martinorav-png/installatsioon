import { useEffect, useState } from 'react';
import type { Session } from '../engine/session';
import type { Snapshot, Special } from '../engine/types';
import './DebugPanel.css';

const events: (Special | 'shared-deletion' | 'silence')[] = [
  'unsent', 'interrupted', 'recognition', 'empty', 'premature', 'shared-deletion', 'disappearance', 'silence',
];
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export default function DebugPanel({ session, snapshot }: { session: Session; snapshot: Snapshot }) {
  const [, updateClock] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => updateClock(value => value + 1), 500);
    return () => clearInterval(timer);
  }, []);

  return <aside className="debug-panel" data-debug aria-label="Development controls">
    <header className="debug-header">
      <span>KIRJUTAMATA <small>development</small></span>
      <button onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed}>{collapsed ? 'Expand' : 'Minimize'}</button>
    </header>
    {!collapsed && <div className="debug-body">
      <dl>
        <dt>Narrative</dt><dd>{snapshot.narrative}</dd>
        <dt>Animation</dt><dd>{snapshot.state}</dd>
        <dt>Session</dt><dd>{clock(session.getDuration())}</dd>
        <dt>Inactivity</dt><dd>{clock(session.getInactivity())}</dd>
        <dt>Interactions</dt><dd>{snapshot.memory.interactions}</dd>
        <dt>Response</dt><dd>{snapshot.pending?.id ?? (snapshot.quiet ? 'prolonged quiet' : 'none')}</dd>
      </dl>
      <div className="debug-events" aria-label="Trigger an event">
        {events.map(event => <button key={event} onClick={() => session.trigger(event)}>{event.replaceAll('-', ' ')}</button>)}
      </div>
      <details>
        <summary>Pending script</summary>
        <pre>{JSON.stringify(snapshot.pending?.steps ?? [], null, 2)}</pre>
      </details>
      <details>
        <summary>Session memory ({snapshot.memory.history.length})</summary>
        <ol>{snapshot.memory.history.map((message, index) => <li key={index}><small>{message.intent}</small><p>{message.text || '(empty)'}</p></li>)}</ol>
      </details>
      {snapshot.error && <p className="debug-error" role="alert">{snapshot.error}</p>}
      <button className="debug-reset" onClick={() => session.reset()}>Reset session</button>
      <p className="debug-note">Only visible in development with ?debug=true.<br />Close this tab or remove the query to enter the artwork.</p>
    </div>}
  </aside>;
}
