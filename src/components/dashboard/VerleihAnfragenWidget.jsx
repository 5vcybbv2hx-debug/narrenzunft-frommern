import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { Inbox, Phone, Mail, Calendar, Package, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * Zeigt offene Verleih-Anfragen auf dem Dashboard.
 * Sichtbar für Vorstand (alle Anfragen) und zuständige Personen (nur ihre Gegenstände).
 */
export default function VerleihAnfragenWidget() {
  const { user } = useAuth();
  const vorstand = isAdmin(user);

  const { data, isLoading } = useQuery({
    queryKey: ['verleih-anfragen-dashboard', user?.id],
    queryFn: async () => {
      const [anfragen, ausruestungen, myMitgliedArr] = await Promise.all([
        base44.entities.VerleihAnfrage.filter({ status: 'Offen' }, '-created_date', 20),
        base44.entities.Ausruestung.list('name', 200),
        base44.entities.Mitglied.filter({ user_id: user?.id }),
      ]);
      return { anfragen, ausruestungen, myMitgliedId: myMitgliedArr?.[0]?.id };
    },
  });

  const anfragen = data?.anfragen || [];
  const ausruestungen = data?.ausruestungen || [];
  const myMitgliedId = data?.myMitgliedId;

  // Vorstand sieht alle; zuständige Personen nur ihre Gegenstände
  const sichtbareAnfragen = vorstand
    ? anfragen
    : anfragen.filter((a) => {
        const item = ausruestungen.find((x) => x.id === a.ausruestung_id);
        return item?.verleih_verantwortlicher_id === myMitgliedId;
      });

  if (isLoading) return null;
  if (sichtbareAnfragen.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2">
          <Inbox size={16} className="text-primary" />
          <h3 className="font-oswald font-semibold text-foreground text-sm tracking-wide">
            Offene Verleih-Anfragen
          </h3>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-white font-semibold">
          {sichtbareAnfragen.length}
        </span>
      </div>
      <div className="p-4 space-y-2.5">
        {sichtbareAnfragen.slice(0, 4).map((a) => (
          <Link
            key={a.id}
            to="/inventar"
            className="flex items-start gap-3 p-2.5 -mx-1.5 rounded-lg hover:bg-secondary/50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Package size={15} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {a.ausruestung_name || 'Gegenstand'}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar size={10} />
                  {a.von_datum ? format(new Date(a.von_datum + 'T12:00:00'), 'dd.MM.', { locale: de }) : ''}
                  {' → '}
                  {a.bis_datum ? format(new Date(a.bis_datum + 'T12:00:00'), 'dd.MM.yy', { locale: de }) : ''}
                </span>
                <span className="truncate">{a.name}</span>
                {a.telefon && (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <Phone size={10} /> {a.telefon}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
        <Link
          to="/inventar"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors mt-1"
        >
          Alle Anfragen bearbeiten <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}