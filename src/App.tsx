import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { MapPage } from './pages/MapPage';
import { JourneysPage } from './pages/JourneysPage';
import { StatsPage } from './pages/StatsPage';
import { JourneyDetailPage } from './pages/JourneyDetailPage';

/** The map page owns the full viewport; the others scroll normally. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  const isMap = pathname === '/';

  return (
    <div className="flex min-h-screen flex-col bg-surface font-body-md text-on-surface">
      <ScrollToTop />
      <Navbar />
      <main className={`w-full flex-1 pt-20 ${isMap ? 'overflow-hidden' : ''}`}>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/journeys" element={<JourneysPage />} />
          <Route path="/journeys/:slug" element={<JourneyDetailPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="*" element={<JourneysPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
