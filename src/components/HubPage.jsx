import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, isDeveloper } from '@/lib/roles';
import { ChevronRight } from 'lucide-react';

export function canSeeItem(item, user) {
  if (!item.roles) return true;
  if (isDeveloper(user)) return true;
  if (item.roles.includes(user?.role)) return true;
  const zusatz = user?._mitglied?.zusatz_berechtigungen || [];
  if (item.zusatz && item.zusatz.some(z => zusatz.includes(z))) return true;
  return false;
}

export default function HubPage({ title, subtitle, items, accent }) {
  const { user } = useAuth();
  const accentColor = accent || '#EA2525';
  const visibleItems = items.filter(item => canSeeItem(item, user));

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-oswald font-semibold uppercase tracking-wide text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Keine Bereiche verfügbar</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-all duration-200 overflow-hidden"
              >
                {/* Akzent-Balken oben */}
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: accentColor }}
                />
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: accentColor + '15', border: `1px solid ${accentColor}30` }}
                >
                  <Icon size={20} style={{ color: accentColor }} />
                </div>
                <p className="font-oswald font-medium text-white text-sm uppercase tracking-wide leading-tight">
                  {item.label}
                </p>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">
                    {item.description}
                  </p>
                )}
                <ChevronRight
                  size={14}
                  className="absolute top-5 right-4 text-muted-foreground/40 group-hover:text-primary transition-colors"
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
