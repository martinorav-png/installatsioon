import { lazy, Suspense } from 'react';
import { CrtScreen } from './components/CrtScreen';
import { DappledLight } from './components/DappledLight';

const JellyInstallation = lazy(() =>
  import('./components/JellyInstallation').then(({ JellyInstallation: Component }) => ({ default: Component })),
);

export function App() {
  if (window.location.pathname.replace(/\/$/, '') !== '/installation') {
    return (
      <Suspense fallback={<main style={{ position: 'fixed', inset: 0, background: '#ffffff' }} />}>
        <JellyInstallation />
      </Suspense>
    );
  }

  return (
    <main className="installation" aria-labelledby="artwork-title">
      <CrtScreen>
        <DappledLight />
        <h1 id="artwork-title" className="sr-only">KIRJUTAMATA</h1>
        <span className="cursor" aria-hidden="true" />
      </CrtScreen>
    </main>
  );
}
