import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, isDeveloper, getRollenLabel } from '@/lib/roles';
import {
  Users, Shirt, Award, CreditCard, Calendar, Bus,
  Briefcase, Bell, Search, LogOut, ChevronRight,
  Shield, Settings, Star, FileText, Lock, CheckSquare,
  Package, AlertTriangle, ClipboardList, MessageSquare
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Mehr() {
  const { user } = useAuth();
  const admin = isAdmin(user);

  const handleLogout = () => base44.auth.logout('/');

  const canSee = (item, user) => {
    if (item.roles === null) return true;
    if (isDeveloper(user)) return true;
    if (item.roles.includes(user?.role)) return true;
    if (item.zusatz && user?._mitglied?.zusatz_berechtigungen) {
      if (item.zusatz.some(z => user._mitglied.zusatz_berechtigungen.includes(z))) {
        return true;
      }
    }
    return false;
  };

  const sections = [
    {
      title: 'Uebersicht',
      items: [
        { path: '/haes', label: 'Häs & Masken', icon: Shirt, roles: null },
        { path: '/sparten', label: 'Sparten & Gruppen', icon: Users, roles: null },
        { path: '/suche', label: 'Suche', icon: Search, roles: null },
        { path: '/benachrichtigungen', label: 'Benachrichtigungen', icon: Bell, roles: null },
        { path: '/nachrichten', label: 'Nachrichten', icon: MessageSquare, roles: null }
      ]
    },
    {
      title: 'Verwaltung',
      items: [
        { path: '/vorstand', label: 'Führungs-Dashboard', icon: ClipboardList, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'] },
        { path: '/mitglieder', label: 'Mitglieder', icon: Users, roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter', 'admin'] },
        { path: '/mitgliedsantraege', label: 'Mitgliedsanträge', icon: FileText, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
        { path: '/ehrungen', label: 'Ehrungen', icon: Award, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
        { path: '/beitraege', label: 'Beiträge', icon: CreditCard, roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'] },
        { path: '/vereine', label: 'Vereine & Zünfte', icon: Users, roles: ['vorstand', 'stellv_vorstand', 'admin'] }
      ]
    },
    {
      title: 'Organisation',
      items: [
        { path: '/ausschuss', label: 'Ausschussbereich', icon: Lock, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'], zusatz: ['ausschuss'] },
        { path: '/todos', label: 'Aufgaben', icon: CheckSquare, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'], zusatz: ['todos'] },
        { path: '/inventar', label: 'Inventar & Verleih', icon: Package, roles: ['vorstand', 'stellv_vorstand', 'admin'], zusatz: ['inventar'] }
      ]
    },
    {
      title: 'System',
      items: [
        { path: '/datenqualitaet', label: 'Datenqualität', icon: AlertTriangle, roles: ['vorstand', 'stellv_vorstand', 'admin'] },
        { path: '/berechtigungen', label: 'Berechtigungen', icon: Shield, roles: ['admin', 'vorstand', 'stellv_vorstand'] }
      ]
    },
    {
      title: 'Familie',
      items: [
        { path: '/familie', label: 'Familien-Dashboard', icon: Users, roles: ['elternkonto'] }
      ]
    }
  ];

  return (
    <div className="px-4 py-6 max-w-xl mx-auto min-h-screen bg-[#080808] text-white">
      <h1 className="text-2xl font-oswald uppercase tracking-wide text-white mb-2">Mehr</h1>

      {/* Benutzer-Info Card */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-[#EA2525] font-bold text-lg shrink-0">
          {user?.full_name?.[0] || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{user?.full_name || 'Benutzer'}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[#EA2525] font-medium">
            {getRollenLabel(user?.role)}
          </span>
        </div>
        <Link to="/profil" className="p-2 rounded-lg bg-neutral-800 text-muted-foreground hover:text-white transition-colors">
          <ChevronRight size={18} />
        </Link>
      </div>

      {/* Admin Badge */}
      {admin && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 mb-4">
          <Shield size={16} className="text-[#EA2525] shrink-0" />
          <p className="text-sm text-white font-medium">Admin-Bereich aktiv</p>
        </div>
      )}

      {/* Sektionen */}
      {sections.map((section) => {
        const visibleItems = section.items.filter(item => canSee(item, user));
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title} className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
              {section.title}
            </p>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {visibleItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-800/50 transition-colors ${
                      idx < visibleItems.length - 1 ? 'border-b border-border' : ''
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-[#EA2525]" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-white">{item.label}</span>
                    <ChevronRight size={16} className="text-muted-foreground hover:text-white" />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Abmelden Button */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-red-900/20 text-red-400 border border-red-700/30 font-semibold hover:bg-red-900/40 transition-colors mt-2"
      >
        <LogOut size={18} /> Abmelden
      </button>
    </div>
  );
}
