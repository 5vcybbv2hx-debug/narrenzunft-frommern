import { Outlet, useLocation, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, Users, Shirt, Calendar, Briefcase,
  Award, CreditCard, Bus, Bell, Menu, X, ChevronRight,
  LogOut, User, Settings, Search
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/mitglieder', label: 'Mitglieder', icon: Users },
  { path: '/veranstaltungen', label: 'Veranstaltungen', icon: Calendar },
  { path: '/arbeitsdienste', label: 'Arbeitsdienste', icon: Briefcase },
  { path: '/ehrungen', label: 'Ehrungen', icon: Award },
  { path: '/beitraege', label: 'Beiträge', icon: CreditCard },
  { path: '/haes', label: 'Häs', icon: Shirt },
  { path: '/umzuege', label: 'Umzüge', icon: Bus },
];

const bottomNavItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/mitglieder', label: 'Mitglieder', icon: Users },
  { path: '/veranstaltungen', label: 'Events', icon: Calendar },
  { path: '/arbeitsdienste', label: 'Dienste', icon: Briefcase },
  { path: '/profil', label: 'Profil', icon: User },
];

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const notifs = await base44.entities.Benachrichtigung.filter({ gelesen: false });
      setNotifications(notifs.length);
    } catch (e) {}
  };

  const handleLogout = () => {
    base44.auth.logout('/');
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

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
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-200 group ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" size={18} />
                <span className="text-sm font-medium">{item.label}</span>
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
              {user?.full_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.full_name || 'Benutzer'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.role || 'member'}</p>
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
                  <p className="text-xs text-muted-foreground">Verwaltung</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 overflow-y-auto">
              {navItems.map((item) => {
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
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 lg:px-6 py-3 flex items-center gap-3">
          <button
            className="lg:hidden p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-foreground lg:hidden">Narrenzunft</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/suche" className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              <Search size={18} />
            </Link>
            <Link to="/benachrichtigungen" className="relative p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              <Bell size={18} />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
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
          <div className="flex items-center justify-around px-2 py-2">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <Icon size={20} className={active ? 'stroke-[2.5px]' : ''} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                  {active && <div className="w-1 h-1 rounded-full bg-primary" />}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}