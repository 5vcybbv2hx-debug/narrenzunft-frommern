import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Guard, ROLLEN_VORSTAND, ROLLEN_FUEHRUNG, ROLLEN_FINANZEN, ROLLEN_MITGLIEDER } from '@/components/RouteGuard';

// Layout
import Layout from './components/Layout';

// Pages
import Dashboard from './pages/Dashboard';
import Mitglieder from './pages/Mitglieder';
import MitgliedDetail from './pages/MitgliedDetail';
import Veranstaltungen from './pages/Veranstaltungen';
import VeranstaltungDetail from './pages/VeranstaltungDetail';
import VeranstaltungNeu from './pages/VeranstaltungNeu';
import Arbeitsdienste from './pages/Arbeitsdienste';
import ArbeitsdienstNeu from './pages/ArbeitsdienstNeu';
import Ehrungen from './pages/Ehrungen.jsx';
import Beitraege from './pages/Beitraege';
import Haes from './pages/Haes';
import HaesDetail from './pages/HaesDetail';
import Umzuege from './pages/Umzuege';
import Profil from './pages/Profil';
import Benachrichtigungen from './pages/Benachrichtigungen';
import Suche from './pages/Suche';
import Mehr from './pages/Mehr';
import VorstandDashboard from './pages/VorstandDashboard';
import Datenqualitaet from './pages/Datenqualitaet';
import Kalender from './pages/Kalender';
import Ausschuss from './pages/Ausschuss';
import BusfahrerInfo from './pages/BusfahrerInfo';
import SitzungDetail from './pages/SitzungDetail';
import FamilienDashboard from './pages/FamilienDashboard';
import Vereine from './pages/Vereine';
import Sparten from './pages/Sparten';
import Ausfahrten from './pages/Ausfahrten';
import AusfahrtDetail from './pages/AusfahrtDetail';
import AusfahrtNeu from './pages/AusfahrtNeu';
import AusfahrtScanner from './pages/AusfahrtScanner';
import Todos from './pages/Todos';
import Inventar from './pages/Inventar';
import Berechtigungen from './pages/Berechtigungen';
import Nachrichten from './pages/Nachrichten';
import MitgliedsantragFormular from './pages/MitgliedsantragFormular';
import Mitgliedsantraege from './pages/Mitgliedsantraege';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-5">
          {/* Logo */}
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center shadow-xl shadow-primary/30">
            <span className="text-3xl">🎭</span>
          </div>
          {/* Vereinsname */}
          <div className="text-center">
            <p className="font-oswald font-semibold text-foreground text-xl uppercase tracking-widest">Narrenzunft</p>
            <p className="text-primary text-xs font-semibold uppercase tracking-[0.3em] mt-0.5">Frommern</p>
          </div>
          {/* Roter Spinner */}
          <div className="w-8 h-8 border-[3px] border-border border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-xs tracking-wide">Wird geladen…</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={location.pathname}
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeInOut' }}
      style={{ display: 'contents' }}
    >
    <Routes location={location}>
      <Route element={<Layout />}>
        {/* ── Öffentlich (alle authentifizierten User) ── */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/kalender" element={<Kalender />} />
        <Route path="/veranstaltungen" element={<Veranstaltungen />} />
        <Route path="/veranstaltungen/:id" element={<VeranstaltungDetail />} />
        <Route path="/ausfahrten" element={<Ausfahrten />} />
        <Route path="/ausfahrten/:id" element={<AusfahrtDetail />} />
        <Route path="/arbeitsdienste" element={<Arbeitsdienste />} />
        <Route path="/haes" element={<Haes />} />
        <Route path="/haes/:id" element={<HaesDetail />} />
        <Route path="/sparten" element={<Sparten />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="/benachrichtigungen" element={<Benachrichtigungen />} />
        <Route path="/suche" element={<Suche />} />
        <Route path="/mehr" element={<Mehr />} />
        <Route path="/nachrichten" element={<Nachrichten />} />

        {/* ── Mitglieder: Detail frei (Seite prüft selbst), Liste nur für Führung ── */}
        <Route path="/mitglieder" element={
          <Guard roles={ROLLEN_MITGLIEDER}><Mitglieder /></Guard>
        } />
        <Route path="/mitglieder/:id" element={<MitgliedDetail />} />

        {/* ── Nur Führung (Vorstand + Stv. + Spartenleiter + Admin) ── */}
        <Route path="/vorstand" element={
          <Guard roles={ROLLEN_FUEHRUNG}><VorstandDashboard /></Guard>
        } />
        <Route path="/veranstaltungen/neu" element={
          <Guard roles={ROLLEN_FUEHRUNG}><VeranstaltungNeu /></Guard>
        } />
        <Route path="/arbeitsdienste/neu" element={
          <Guard roles={ROLLEN_FUEHRUNG}><ArbeitsdienstNeu /></Guard>
        } />
        <Route path="/ausfahrten/neu" element={
          <Guard roles={ROLLEN_FUEHRUNG}><AusfahrtNeu /></Guard>
        } />
        <Route path="/ausfahrten/:id/scanner" element={
          <Guard roles={ROLLEN_FUEHRUNG}><AusfahrtScanner /></Guard>
        } />

        {/* ── Ausschuss (Rollen + Zusatz-Berechtigung 'ausschuss') ── */}
        <Route path="/ausschuss" element={
          <Guard roles={ROLLEN_FUEHRUNG} zusatz={['ausschuss']}><Ausschuss /></Guard>
        } />
        <Route path="/ausschuss/sitzung/:id" element={
          <Guard roles={ROLLEN_FUEHRUNG} zusatz={['ausschuss']}><SitzungDetail /></Guard>
        } />

        {/* ── Todos (Rollen + Zusatz-Berechtigung 'todos') ── */}
        <Route path="/todos" element={
          <Guard roles={ROLLEN_FUEHRUNG} zusatz={['todos']}><Todos /></Guard>
        } />

        {/* ── Nur Vorstand + Admin ── */}
        <Route path="/ehrungen" element={
          <Guard roles={ROLLEN_VORSTAND}><Ehrungen /></Guard>
        } />
        <Route path="/vereine" element={
          <Guard roles={ROLLEN_VORSTAND}><Vereine /></Guard>
        } />
        <Route path="/datenqualitaet" element={
          <Guard roles={ROLLEN_VORSTAND}><Datenqualitaet /></Guard>
        } />
        <Route path="/berechtigungen" element={
          <Guard roles={ROLLEN_VORSTAND}><Berechtigungen /></Guard>
        } />
        <Route path="/mitgliedsantraege" element={
          <Guard roles={ROLLEN_VORSTAND}><Mitgliedsantraege /></Guard>
        } />

        {/* ── Finanzen (Vorstand + Kassierer + Admin) ── */}
        <Route path="/beitraege" element={
          <Guard roles={ROLLEN_FINANZEN}><Beitraege /></Guard>
        } />

        {/* ── Inventar (Rollen + Zusatz-Berechtigung 'inventar') ── */}
        <Route path="/inventar" element={
          <Guard roles={ROLLEN_VORSTAND} zusatz={['inventar']}><Inventar /></Guard>
        } />

        {/* ── Elternkonto ── */}
        <Route path="/familie" element={
          <Guard roles={['elternkonto']}><FamilienDashboard /></Guard>
        } />
      </Route>
      <Route path="/mitgliedsantrag" element={<MitgliedsantragFormular />} />
      <Route path="/busfahrer/:token" element={<BusfahrerInfo />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </motion.div>
    </AnimatePresence>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
