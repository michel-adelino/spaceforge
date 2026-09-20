import { useState } from 'react';
import { AppContext, createApp } from './appState';
import { EditorScreen } from './EditorScreen';
import { Landing } from './Landing';
import { useUI } from './store';

export function App() {
  const [app] = useState(createApp);
  const screen = useUI((s) => s.screen);
  return (
    <AppContext.Provider value={app}>
      {screen === 'landing' ? <Landing /> : <EditorScreen />}
    </AppContext.Provider>
  );
}
