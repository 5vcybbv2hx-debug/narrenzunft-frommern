import { useAuth } from '@/lib/AuthContext';
import { isDeveloper } from '@/lib/roles';
import { Lock } from 'lucide-react';

/**
 * Prüft ob ein User Zugriff auf eine Route hat.
 * - Keine roles = jeder darf
 * - Developer darf immer
 * - Rollen-Check gegen user.role
 * - Zusatz-Berechtigungen gegen user._mitglied.zusatz_berechtigungen
 */
export function canAccess(user, roles, zusatz) {
  if (!roles) return true;
  if (isDeveloper(user)) return true;
  if (roles.includes(user?.role)) return true;
  if (zusatz) {
    const userZusatz = user?._mitglied?.zusatz_berechtigungen || [];
    if (zusatz.some(z => userZusatz.includes(z))) return true;
  }
  return false;
}

/**
 * Route-Guard — umschließt geschützte Seiten.
 * Zeigt Spinner während Auth lädt, "Kein Zugriff" bei fehlenden Rechten.
 */
export function Guard({ roles, zusatz, children }) {
  const { user, authChecked } = useAuth();

  if (!authChecked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Wird geladen…</p>
      </div>
    );
  }

  if (!canAccess(user, roles, zusatz)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Lock size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-xl font-bold font-oswald uppercase tracking-wide text-white mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Du hast keine Berechtigung für diese Seite.</p>
      </div>
    );
  }

  return children;
}

// ── Rollen-Konstanten (Single Source of Truth) ──────────────────────────────

// Führung & Verwaltung
export const ROLLEN_VORSTAND = ['vorstand', 'stellv_vorstand', 'admin'];
export const ROLLEN_FUEHRUNG = ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'];
export const ROLLEN_FINANZEN = ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'];
export const ROLLEN_MITGLIEDER = ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter', 'admin'];
export const ROLLEN_NUR_ADMIN = ['admin'];
