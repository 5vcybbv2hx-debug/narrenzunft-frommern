import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Bus, Car, Calendar, MapPin, Clock, ChevronRight, Check } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Umzuege() {
  const { user } = useAuth();
  const [umzuege, setUmzuege] = useState([]);
  const [meineAnmeldungen, setMeineAnmeldungen] = useState([]);
  const [myMitglied, setMyMitglied] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Veranstaltung.list('datum', 500);
      const extern = data.filter(v => v.typ === 'Umzug' || v.typ === 'Abendveranstaltung');
      const sorted = extern.sort((a, b) => a.datum.localeCompare(b.datum));
      setUmzuege(sorted);

      const me = await base44.auth.me();
      const myM = await base44.entities.Mitglied.filter({ user_id: me?.id });
      if (myM[0]) {
        setMyMitglied(myM[0]);
        const anmeldungen = await base44.entities.Teilnahme.filter({ mitglied_id: myM[0].id });
        setMeineAnmeldungen(anmeldungen);
      }
    } catch (e) {}
    setLoading(false);
  };

  const getMeineAnmeldung = (veranstaltungId) =>
    meineAnmeldungen.find(a => a.veranstaltung_id === veranstaltungId);

  const handleAnmelden = async (veranstaltungId, bus = false) => {
    if (!myMitglied) return;
    try {
      const t = await base44.entities.Teilnahme.create({
        veranstaltung_id: veranstaltungId,
        mitglied_id: myMitglied.id,
        status: 'Angemeldet',
        bus
      });
      setMeineAnmeldungen(prev => [...prev, t]);
    } catch (e) {}
  };

  const handleAbsagen = async (teilnahme) => {
    try {
      await base44.entities.Teilnahme.update(teilnahme.id, { status: 'Abgesagt' });
      setMeineAnmeldungen(prev => prev.map(a => a.id === teilnahme.id ? { ...a, status: 'Abgesagt' } : a));
    } catch (e) {}
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  const kommende = umzuege.filter(u => u.datum >= today);
  const vergangene = umzuege.filter(u => u.datum < today);

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Auswärtige Termine</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Umzüge & Abendveranstaltungen bei denen wir eingeladen sind · {kommende.length} kommend</p>
      </div>

      {/* Kommende */}
      {kommende.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Kommende Termine</h2>
          <div className="space-y-3">
            {kommende.map(u => {
              const anmeldung = getMeineAnmeldung(u.id);
              const isAngemeldet = anmeldung && anmeldung.status !== 'Abgesagt';
              return (
                <div key={u.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="p-4">
                    <div className="flex gap-3">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] text-muted-foreground">{format(new Date(u.datum), 'MMM', { locale: de })}</span>
                        <span className="text-xl font-bold text-primary">{format(new Date(u.datum), 'd')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{u.titel}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${u.typ === 'Umzug' ? 'bg-primary/20 text-primary' : 'bg-purple-500/20 text-purple-400'}`}>
                            {u.typ}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                          {u.uhrzeit && <span className="flex items-center gap-1"><Clock size={11} /> {u.uhrzeit}</span>}
                          {u.ort && <span className="flex items-center gap-1"><MapPin size={11} /> {u.ort}</span>}
                        </div>
                        {isAngemeldet && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                              ✓ Angemeldet
                            </span>
                            {anmeldung?.bus && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center gap-1">
                                <Bus size={10} /> Bus
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Anmelde-Buttons */}
                  {myMitglied && u.anmeldung_aktiv && (
                    <div className="px-4 pb-4">
                      {!isAngemeldet ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAnmelden(u.id, false)}
                            className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-semibold hover:bg-border transition-colors flex items-center justify-center gap-2"
                          >
                            <Car size={14} /> Mit Auto
                          </button>
                          <button
                            onClick={() => handleAnmelden(u.id, true)}
                            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                          >
                            <Bus size={14} /> Mit Bus
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
                            <Check size={14} className="text-green-400" />
                            <span className="text-sm text-green-400 font-medium">
                              Angemeldet {anmeldung?.bus ? '· 🚌 Bus' : '· 🚗 Auto'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleAbsagen(anmeldung)}
                            className="w-full py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                          >
                            Absagen
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vergangene */}
      {vergangene.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vergangene Termine</h2>
          <div className="space-y-2">
            {vergangene.slice().reverse().slice(0, 10).map(u => (
              <div key={u.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 opacity-70">
                <div className="w-10 h-10 rounded-lg bg-secondary flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] text-muted-foreground">{format(new Date(u.datum), 'MMM', { locale: de })}</span>
                  <span className="text-sm font-bold text-muted-foreground">{format(new Date(u.datum), 'd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.titel}</p>
                  {u.ort && <p className="text-xs text-muted-foreground truncate">{u.ort}</p>}
                </div>
                {getMeineAnmeldung(u.id)?.status === 'Anwesend' && (
                  <Check size={14} className="text-green-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {umzuege.length === 0 && (
        <div className="text-center py-12">
          <Bus size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine auswärtigen Termine gefunden</p>
        </div>
      )}
    </div>
  );
}