import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, isDeveloper, getRollenLabel } from '@/lib/roles';
import {
  LayoutDashboard, Users, Shirt, Calendar, Briefcase,
  Award, CreditCard, Bell, Menu, X, ChevronRight,
  LogOut, User, MoreHorizontal, Shield, ClipboardList,
  AlertTriangle, Lock, Database, CheckSquare, Package
} from 'lucide-react';
import { useState, useEffect } from 'react';
import SecureSearch from './SecureSearch';

const sidebarNavItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { path: '/vorstand', label: 'Führungs-Dashboard', icon: ClipboardList, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'] },
  { path: '/mitglieder', label: 'Mitglieder', icon: Users, roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter', 'admin'] },
  { path: '/kalender', label: 'Veranstaltungen', icon: Calendar, roles: null },
  { path: '/ausfahrten', label: 'Ausfahrten', icon: Bus, roles: null },
  { path: '/arbeitsdienste', label: 'Arbeitsdienste', icon: Briefcase, roles: null },
  { path: '/ehrungen', label: 'Ehrungen', icon: Award, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
  { path: '/beitraege', label: 'Beiträge', icon: CreditCard, roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'] },
  { path: '/haes', label: 'Häs', icon: Shirt, roles: null },
  { path: '/sparten', label: 'Sparten & Gruppen', icon: Users, roles: null },
  { path: '/vereine', label: 'Vereine & Zünfte', icon: Users, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
  { path: '/datenqualitaet', label: 'Datenqualität', icon: AlertTriangle, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
  { path: '/ausschuss', label: 'Ausschussbereich', icon: Lock, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'] },
  { path: '/todos', label: 'Aufgaben', icon: CheckSquare, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'] },
  { path: '/inventar', label: 'Inventar & Verleih', icon: Package, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
  { path: '/berechtigungen', label: 'Berechtigungen', icon: Shield, roles: ['admin', 'vorstand', 'stellv_vorstand'] },
  { path: '/daten-import', label: 'Daten-Import', icon: Database, roles: ['admin'] },
  { path: '/familie', label: 'Familie', icon: Users, roles: ['elternkonto'] },
];

const bottomNavItems = [
  { path: '/', label: 'Start', icon: LayoutDashboard },
  { path: '/kalender', label: 'Termine', icon: Calendar },
  { path: '/ausfahrten', label: 'Ausfahrten', icon: Bus },
  { path: '/arbeitsdienste', label: 'Dienste', icon: Briefcase },
  { path: '/profil', label: 'Profil', icon: User },
  { path: '/mehr', label: 'Mehr', icon: MoreHorizontal },
];

const TAB_ROOTS = ['/', '/kalender', '/arbeitsdienste', '/profil', '/mehr'];

function canSee(item, user) {
  if (!item.roles) return true;
  if (isDeveloper(user)) return true;
  if (item.roles.includes(user?.role)) return true;
  const zusatz = user?._mitglied?.zusatz_berechtigungen || [];
  if (item.path === '/inventar' && zusatz.includes('inventar')) return true;
  if (item.path === '/ausschuss' && zusatz.includes('ausschuss')) return true;
  if (item.path === '/todos' && zusatz.includes('todos')) return true;
  return false;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState(0);
  const admin = isAdmin(user);

  const [tabHistory, setTabHistory] = useState(() =>
    Object.fromEntries(TAB_ROOTS.map(r => [r, r]))
  );

  const currentTabRoot = TAB_ROOTS.find(root =>
    root === '/' ? location.pathname === '/' : location.pathname.startsWith(root)
  );
  if (currentTabRoot && tabHistory[currentTabRoot] !== location.pathname + location.search) {
    setTabHistory(prev => ({ ...prev, [currentTabRoot]: location.pathname + location.search }));
  }

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    try {
      let notifs;
      if (admin) {
        notifs = await base44.entities.Benachrichtigung.filter({ gelesen: false });
      } else {
        const me = await base44.auth.me();
        const myM = await base44.entities.Mitglied.filter({ user_id: me?.id });
        notifs = myM[0]
          ? await base44.entities.Benachrichtigung.filter({ mitglied_id: myM[0].id, gelesen: false })
          : [];
      }
      setNotifications(notifs.length);
    } catch (e) {}
  };

  const handleLogout = () => base44.auth.logout('/');

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const visibleSidebarItems = sidebarNavItems.filter(item => canSee(item, user));

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 fixed h-full z-30"
             style={{ background: 'hsl(var(--sidebar-background))' }}>

        {/* Logo-Bereich – roter Akzentbalken */}
        <div className="relative px-5 py-5 border-b border-sidebar-border overflow-hidden">
          {/* roter Streifen links */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <div className="flex items-center gap-3 pl-2">
            <div className="w-11 h-11 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
              <span className="text-white text-xl">🎭</span>
            </div>
            <div className="min-w-0">
              <p className="font-oswald font-semibold text-sidebar-foreground text-base leading-tight tracking-wide uppercase">
                Narrenzunft
              </p>
              <p className="text-[11px] text-primary font-medium tracking-widest uppercase">Frommern</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
          {visibleSidebarItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 group ${
                  active
                    ? 'bg-primary text-white font-semibold shadow-sm shadow-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon size={17} className="shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-sm truncate">{item.label}</span>
                {active && <ChevronRight size={13} className="ml-auto opacity-70" />}
              </Link>
            );
          })}
        </nav>

        {/* User-Bereich */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
          <Link to="/profil"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-sidebar-accent transition-colors group">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{user?.full_name || 'Benutzer'}</p>
              <p className="text-[11px] text-primary font-medium">{getRollenLabel(user?.role)}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs font-medium"
          >
            <LogOut size={13} /> Abmelden
          </button>
        </div>
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-72 h-full z-50 shadow-2xl"
                 style={{ background: 'hsl(var(--sidebar-background))' }}>

            <div className="relative flex items-center justify-between px-4 py-4 border-b border-sidebar-border overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              <div className="flex items-center gap-3 pl-2">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/30">
                  <span className="text-white">🎭</span>
                </div>
                <div>
                  <p className="font-oswald font-semibold text-sidebar-foreground text-sm uppercase tracking-wide">Narrenzunft</p>
                  <p className="text-[10px] text-primary uppercase tracking-widest">Frommern</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
              {visibleSidebarItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-md transition-all ${
                      active
                        ? 'bg-primary text-white font-semibold'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="px-2 py-3 border-t border-sidebar-border">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-md w-full text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={18} />
                <span className="font-medium">Abmelden</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">

        {/* Top Bar */}
        <header className="sticky top-0 z-20 border-b border-border px-4 lg:px-6 py-3 flex items-center gap-3"
                style={{
                  background: 'hsl(var(--background) / 0.9)',
                  backdropFilter: 'blur(12px)',
                  paddingTop: 'max(0.75rem, env(safe-area-inset-top))'
                }}>
          {/* roter Strich unten am Header */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-primary/30" />

          <button
            className="lg:hidden p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="hidden md:flex flex-1 max-w-sm">
            <SecureSearch />
          </div>

          <div className="flex md:hidden flex-1 items-center gap-2">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <span className="font-oswald font-semibold text-foreground text-base uppercase tracking-wide">
              Narrenzunft
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Link to="/benachrichtigungen"
              className="relative p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              <Bell size={18} />
              {notifications > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full shadow-sm shadow-primary/50" />
              )}
            </Link>
            <Link to="/profil"
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm hover:bg-primary/80 transition-colors shadow-sm shadow-primary/30">
              {user?.full_name?.[0] || 'U'}
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 pb-20 lg:pb-6">
          <Outlet />
        </main>

        {/* ── Bottom Navigation (Mobile) ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-border pb-safe"
             style={{ background: 'hsl(var(--sidebar-background))' }}>
          {/* roter Akzentstreifen oben */}
          <div className="absolute top-0 left-0 right-0 h-px bg-primary/50" />
          <div className="flex items-center justify-around px-1 py-1">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const active = item.path === '/mehr' ? isActive('/mehr') : isActive(item.path);
              const destination = tabHistory[item.path] || item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(destination)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all min-w-[52px] ${
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon size={21} strokeWidth={active ? 2.4 : 1.7} />
                  <span className={`text-[10px] font-medium leading-none mt-0.5 ${active ? 'text-primary' : ''}`}>
                    {item.label}
                  </span>
                  {active && <div className="w-4 h-0.5 rounded-full bg-primary mt-0.5" />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
