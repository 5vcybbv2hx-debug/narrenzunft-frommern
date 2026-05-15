import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, isDeveloper, kannMitgliederlisteSehn, getRollenLabel } from '@/lib/roles';
import {
  LayoutDashboard, Users, Shirt, Calendar, Briefcase,
  Award, CreditCard, Bell, Menu, X, ChevronRight,
  LogOut, User, MoreHorizontal, Shield, ClipboardList, AlertTriangle, Lock, Database, CheckSquare, Package
} from 'lucide-react';
import { useState, useEffect } from 'react';
import SecureSearch from './SecureSearch';

// Desktop Sidebar - alle Links
const sidebarNavItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { path: '/vorstand', label: 'Führungs-Dashboard', icon: ClipboardList, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'] },
  { path: '/mitglieder', label: 'Mitglieder', icon: Users, roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter', 'admin'] },
  { path: '/kalender', label: 'Termine', icon: Calendar, roles: null },
  { path: '/arbeitsdienste', label: 'Arbeitsdienste', icon: Briefcase, roles: null },

  { path: '/ehrungen', label: 'Ehrungen', icon: Award, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
  { path: '/beitraege', label: 'Beiträge', icon: CreditCard, roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'] },
  { path: '/haes', label: 'Häs', icon: Shirt, roles: null },
  { path: '/sparten', label: 'Sparten & Gruppen', icon: Users, roles: null },
  { path: '/vereine', label: 'Vereine & Zünfte', icon: Users, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
  { path: '/datenqualitaet', label: 'Datenqualität', icon: AlertTriangle, roles: ['vorstand', 'stellv_vorstand', 'admin'] },

  { path: '/ausschuss', label: 'Ausschussbereich', icon: Lock, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
  { path: '/todos', label: 'Aufgaben', icon: CheckSquare, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
  { path: '/inventar', label: 'Inventar & Verleih', icon: Package, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
  { path: '/berechtigungen', label: 'Berechtigungen', icon: Shield, roles: ['admin', 'vorstand', 'stellv_vorstand'] },
  { path: '/daten-import', label: 'Daten-Import', icon: Database, roles: ['admin'] },
  { path: '/familie', label: 'Familie', icon: Users, roles: ['elternkonto'] },
];

// Mobile Bottom-Nav: Start, Umzüge, Dienste, Profil, Mehr
const bottomNavItems = [
  { path: '/', label: 'Start', icon: LayoutDashboard },
  { path: '/kalender', label: 'Termine', icon: Calendar },
  { path: '/arbeitsdienste', label: 'Dienste', icon: Briefcase },
  { path: '/profil', label: 'Profil', icon: User },
  { path: '/mehr', label: 'Mehr', icon: MoreHorizontal },
];

// Which top-level path each bottom tab "owns"
const TAB_ROOTS = ['/', '/kalender', '/arbeitsdienste', '/profil', '/mehr'];

function canSee(item, user) {
  if (!item.roles) return true;
  if (isDeveloper(user)) return true;
  if (item.roles.includes(user?.role)) return true;
  // Zusatz-Berechtigungen: Mitglieder mit 'inventar' sehen Inventar-Link
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

  // Preserve last-visited path per bottom tab
  const [tabHistory, setTabHistory] = useState(() =>
    Object.fromEntries(TAB_ROOTS.map(r => [r, r]))
  );

  // Update history whenever location changes
  const currentTabRoot = TAB_ROOTS.find(root =>
    root === '/' ? location.pathname === '/' : location.pathname.startsWith(root)
  );
  if (currentTabRoot && tabHistory[currentTabRoot] !== location.pathname + location.search) {
    setTabHistory(prev => ({ ...prev, [currentTabRoot]: location.pathname + location.search }));
  }

  useEffect(() => {
    loadNotifications();
  }, []);

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
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border fixed h-full z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-lg">🎭</span>
          </div>
          <div>
            <p className="font-bold text-sidebar-foreground text-sm leading-tight">Narrenzunft</p>
            <p className="text-xs text-muted-foreground">Verwaltung</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {visibleSidebarItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-200 ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          {admin && (
            <div className="flex items-center gap-1.5 px-3 mb-2">
              <Shield size={12} className="text-primary" />
              <span className="text-xs text-primary font-medium">{getRollenLabel(user?.role)}</span>
            </div>
          )}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
              {user?.full_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.full_name || 'Benutzer'}</p>
              <p className="text-xs text-muted-foreground truncate">{getRollenLabel(user?.role)}</p>
            </div>
            <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-72 bg-sidebar h-full z-50 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                  <span className="text-white font-bold">🎭</span>
                </div>
                <div>
                  <p className="font-bold text-sm text-sidebar-foreground">Narrenzunft</p>
                  <p className="text-xs text-muted-foreground">{getRollenLabel(user?.role)}</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 overflow-y-auto">
              {visibleSidebarItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-all ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="px-3 py-4 border-t border-sidebar-border">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut size={18} />
                <span className="font-medium">Abmelden</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 lg:px-6 py-3 flex items-center gap-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <button
            className="lg:hidden p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="hidden md:flex flex-1 max-w-sm">
            <SecureSearch />
          </div>
          <div className="flex md:hidden flex-1">
            <h1 className="text-sm font-semibold text-foreground">Narrenzunft</h1>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/benachrichtigungen" className="relative p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              <Bell size={18} />
              {notifications > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
              )}
            </Link>
            <Link to="/profil" className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm hover:bg-primary/30 transition-colors">
              {user?.full_name?.[0] || 'U'}
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 pb-20 lg:pb-6">
          <Outlet />
        </main>

        {/* Bottom Navigation (Mobile) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-sidebar border-t border-sidebar-border pb-safe">
          <div className="flex items-center justify-around px-1 py-1.5">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const active = item.path === '/mehr'
                ? isActive('/mehr')
                : isActive(item.path);
              const destination = tabHistory[item.path] || item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(destination)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all min-w-[56px] min-h-[44px] ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                  <span className="text-[10px] font-medium leading-none mt-0.5">{item.label}</span>
                  {active && <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}