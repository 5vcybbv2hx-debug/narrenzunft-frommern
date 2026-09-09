import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getRollenLabel } from '@/lib/roles';
import { NAV_SECTIONS, canSeeItem, canSeeSection } from '@/components/Layout';
import SecureSearch from '@/components/SecureSearch';
import { ChevronRight, LogOut, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Mehr() {
  const { user } = useAuth();
  const location = useLocation();

  const handleLogout = () => base44.auth.logout('/');
  const isActive = (path) => location.pathname === path;
  const istFuehrung = ['vorstand', 'stellv_vorstand', 'admin'].includes(user?.role);

  const sichtbareSektionen = NAV_SECTIONS
    .filter(s => canSeeSection(s, user))
    .map(s => ({ ...s, items: s.items.filter(i => canSeeItem(i, user)) }))
    .filter(s => s.items.length > 0);

  const displayName = user?._mitglied
    ? `${user._mitglied.vorname || ''} ${user._mitglied.nachname || ''}`.trim()
    : (user?.full_name || 'Benutzer');
  const displayInitials = (displayName.split(' ').map(w => w[0]).join('').toUpperCase() || 'U').slice(0, 2);

  return (
    <div className="px-4 py-5 max-w-xl mx-auto">
      <h1 className="font-oswald uppercase tracking-wide text-2xl text-foreground mb-4">Mehr</h1>

      {/* Profil-Karte */}
      <Link to="/profil"
        className="flex items-center gap-3.5 bg-card border border-border rounded-xl p-4 mb-4 active:scale-[0.99] transition-all">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm shadow-primary/30">
          {displayInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{displayName}</p>
          <p className="text-xs text-primary font-medium">{getRollenLabel(user?.role)}</p>
        </div>
        <ChevronRight size={18} className="text-muted-foreground shrink-0" />
      </Link>

      {/* Suche */}
      <div className="mb-5">
        <SecureSearch />
      </div>

      {/* Kachel-Hub */}
      {sichtbareSektionen.map((section) => (
        <div key={section.id} className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
            {section.title}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path}
                  className={`flex flex-col items-start gap-2.5 rounded-xl border p-3.5 transition-all active:scale-[0.97] ${
                    active
                      ? 'bg-primary/10 border-primary/40'
                      : 'bg-card border-border hover:border-primary/30'
                  }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    active ? 'bg-primary border border-primary/40' : 'bg-primary/10 border border-primary/25'
                  }`}>
                    <Icon size={19} className="text-white" strokeWidth={active ? 2.2 : 1.9} />
                  </div>
                  <span className="text-[13px] font-medium text-foreground leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* Führungshinweis */}
      {istFuehrung && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/25 rounded-xl px-4 py-3 mb-4">
          <Shield size={15} className="text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">Du siehst zusätzliche Verwaltungsbereiche für deine Rolle.</p>
        </div>
      )}

      {/* Abmelden */}
      <button onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-red-900/20 text-red-400 border border-red-700/30 font-medium text-sm hover:bg-red-900/40 active:scale-[0.98] transition-all">
        <LogOut size={17} /> Abmelden
      </button>
    </div>
  );
}
