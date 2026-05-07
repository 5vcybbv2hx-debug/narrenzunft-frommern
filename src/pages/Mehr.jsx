import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, kannMitgliederlisteSehn, getRollenLabel } from '@/lib/roles';
import {
  Users, Shirt, Award, CreditCard, Calendar, Bus,
  Briefcase, Bell, Search, LogOut, ChevronRight,
  Shield, Settings, Star, FileText
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Mehr() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const verantw = kannMitgliederlisteSehn(user);

  const handleLogout = () => base44.auth.logout('/');

  const sections = [
    {
      title: 'Navigation',
      items: [
        { path: '/veranstaltungen', label: 'Eigene Veranstaltungen', icon: Calendar, show: true },
        { path: '/haes', label: 'Häs & Masken', icon: Shirt, show: true },
        { path: '/suche', label: 'Suche', icon: Search, show: true },
        { path: '/benachrichtigungen', label: 'Benachrichtigungen', icon: Bell, show: true },
      ]
    },
    {
      title: 'Verwaltung',
      show: admin || verantw,
      items: [
        { path: '/mitglieder', label: 'Mitglieder', icon: Users, show: admin || verantw },
        { path: '/mitgliedsantraege', label: 'Mitgliedsanträge', icon: FileText, show: admin },
        { path: '/ehrungen', label: 'Ehrungen', icon: Award, show: admin || verantw },
        { path: '/beitraege', label: 'Beiträge', icon: CreditCard, show: admin },
      ]
    },
  ];

  return (
    <div className="px-4 py-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2">Mehr</h1>

      {/* Benutzer-Info */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg shrink-0">
          {user?.full_name?.[0] || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{user?.full_name || 'Benutzer'}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
            {getRollenLabel(user?.role)}
          </span>
        </div>
        <Link to="/profil" className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight size={18} />
        </Link>
      </div>

      {/* Admin-Badge */}
      {admin && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 mb-4">
          <Shield size={16} className="text-primary shrink-0" />
          <p className="text-sm text-primary font-medium">Admin-Bereich aktiv</p>
        </div>
      )}

      {/* Sektionen */}
      {sections.map((section) => {
        const visibleItems = section.items.filter(i => i.show);
        if (section.show === false || visibleItems.length === 0) return null;
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
                    className={`flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors ${
                      idx < visibleItems.length - 1 ? 'border-b border-border' : ''
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-primary" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Abmelden */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 font-semibold hover:bg-destructive/20 transition-colors mt-2"
      >
        <LogOut size={18} /> Abmelden
      </button>
    </div>
  );
}