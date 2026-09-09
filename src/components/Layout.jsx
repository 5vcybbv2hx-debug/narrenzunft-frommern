import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, isDeveloper, getRollenLabel } from '@/lib/roles';
import {
  LayoutDashboard, Users, Shirt, Calendar, Briefcase,
  Award, CreditCard, Bell, ChevronDown,
  LogOut, Shield, ClipboardList,
  AlertTriangle, Lock, CheckSquare, Package, FileText, ShoppingBag,
  ArrowLeft, LayoutGrid,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import SecureSearch from './SecureSearch';

// ── Akkordeon-Sektionen ──
export const NAV_SECTIONS = [
  {
    id: 'aktiv',
    title: 'Aktivitäten',
    icon: Calendar,
    items: [
      { path: '/kalender',       label: 'Termine',            icon: Calendar,    roles: null },
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
      { path: '/mitglieder',     label: 'Mitglieder',         icon: Users,         roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter', 'admin'] },
      { path: '/beitraege',      label: 'Beiträge',           icon: CreditCard,    roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'] },
      { path: '/ehrungen',       label: 'Ehrungen',           icon: Award,         roles: ['vorstand', 'stellv_vorstand', 'admin'] },
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
    roles: null,
    items: [
      { path: '/familie', label: 'Familie', icon: Users, roles: null },
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
  { path: '/arbeitsdienste', label: 'Dienste', icon: Briefcase },
];

// Haupttabs — auf diesen Pfaden wird kein Zurück-Button angezeigt
const ROOT_PATHS = ['/', '/kalender', '/arbeitsdienste', '/mehr'];

export function canSeeItem(item, user) {
  if (!item.roles) return true;
  if (isDeveloper(user)) return true;
  if (item.roles.includes(user?.role)) return true;
  const zusatz = user?._mitglied?.zusatz_berechtigungen || [];
  if (item.zusatz && item.zusatz.some(z => zusatz.includes(z))) return true;
  return false;
}

export function canSeeSection(section, user) {
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

function getInitials(fullName) {
  if (!fullName) return 'U';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(0);
  const [mitglied, setMitglied] = useState(null);
  const admin = isAdmin(user);
  const displayName = mitglied ? `${mitglied.vorname || ''} ${mitglied.nachname || ''}`.trim() : (user?.full_name || 'Benutzer');
  const displayInitials = mitglied
    ? (`${mitglied.vorname?.[0] || ''}${mitglied.nachname?.[0] || ''}`.toUpperCase() || getInitials(user?.full_name))
    : getInitials(user?.full_name);

  const isRootPath = ROOT_PATHS.includes(location.pathname);
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

  useEffect(() => { loadCurrentMitglied(); }, []);
  useEffect(() => { loadNotifications(); }, [mitglied]);
  const loadCurrentMitglied = async () => {
    try {
            const myM = await base44.entities.Mitglied.filter({ user_id: user?.id });
      if (myM[0]) setMitglied(myM[0]);
    } catch (e) { console.error('Error:', e); }
  };

  const loadNotifications = async () => {
    try {
      let notifs;
      if (admin) {
        // Admins sehen nur Admin-Benachrichtigungen (mitglied_id leer) UND ihre eigenen
        const all = await base44.entities.Benachrichtigung.filter({ gelesen: false });
        notifs = all.filter(n => !n.mitglied_id || n.mitglied_id === mitglied?.id);
      } else {
        notifs = mitglied
          ? await base44.entities.Benachrichtigung.filter({ mitglied_id: mitglied.id, gelesen: false })
          : [];
      }
      setNotifications(notifs.length);
    } catch (e) { console.error('Error:', e); }
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

    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-60 fixed h-full z-30"
             style={{ background: 'hsl(var(--sidebar-background))' }}>

        {/* Logo */}
        <div className="relative px-5 py-5 border-b border-sidebar-border overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <Link to="/" className="flex items-center gap-3 pl-2">
            <div className="w-11 h-11 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
              <span className="text-foreground text-xl">🎭</span>
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
              {displayInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{displayName}</p>
              <p className="text-[11px] text-primary font-medium">{getRollenLabel(user?.role)}</p>
            </div>
          </Link>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs font-medium">
            <LogOut size={13} /> Abmelden
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen min-w-0">

        {/* Top Bar */}
        <header className="sticky top-0 z-20 border-b border-border px-4 lg:px-6 py-3 flex items-center gap-3"
                style={{ background: 'hsl(var(--background) / 0.9)', backdropFilter: 'blur(12px)', paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-primary/30" />

          {!isRootPath && (
            <button onClick={() => navigate(-1)}
              className="p-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              aria-label="Zurück">
              <ArrowLeft size={20} />
            </button>
          )}

          <div className="hidden md:flex flex-1 max-w-sm">
            <SecureSearch />
          </div>

          <div className="flex md:hidden flex-1 items-center gap-2">
            <div className="w-1 h-5 bg-primary/10 border border-primary/30 rounded-full" />
            <span className="font-oswald font-semibold text-foreground text-base uppercase tracking-wide">Narrenzunft</span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Link to="/benachrichtigungen"
              className="relative p-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0">
              <Bell size={20} />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary rounded-full text-white text-[10px] font-bold shadow-sm shadow-primary/50">{notifications > 99 ? '99+' : notifications}</span>
              )}
            </Link>
            <Link to="/profil"
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm hover:bg-red-700 transition-colors shadow-sm shadow-primary/30 shrink-0">
              {displayInitials}
            </Link>
          </div>
        </header>

        <main className="flex-1 pb-20 lg:pb-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* ── Bottom Navigation (Mobile) ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-border pb-safe"
             style={{ background: 'hsl(var(--sidebar-background))' }}>
          <div className="absolute top-0 left-0 right-0 h-px bg-primary/50" />
          <div className="flex items-center justify-around px-1 py-1">
            {BOTTOM_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const destination = active ? item.path : (tabHistory[item.path] || item.path);
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
            {/* Mehr-Button öffnet die Hub-Seite */}
            <button onClick={() => navigate('/mehr')} aria-label="Mehr-Menü öffnen"
              className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg transition-all min-w-[48px] ${
                location.pathname.startsWith('/mehr') ? 'text-primary' : 'text-muted-foreground hover:text-white'
              }`}>
              <LayoutGrid size={20} strokeWidth={location.pathname.startsWith('/mehr') ? 2.4 : 1.7} />
              <span className={`text-[10px] font-medium leading-none mt-0.5 ${location.pathname.startsWith('/mehr') ? 'text-primary' : ''}`}>Mehr</span>
              {location.pathname.startsWith('/mehr') && <div className="w-4 h-0.5 rounded-full bg-primary mt-0.5" />}
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}