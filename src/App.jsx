import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

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

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl">🎭</div>
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Narrenzunft Verwaltung wird geladen...</p>
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
        <Route path="/" element={<Dashboard />} />
        <Route path="/mitglieder" element={<Mitglieder />} />
        <Route path="/mitglieder/:id" element={<MitgliedDetail />} />
        <Route path="/veranstaltungen" element={<Veranstaltungen />} />
        <Route path="/veranstaltungen/neu" element={<VeranstaltungNeu />} />
        <Route path="/veranstaltungen/:id" element={<VeranstaltungDetail />} />
        <Route path="/arbeitsdienste" element={<Arbeitsdienste />} />
        <Route path="/arbeitsdienste/neu" element={<ArbeitsdienstNeu />} />
        <Route path="/ehrungen" element={<Ehrungen />} />
        <Route path="/beitraege" element={<Beitraege />} />
        <Route path="/haes" element={<Haes />} />
        <Route path="/haes/:id" element={<HaesDetail />} />
        <Route path="/umzuege" element={<Umzuege />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="/benachrichtigungen" element={<Benachrichtigungen />} />
        <Route path="/suche" element={<Suche />} />
        <Route path="/mehr" element={<Mehr />} />
        <Route path="/vorstand" element={<VorstandDashboard />} />
        <Route path="/datenqualitaet" element={<Datenqualitaet />} />
        <Route path="/kalender" element={<Kalender />} />
        <Route path="/ausschuss" element={<Ausschuss />} />
        <Route path="/ausschuss/sitzung/:id" element={<SitzungDetail />} />
        <Route path="/familie" element={<FamilienDashboard />} />
        <Route path="/vereine" element={<Vereine />} />
        <Route path="/sparten" element={<Sparten />} />
      </Route>
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