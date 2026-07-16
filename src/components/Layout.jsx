import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, isDeveloper, getRollenLabel } from '@/lib/roles';
import {
  LayoutDashboard, Users, Shirt, Calendar, Briefcase,
  Award, CreditCard, Bell, Menu, X, ChevronRight, ChevronDown,
  LogOut, User, MoreHorizontal, Shield, ClipboardList,
  AlertTriangle, Lock, CheckSquare, Package, Bus, FileText, ShoppingBag,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import SecureSearch from './SecureSearch';

// ── Akkordeon-Sektionen ──
const NAV_SECTIONS = [
  {
    id: 'aktiv',
    title: 'Aktivitäten',
    icon: Calendar,
    items: [
      { path: '/kalender',       label: 'Veranstaltungen',   icon: Calendar,    roles: null },
      { path: '/ausfahrten',     label: 'Ausfahrten',         icon: Bus,         roles: null },
      { path: '/sparten',        label: 'Sparten & Gruppen', icon: Users,       roles: null },
      { path: '/haes',           label: 'Häs',                icon: Shirt,       roles: null },
      { path: '/shop',           label: 'Shop',               icon: ShoppingBag, roles: null },
      { path: '/arbeitsdienste', label: 'Arbeitsdienste',     icon: Briefcase,   roles: null },
    ],
  },
  {
    id: 'verw',
    title: 'Verwaltung',
    icon: ClipboardList,
    roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter', 'admin'],
    items: [
      { path: '/vorstand',       label: 'Führungs-Dashboard', icon: ClipboardList, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'] },
      { path: '/mitglieder',     label: 'Mitglieder',         icon: Users,         roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter', 'admin'] },
      { path: '/beitraege',      label: 'Beiträge',           icon: CreditCard,    roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'] },
      { path: '/ehrungen',       label: 'Ehrungen',           icon: Award,         roles: ['vorstand', 'stellv_vorstand', 'admin'] },
      { path: '/shop/verwaltung', label: 'Shop-Verwaltung',   icon: ShoppingBag,   roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'] },
      { path: '/vereine',        label: 'Vereine & Zünfte',  icon: Users,         roles: ['vorstand', 'stellv_vorstand', 'admin'] },
    ],
  },
  {
    id: 'org',
    title: 'Organisation',
    icon: Shield,
    roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'],
    items: [
      { path: '/ausschuss',  label: 'Ausschussbereich', icon: Lock,        roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'], zusatz: ['ausschuss'] },
      { path: '/todos',      label: 'Aufgaben',         icon: CheckSquare,  roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'], zusatz: ['todos'] },
      { path: '/inventar',   label: 'Inventar & Verleih', icon: Package,    roles: ['vorstand', 'stellv_vorstand', 'admin'], zusatz: ['inventar'] },
    ],
  },
  {
    id: 'sys',
    title: 'System',
    icon: Shield,
    roles: ['vorstand', 'stellv_vorstand', 'admin'],
    items: [
      { path: '/datenqualitaet',  label: 'Datenqualität',     icon: AlertTriangle, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
      { path: '/berechtigungen',  label: 'Berechtigungen',    icon: Shield,        roles: ['admin', 'vorstand', 'stellv_vorstand'] },
      { path: '/mitgliedsantraege', label: 'Mitgliedsanträge', icon: FileText,    roles: ['vorstand', 'stellv_vorstand', 'admin'] },
    ],
  },
  {
    id: 'fam',
    title: 'Familie',
    icon: Users,
    roles: ['elternkonto'],
    items: [
      { path: '/familie', label: 'Familien-Dashboard', icon: Users, roles: ['elternkonto'] },
    ],
  },
];

// Direkte Einträge (immer sichtbar, nicht in Akkordeon)
const DIRECT_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: null },
];

// Mobile Bottom-Nav: 5 wichtigste direkte Ziele
const BOTTOM_NAV = [
  { path: '/',            label: 'Start',  icon: LayoutDashboard },
  { path: '/kalender',    label: 'Termine', icon: Calendar },
  { path: '/ausfahrten',  label: 'Bus',     icon: Bus },
  { path: '/arbeitsdienste', label: 'Dienste', icon: Briefcase },
  { path: '/profil',      label: 'Profil',  icon: User },
];

function canSeeItem(item, user) {
  if (!item.roles) return true;
  if (isDeveloper(user)) return true;
  if (item.roles.includes(user?.role)) return true;
  const zusatz = user?._mitglied?.zusatz_berechtigungen || [];
  if (item.zusatz && item.zusatz.some(z => zusatz.includes(z))) return true;
  return false;
}

function canSeeSection(section, user) {
  if (!section.roles) return true;
  if (isDeveloper(user)) return true;
  if (section.roles.includes(user?.role)) return true;
  return false;
}

// Finde welche Sektion zur aktuellen Route gehört
function getActiveSection(pathname) {
  for (const s of NAV_SECTIONS) {
    if (s.items.some(i => {
      if (i.path === '/') return pathname === '/';
      return pathname.startsWith(i.path);
    })) return s.id;
  }
  return null;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState(0);
  const admin = isAdmin(user);

  const activeSection = getActiveSection(location.pathname);
  const [expandedSection, setExpandedSection] = useState(activeSection || 'aktiv');

  // Wenn sich die Route ändert, die entsprechende Sektion aufklappen
  useEffect(() => {
    if (activeSection) setExpandedSection(activeSection);
  }, [activeSection]);

  const [tabHistory, setTabHistory] = useState(() =>
    Object.fromEntries(BOTTOM_NAV.map(b => [b.path, b.path]))
  );

  const currentTabRoot = BOTTOM_NAV.find(b => {
    if (b.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(b.path);
  });
  if (currentTabRoot && tabHistory[currentTabRoot.path] !== location.pathname + location.search) {
    setTabHistory(prev => ({ ...prev, [currentTabRoot.path]: location.pathname + location.search }));
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

  const visibleDirect = DIRECT_ITEMS.filter(i => canSeeItem(i, user));
  const visibleSections = NAV_SECTIONS.filter(s => canSeeSection(s, user));

  // Akkordeon umschalten — immer nur eine Sektion offen
  const toggleSection = (id) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  // ── Render Akkordeon (wird für Desktop + Mobile Overlay verwendet) ──
  const renderAccordion = (onNavigate) => (
    <nav className="flex-1 py-3 px-2 overflow-y-auto">
      {/* Direkte Einträge */}
      <div className="space-y-0.5 mb-2">
        {visibleDirect.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.path} to={item.path} onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                active ? 'bg-primary text-white font-semibold shadow-sm shadow-primary/20'
                       : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`}>
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
              <span className="text-sm truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Akkordeon-Sektionen */}
      {visibleSections.map((section) => {
        const visibleItems = section.items.filter(i => canSeeItem(i, user));
        if (visibleItems.length === 0) return null;

        const SIcon = section.icon;
        const isOpen = expandedSection === section.id;
        const hasActive = visibleItems.some(i => isActive(i.path));

        return (
          <div key={section.id} className="mb-1">
            {/* Sektions-Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                hasActive ? 'text-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
            >
              <SIcon size={16} className="shrink-0" strokeWidth={hasActive ? 2.2 : 1.8} />
              <span className={`text-sm truncate text-left flex-1 ${hasActive ? 'font-semibold' : 'font-medium'}`}>
                {section.title}
              </span>
              <ChevronDown
                size={14}
                className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${hasActive ? 'text-primary' : 'text-muted-foreground'}`}
              />
            </button>

            {/* Sub-Items (animiert) */}
            {isOpen && (
              <div className="mt-0.5 ml-4 pl-3 border-l border-sidebar-border space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link key={item.path} to={item.path} onClick={onNavigate}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-[13px] ${
                        active ? 'bg-primary/15 text-primary font-semibold'
                               : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'
                      }`}>
                      <Icon size={14} className="shrink-0" strokeWidth={active ? 2 : 1.6} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Weitere direkte Links */}
      <div className="mt-2 pt-2 border-t border-sidebar-border/50 space-y-0.5">
        <Link to="/benachrichtigungen" onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all text-[13px] ${
            isActive('/benachrichtigungen') ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'
          }`}>
          <Bell size={14} />
          <span>Benachrichtigungen</span>
          {notifications > 0 && <span className="ml-auto text-[10px] bg-primary text-white px-1.5 rounded-full font-bold">{notifications}</span>}
        </Link>
        <Link to="/suche" onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2 rounded-md transition-all text-[13px] text-muted-foreground hover:text-foreground hover:bg-sidebar-accent">
          <MoreHorizontal size={14} />
          <span>Suche & Mehr</span>
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-60 fixed h-full z-30"
             style={{ background: 'hsl(var(--sidebar-background))' }}>

        {/* Logo */}
        <div className="relative px-5 py-5 border-b border-sidebar-border overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <Link to="/" className="flex items-center gap-3 pl-2">
            <div className="w-11 h-11 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
              <span className="text-white text-xl">🎭</span>
            </div>
            <div className="min-w-0">
              <p className="font-oswald font-semibold text-sidebar-foreground text-base leading-tight tracking-wide uppercase">Narrenzunft</p>
              <p className="text-[11px] text-primary font-medium tracking-widest uppercase">Frommern</p>
            </div>
          </Link>
        </div>

        {renderAccordion()}

        {/* User-Bereich */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
          <Link to="/profil"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-sidebar-accent transition-colors">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{user?.full_name || 'Benutzer'}</p>
              <p className="text-[11px] text-primary font-medium">{getRollenLabel(user?.role)}</p>
            </div>
          </Link>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs font-medium">
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
                className="p-2 rounded-md text-muted-foreground hover:text-white hover:bg-sidebar-accent transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-3 py-2">
              <SecureSearch />
            </div>

            {renderAccordion(() => setSidebarOpen(false))}

            <div className="px-2 py-3 border-t border-sidebar-border">
              <button onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-md w-full text-red-400 hover:bg-red-500/10 transition-colors">
                <LogOut size={18} />
                <span className="font-medium">Abmelden</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">

        {/* Top Bar */}
        <header className="sticky top-0 z-20 border-b border-border px-4 lg:px-6 py-3 flex items-center gap-3"
                style={{ background: 'hsl(var(--background) / 0.9)', backdropFilter: 'blur(12px)', paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-primary/30" />

          <button className="lg:hidden p-2 rounded-md text-muted-foreground hover:bg-neutral-800 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          <div className="hidden md:flex flex-1 max-w-sm">
            <SecureSearch />
          </div>

          <div className="flex md:hidden flex-1 items-center gap-2">
            <div className="w-1 h-5 bg-primary/10 border border-primary/30 rounded-full" />
            <span className="font-oswald font-semibold text-white text-base uppercase tracking-wide">Narrenzunft</span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Link to="/benachrichtigungen"
              className="relative p-2 rounded-md text-muted-foreground hover:bg-neutral-800 hover:text-white transition-colors">
              <Bell size={18} />
              {notifications > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary/10 border border-primary/30 rounded-full shadow-sm shadow-primary/50" />
              )}
            </Link>
            <Link to="/profil"
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm hover:bg-red-700 transition-colors shadow-sm shadow-primary/30">
              {user?.full_name?.[0] || 'U'}
            </Link>
          </div>
        </header>

        <main className="flex-1 pb-20 lg:pb-6">
          <Outlet />
        </main>

        {/* ── Bottom Navigation (Mobile) ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-border pb-safe"
             style={{ background: 'hsl(var(--sidebar-background))' }}>
          <div className="absolute top-0 left-0 right-0 h-px bg-primary/50" />
          <div className="flex items-center justify-around px-1 py-1">
            {BOTTOM_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const destination = tabHistory[item.path] || item.path;
              return (
                <button key={item.path} onClick={() => navigate(destination)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg transition-all min-w-[48px] ${
                    active ? 'text-primary' : 'text-muted-foreground hover:text-white'
                  }`}>
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.7} />
                  <span className={`text-[10px] font-medium leading-none mt-0.5 ${active ? 'text-primary' : ''}`}>{item.label}</span>
                  {active && <div className="w-4 h-0.5 rounded-full bg-primary mt-0.5" />}
                </button>
              );
            })}
            {/* Menü-Button öffnet Sidebar Overlay */}
            <button onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg transition-all min-w-[48px] text-muted-foreground hover:text-white">
              <Menu size={20} strokeWidth={1.7} />
              <span className="text-[10px] font-medium leading-none mt-0.5">Menü</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
