import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AtlasProvider } from './hooks/useAtlas';
import { SupabaseProvider } from './hooks/useSupabase';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <SupabaseProvider>
        <AtlasProvider>
          <App />
        </AtlasProvider>
      </SupabaseProvider>
    </BrowserRouter>
  </StrictMode>,
);
