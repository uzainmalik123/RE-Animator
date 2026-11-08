// A fresh start (docs/GAME_PLAN.md): a black screen with the title. The name is still open (plan §13).
export const TITLE = 'RE:Animator';

export function App() {
  return (
    <main style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#000' }}>
      <h1 style={{ margin: 0, color: '#fff', fontFamily: 'system-ui, sans-serif' }}>{TITLE}</h1>
    </main>
  );
}
