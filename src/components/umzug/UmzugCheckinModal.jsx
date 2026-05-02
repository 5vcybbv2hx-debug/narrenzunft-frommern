import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Check, Search, QrCode, Users, CheckCircle2, UserPlus } from 'lucide-react';

export default function UmzugCheckinModal({ veranstaltung, onClose }) {
  const [teilnahmen, setTeilnahmen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suche, setSuche] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [saving, setSaving] = useState(null);
  const [addingSpontan, setAddingSpontan] = useState(null); // mitglied_id being added

  useEffect(() => { load(); }, [veranstaltung.id]);

  const load = async () => {
    setLoading(true);
    const [t, m] = await Promise.all([
      base44.entities.Teilnahme.filter({ veranstaltung_id: veranstaltung.id }),
      base44.entities.Mitglied.list('nachname', 500),
    ]);
    setTeilnahmen(t);
    setMitglieder(m);
    setLoading(false);
  };

  const getMitglied = (id) => mitglieder.find(m => m.id === id);

  const toggleAnwesenheit = async (teilnahme) => {
    const newStatus = teilnahme.status === 'Anwesend' ? 'Angemeldet' : 'Anwesend';
    setSaving(teilnahme.id);
    await base44.entities.Teilnahme.update(teilnahme.id, { status: newStatus });
    setTeilnahmen(prev => prev.map(t => t.id === teilnahme.id ? { ...t, status: newStatus } : t));
    setSaving(null);
  };

  const addSpontan = async (mitglied) => {
    setAddingSpontan(mitglied.id);
    const neu = await base44.entities.Teilnahme.create({
      veranstaltung_id: veranstaltung.id,
      mitglied_id: mitglied.id,
      status: 'Anwesend',
      bus: false,
    });
    setTeilnahmen(prev => [...prev, neu]);
    setSuche('');
    setAddingSpontan(null);
  };

  const aktive = teilnahmen.filter(t => t.status !== 'Abgesagt');
  const anwesend = aktive.filter(t => t.status === 'Anwesend');

  const gefiltert = aktive.filter(t => {
    const m = getMitglied(t.mitglied_id);
    if (!m) return false;
    const name = `${m.vorname} ${m.nachname}`.toLowerCase();
    return name.includes(suche.toLowerCase());
  });

  // Mitglieder die noch NICHT angemeldet sind und zum Suchbegriff passen
  const bereitsAngemeldetIds = new Set(teilnahmen.map(t => t.mitglied_id));
  const spontanVorschlaege = suche.length >= 2
    ? mitglieder.filter(m =>
        !bereitsAngemeldetIds.has(m.id) &&
        `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase())
      ).slice(0, 5)
    : [];

  // QR-Code URL – öffnet öffentliche Check-In Seite (wenn vorhanden) oder einfach die App
  const qrUrl = `${window.location.origin}/checkin/${veranstaltung.id}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-bold text-foreground">Check-In</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[260px]">{veranstaltung.titel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-3 gap-2 px-5 py-3 shrink-0">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-green-400">{anwesend.length}</p>
            <p className="text-[10px] text-muted-foreground">Anwesend</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-yellow-400">{aktive.length - anwesend.length}</p>
            <p className="text-[10px] text-muted-foreground">Ausstehend</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-foreground">{aktive.length}</p>
            <p className="text-[10px] text-muted-foreground">Gesamt</p>
          </div>
        </div>

        {/* QR-Code Toggle */}
        <div className="px-5 pb-2 shrink-0">
          <button
            onClick={() => setShowQr(!showQr)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-secondary text-muted-foreground text-sm hover:text-foreground hover:bg-border transition-colors"
          >
            <QrCode size={15} />
            {showQr ? 'QR-Code ausblenden' : 'QR-Code anzeigen (Selbst-Check-In)'}
          </button>
          {showQr && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <img src={qrImageUrl} alt="QR-Code" className="w-40 h-40 rounded-xl border border-border" />
              <p className="text-xs text-muted-foreground text-center">
                Mitglieder können diesen QR-Code scannen um sich selbst einzuchecken
              </p>
            </div>
          )}
        </div>

        {/* Suche */}
        <div className="px-5 pb-2 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Name suchen..."
              value={suche}
              onChange={e => setSuche(e.target.value)}
              className="w-full pl-8 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1.5">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
            </div>
          )}
          {!loading && gefiltert.length === 0 && spontanVorschlaege.length === 0 && (
            <div className="text-center py-8">
              <Users size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Keine Anmeldungen</p>
              {suche.length >= 2 && <p className="text-xs text-muted-foreground mt-1">Person nicht gefunden oder bereits abgesagt</p>}
            </div>
          )}
          {gefiltert
            .sort((a, b) => {
              // Anwesende ans Ende
              if (a.status === 'Anwesend' && b.status !== 'Anwesend') return 1;
              if (a.status !== 'Anwesend' && b.status === 'Anwesend') return -1;
              const ma = getMitglied(a.mitglied_id);
              const mb = getMitglied(b.mitglied_id);
              return (ma?.nachname || '').localeCompare(mb?.nachname || '');
            })
            .map(t => {
              const m = getMitglied(t.mitglied_id);
              const istAnwesend = t.status === 'Anwesend';
              const isSaving = saving === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => toggleAnwesenheit(t)}
                  disabled={isSaving}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    istAnwesend
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-card border-border hover:border-primary/40'
                  } disabled:opacity-60`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    istAnwesend ? 'bg-green-500/20 text-green-400' : 'bg-primary/20 text-primary'
                  }`}>
                    {istAnwesend
                      ? <CheckCircle2 size={18} />
                      : `${m?.vorname?.[0] || ''}${m?.nachname?.[0] || ''}`}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {m ? `${m.vorname} ${m.nachname}` : '–'}
                    </p>
                    <p className={`text-xs ${istAnwesend ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {istAnwesend ? '✓ Anwesend bestätigt' : t.bus ? '🚌 Bus' : '🚗 Auto'}
                    </p>
                  </div>
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    istAnwesend ? 'bg-green-500 border-green-500' : 'border-border bg-transparent'
                  }`}>
                    {istAnwesend && <Check size={14} className="text-white" />}
                  </div>
                </button>
              );
            })}
          {/* Spontan-Hinzufügen: nicht angemeldete Mitglieder */}
          {!loading && spontanVorschlaege.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                Nicht angemeldet – trotzdem einchecken:
              </p>
              {spontanVorschlaege.map(m => (
                <button
                  key={m.id}
                  onClick={() => addSpontan(m)}
                  disabled={addingSpontan === m.id}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all mb-1.5 disabled:opacity-60"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm shrink-0 text-primary">
                    {m.vorname?.[0]}{m.nachname?.[0]}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{m.vorname} {m.nachname}</p>
                    <p className="text-xs text-muted-foreground">{m.mitgliedsstatus} · nicht angemeldet</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-primary text-xs font-semibold shrink-0">
                    {addingSpontan === m.id
                      ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      : <><UserPlus size={14} /> Einchecken</>
                    }
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}