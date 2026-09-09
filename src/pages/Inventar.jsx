import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { istVerleihZustaendig } from '../lib/verleih';
import { kannInventarSehn, isAdmin } from '@/lib/roles';
import { Package, Plus, Lock, ChevronRight, Calendar, CheckCircle2, Clock, XCircle, Globe, User, AlertCircle, AlertTriangle, Inbox, QrCode, Check, X, Phone, Mail, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import AusruestungKarte from '@/components/inventar/AusruestungKarte';
import AusruestungForm from '@/components/inventar/AusruestungForm';
import AusleiheForm from '@/components/inventar/AusleiheForm';
import VerleihQrModal from '@/components/inventar/VerleihQrModal';

export default function Inventar() {
  const { user } = useAuth();
  const hatZugriff = kannInventarSehn(user);
  const admin = isAdmin(user);

  const [ausruestungen, setAusruestungen] = useState([]);
  const [ausleihen, setAusleihen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [externePersonen, setExternePersonen] = useState([]);
  const [meinMitglied, setMeinMitglied] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('uebersicht');
  const [showAusruestungForm, setShowAusruestungForm] = useState(false);
  const [editAusruestung, setEditAusruestung] = useState(null);
  const [showAusleiheForm, setShowAusleiheForm] = useState(false);
  const [selectedAusruestung, setSelectedAusruestung] = useState(null);
  const [editAusleihe, setEditAusleihe] = useState(null);
  const [verleihAnfragen, setVerleihAnfragen] = useState([]);
  const [qrAusruestung, setQrAusruestung] = useState(null);
  const [entscheidung, setEntscheidung] = useState(null); // { anfrage, typ: 'genehmigen'|'ablehnen', notiz }
  const [entscheideBusy, setEntscheideBusy] = useState(false);

  useEffect(() => {
    if (!hatZugriff) return;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
            const [a, al, ep, myMArr, va] = await Promise.all([
        base44.entities.Ausruestung.list('name', 200),
        base44.entities.Ausleihe.list('-von_datum', 300),
        admin ? base44.entities.ExternePerson.list('name', 200) : Promise.resolve([]),
        base44.entities.Mitglied.filter({ user_id: user?.id }),
        base44.entities.VerleihAnfrage.list('-created_date', 200),
      ]);
      setAusruestungen(a.filter(x => x.aktiv !== false));
      setAusleihen(al);
      setExternePersonen(ep);
      setMeinMitglied(myMArr[0] || null);
      setVerleihAnfragen(va);
      // Mitgliedernamen nur für Admins laden (für Ausleiher-Anzeige und Form)
      if (admin) {
        const m = await base44.entities.Mitglied.list('nachname', 500);
        setMitglieder(m.filter(x => !x.archiviert));
      }
    } catch (err) {
      console.error(err);
      setError('Fehler beim Laden des Inventars. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  // Für jede Ausrüstung: ist sie heute ausgeliehen?
  const getAktuelleAusleihe = (ausruestungId) =>
    ausleihen.find(al =>
      al.ausruestung_id === ausruestungId &&
      al.von_datum <= today &&
      al.bis_datum >= today &&
      ['Reserviert', 'Ausgeliehen'].includes(al.status)
    );

  // Verfügbare Stückzahl berechnen: verfuegbar_override oder (bestand - aktive Ausleihen)
  const getVerfuegbar = (ausruestungId) => {
    const a = ausruestungen.find(x => x.id === ausruestungId);
    if (!a) return { verfuegbar: 0, bestand: 1 };
    const bestand = a.bestand ?? 1;
    if (a.verfuegbar_override != null && a.verfuegbar_override !== '') return { verfuegbar: a.verfuegbar_override, bestand };
    const aktivAusgeliehen = ausleihen
      .filter(al => al.ausruestung_id === ausruestungId && ['Reserviert', 'Ausgeliehen'].includes(al.status))
      .reduce((sum, al) => sum + (al.anzahl || 1), 0);
    return { verfuegbar: Math.max(0, bestand - aktivAusgeliehen), bestand };
  };

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const getAusleiherName = (al) => {
    if (al.ausleiher_typ === 'extern') {
      const ep = externePersonen.find(p => p.id === al.ausleiher_extern_id);
      return ep ? `${ep.name}${ep.organisation ? ` (${ep.organisation})` : ''}` : '–';
    }
    return getMitgliedName(al.ausleiher_mitglied_id);
  };

  const handleAusruestungSave = async (form) => {
    setError(null);
    try {
      if (editAusruestung) {
        const updated = await base44.entities.Ausruestung.update(editAusruestung.id, form);
        setAusruestungen(prev => prev.map(a => a.id === updated.id ? updated : a));
      } else {
        const neu = await base44.entities.Ausruestung.create({ ...form, aktiv: true });
        setAusruestungen(prev => [...prev, neu]);
      }
      setShowAusruestungForm(false);
      setEditAusruestung(null);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Speichern des Gegenstands.');
    }
  };

  const handleAusruestungDelete = async (id) => {
    setError(null);
    try {
      await base44.entities.Ausruestung.update(id, { aktiv: false });
      setAusruestungen(prev => prev.filter(a => a.id !== id));
      setShowAusruestungForm(false);
      setEditAusruestung(null);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Löschen des Gegenstands.');
    }
  };

  const handleAusleiheStart = (ausruestung) => {
    setSelectedAusruestung(ausruestung);
    setEditAusleihe(null);
    setShowAusleiheForm(true);
  };

  const handleAusleiheEdit = (ausleihe) => {
    setEditAusleihe(ausleihe);
    setSelectedAusruestung(ausruestungen.find(a => a.id === ausleihe.ausruestung_id) || null);
    setShowAusleiheForm(true);
  };

  const handleAusleihesSave = async (form) => {
    setError(null);
    try {
      if (editAusleihe) {
        const updated = await base44.entities.Ausleihe.update(editAusleihe.id, form);
        setAusleihen(prev => prev.map(a => a.id === updated.id ? updated : a));
      } else {
        const neu = await base44.entities.Ausleihe.create({
          ...form,
          verantwortlicher_id: meinMitglied?.id || '',
        });
        setAusleihen(prev => [neu, ...prev]);
      }
      setShowAusleiheForm(false);
      setEditAusleihe(null);
      setSelectedAusruestung(null);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Speichern der Ausleihe.');
    }
  };

  const handleAusleiheDelete = async (id) => {
    setError(null);
    try {
      await base44.entities.Ausleihe.delete(id);
      setAusleihen(prev => prev.filter(a => a.id !== id));
      setShowAusleiheForm(false);
      setEditAusleihe(null);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Löschen der Ausleihe.');
    }
  };

  const aktuelleAusleihen = ausleihen.filter(al =>
    ['Reserviert', 'Ausgeliehen'].includes(al.status) && al.bis_datum >= today
  );
  const offeneAnfragen = verleihAnfragen.filter(v => v.status === 'Offen');
  const entschiedeneAnfragen = verleihAnfragen.filter(v => v.status !== 'Offen').slice(0, 10);

  // Verleih-Anfrage genehmigen: ExternePerson + Ausleihe anlegen, Anfrage abschließen
  const genehmigeAnfrage = async () => {
    if (!entscheidung?.anfrage) return;
    setEntscheideBusy(true);
    setError(null);
    try {
      const an = entscheidung.anfrage;
      // ExternePerson finden (per E-Mail) oder neu anlegen
      let ep = externePersonen.find(p => an.email && p.email?.toLowerCase() === an.email.toLowerCase());
      if (!ep) {
        ep = await base44.entities.ExternePerson.create({
          name: an.name, telefon: an.telefon || '', email: an.email || '',
          notizen: 'Automatisch aus QR-Verleih-Anfrage',
        });
        setExternePersonen(prev => [...prev, ep]);
      }
      // Ausleihe als Reservierung anlegen
      const neuAusleihe = await base44.entities.Ausleihe.create({
        ausruestung_id: an.ausruestung_id,
        ausleiher_typ: 'extern',
        ausleiher_extern_id: ep.id,
        von_datum: an.von_datum,
        bis_datum: an.bis_datum,
        zweck: an.zweck || 'Verleih-Anfrage (QR)',
        status: 'Reserviert',
        anzahl: 1,
        verantwortlicher_id: meinMitglied?.id || '',
      });
      // Anfrage abschließen
      const aktualisiert = await base44.entities.VerleihAnfrage.update(an.id, {
        status: 'Genehmigt',
        entschieden_von: meinMitglied ? `${meinMitglied.vorname} ${meinMitglied.nachname}` : 'Vorstand',
        entschieden_am: today,
        antwort_notiz: entscheidung.notiz || '',
      });
      setVerleihAnfragen(prev => prev.map(v => v.id === an.id ? aktualisiert : v));
      setAusleihen(prev => [neuAusleihe, ...prev]);
      setEntscheidung(null);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Genehmigen der Anfrage.');
    } finally {
      setEntscheideBusy(false);
    }
  };

  const lehneAnfrageAb = async () => {
    if (!entscheidung?.anfrage) return;
    setEntscheideBusy(true);
    setError(null);
    try {
      const an = entscheidung.anfrage;
      const aktualisiert = await base44.entities.VerleihAnfrage.update(an.id, {
        status: 'Abgelehnt',
        entschieden_von: meinMitglied ? `${meinMitglied.vorname} ${meinMitglied.nachname}` : 'Vorstand',
        entschieden_am: today,
        antwort_notiz: entscheidung.notiz || '',
      });
      setVerleihAnfragen(prev => prev.map(v => v.id === an.id ? aktualisiert : v));
      setEntscheidung(null);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Ablehnen der Anfrage.');
    } finally {
      setEntscheideBusy(false);
    }
  };

  const vergangeneAusleihen = ausleihen.filter(al =>
    al.status === 'Zurückgegeben' || al.bis_datum < today
  ).slice(0, 30);

  if (!hatZugriff) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Lock size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-xl font-oswald uppercase text-white mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Dieser Bereich ist nur für Vorstand und berechtigte Personen.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground font-medium">Inventar wird geladen…</span>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {error && (
        <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-red-900/20 border border-red-700/30 text-sm text-red-400">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Fehler aufgetreten</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white text-xs">Schließen</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-oswald uppercase tracking-wide text-white flex items-center gap-2">
            <Package size={22} className="text-primary" /> Inventar & Verleih
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ausruestungen.length} Gegenstände · {aktuelleAusleihen.length} aktive Ausleihen
          </p>
        </div>
        {admin && (
          <button
            onClick={() => { setEditAusruestung(null); setShowAusruestungForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            <Plus size={16} /> Gegenstand
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-5 overflow-x-auto scrollbar-hide">
        {[
          { id: 'uebersicht', label: 'Übersicht', icon: Package },
          { id: 'anfragen', label: offeneAnfragen.length > 0 ? `Anfragen (${offeneAnfragen.length})` : 'Anfragen', icon: Inbox },
          { id: 'ausleihen', label: `Ausleihen (${aktuelleAusleihen.length})`, icon: Clock },
          { id: 'historie', label: 'Historie', icon: Calendar },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-white'}`}>
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ÜBERSICHT */}
      {activeTab === 'uebersicht' && (
        <div className="space-y-3">
          {ausruestungen.length === 0 && (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Package size={36} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Noch keine Gegenstände angelegt</p>
            </div>
          )}
          {ausruestungen.map(a => {
            const { verfuegbar, bestand } = getVerfuegbar(a.id);
            return (
            <AusruestungKarte
              key={a.id}
              ausruestung={a}
              aktuelleAusleihe={getAktuelleAusleihe(a.id)}
              verfuegbar={verfuegbar}
              bestand={bestand}
              getMitgliedName={getMitgliedName}
              isAdmin={admin}
              onEdit={() => { setEditAusruestung(a); setShowAusruestungForm(true); }}
              onAusleihen={() => handleAusleiheStart(a)}
              onQr={() => setQrAusruestung(a)}
              ausleiherName={getAusleiherName(getAktuelleAusleihe(a.id) || {})}
            />
            );
          })}
        </div>
      )}

      {/* VERLEIH-ANFRAGEN (QR) */}
      {activeTab === 'anfragen' && (
        <div className="space-y-3">
          {offeneAnfragen.length === 0 && entschiedeneAnfragen.length === 0 && (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Inbox size={36} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Keine Anfragen über den QR-Verleih</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tipp: Gegenstände mit <QrCode size={11} className="inline" />-Button im Verleih-Modus haben einen QR-Code für Außenstehende.
              </p>
            </div>
          )}

          {offeneAnfragen.length > 0 && (
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              {offeneAnfragen.length} offene {offeneAnfragen.length === 1 ? 'Anfrage' : 'Anfragen'} · Genehmigen können Vorstand & Zuständige
            </p>
          )}

          {offeneAnfragen.map(an => {
            const ausr = ausruestungen.find(a => a.id === an.ausruestung_id);
            const tage = an.von_datum && an.bis_datum
              ? Math.max(1, Math.ceil((new Date(an.bis_datum) - new Date(an.von_datum)) / 86400000) + 1)
              : 0;
            const kostet = tage * (ausr?.verleih_preis || 0);
            const istZustaendig = istVerleihZustaendig(ausr, meinMitglied?.id) || admin;
            return (
            <div key={an.id} className="bg-card border border-primary/30 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{an.ausruestung_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {an.von_datum} → {an.bis_datum} · {tage} Tag(e)
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white uppercase tracking-wide shrink-0">Neu</span>
              </div>

              <div className="mt-2.5 px-3 py-2 rounded-lg bg-secondary border border-border text-xs space-y-1">
                <p className="text-white font-medium">{an.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                  {an.telefon && <a href={`tel:${an.telefon}`} className="flex items-center gap-1 hover:text-primary"><Phone size={11} /> {an.telefon}</a>}
                  {an.email && <a href={`mailto:${an.email}`} className="flex items-center gap-1 hover:text-primary truncate"><Mail size={11} /> {an.email}</a>}
                </div>
                {an.zweck && <p className="text-muted-foreground"><span className="text-gray-500">Zweck:</span> {an.zweck}</p>}
                {kostet > 0 && <p className="text-primary font-semibold">≈ {Number(kostet).toFixed(2).replace('.', ',')} € Miete{ausr?.verleih_kaution > 0 ? ` + ${Number(ausr.verleih_kaution).toFixed(2).replace('.', ',')} € Kaution` : ''}</p>}
              </div>

              {entscheidung?.anfrage?.id === an.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={entscheidung.notiz}
                    onChange={(e) => setEntscheidung(p => ({ ...p, notiz: e.target.value }))}
                    placeholder={entscheidung.typ === 'genehmigen' ? 'Notiz zur Genehmigung (optional, z.B. Absprachen)' : 'Grund / Notiz zur Ablehnung (optional)'}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={entscheidung.typ === 'genehmigen' ? genehmigeAnfrage : lehneAnfrageAb} disabled={entscheideBusy}
                      className={`py-2.5 min-h-[44px] rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 ${entscheidung.typ === 'genehmigen' ? 'bg-green-700 hover:bg-green-600' : 'bg-red-700 hover:bg-red-600'}`}>
                      {entscheideBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      {entscheidung.typ === 'genehmigen' ? 'Genehmigen' : 'Ablehnen'}
                    </button>
                    <button onClick={() => setEntscheidung(null)} disabled={entscheideBusy}
                      className="py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-muted-foreground text-xs font-semibold hover:text-white">
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => setEntscheidung({ anfrage: an, typ: 'genehmigen', notiz: '' })} disabled={!istZustaendig}
                    className="py-2.5 min-h-[44px] rounded-lg bg-green-900/30 border border-green-700/40 text-green-400 text-xs font-semibold hover:bg-green-900/50 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                    <Check size={14} /> Genehmigen
                  </button>
                  <button onClick={() => setEntscheidung({ anfrage: an, typ: 'ablehnen', notiz: '' })} disabled={!istZustaendig}
                    className="py-2.5 min-h-[44px] rounded-lg bg-red-900/20 border border-red-700/30 text-red-400 text-xs font-semibold hover:bg-red-900/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                    <X size={14} /> Ablehnen
                  </button>
                </div>
              )}
            </div>
            );
          })}

          {entschiedeneAnfragen.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold pt-2">Entschieden</p>
              {entschiedeneAnfragen.map(an => (
                <div key={an.id} className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white">{an.ausruestung_name} · {an.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{an.von_datum} → {an.bis_datum}</p>
                      {an.antwort_notiz && <p className="text-[11px] text-muted-foreground mt-0.5 italic">{an.antwort_notiz}</p>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${an.status === 'Genehmigt' ? 'bg-green-900/20 text-green-400 border border-green-700/30' : 'bg-secondary text-gray-400'}`}>
                      {an.status}{an.entschieden_von ? ` · ${an.entschieden_von}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* AKTIVE AUSLEIHEN */}
      {activeTab === 'ausleihen' && (
        <div className="space-y-2">
          {aktuelleAusleihen.length === 0 && (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Calendar size={36} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Keine aktiven Ausleihen</p>
            </div>
          )}
          {aktuelleAusleihen.map(al => {
            const ausruestung = ausruestungen.find(a => a.id === al.ausruestung_id);
            return (
              <AusleiheKarte
                key={al.id}
                ausleihe={al}
                ausruestung={ausruestung}
                ausleiherName={getAusleiherName(al)}
                today={today}
                onClick={() => handleAusleiheEdit(al)}
              />
            );
          })}
        </div>
      )}

      {/* HISTORIE */}
      {activeTab === 'historie' && (
        <div className="space-y-2">
          {vergangeneAusleihen.length === 0 && (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Clock size={36} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Noch keine abgeschlossenen Ausleihen</p>
            </div>
          )}
          {vergangeneAusleihen.map(al => {
            const ausruestung = ausruestungen.find(a => a.id === al.ausruestung_id);
            return (
              <AusleiheKarte
                key={al.id}
                ausleihe={al}
                ausruestung={ausruestung}
                ausleiherName={getAusleiherName(al)}
                today={today}
                onClick={() => handleAusleiheEdit(al)}
                vergangen
              />
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAusruestungForm && (
        <AusruestungForm
          ausruestung={editAusruestung}
          mitglieder={mitglieder}
          onSave={handleAusruestungSave}
          onDelete={handleAusruestungDelete}
          onClose={() => { setShowAusruestungForm(false); setEditAusruestung(null); }}
        />
      )}

      {showAusleiheForm && (
        <AusleiheForm
          ausleihe={editAusleihe}
          ausruestung={selectedAusruestung}
          ausruestungen={ausruestungen}
          mitglieder={mitglieder}
          ausleihen={ausleihen}
          meinMitglied={meinMitglied}
          onSave={handleAusleihesSave}
          onDelete={handleAusleiheDelete}
          onClose={() => { setShowAusleiheForm(false); setEditAusleihe(null); setSelectedAusruestung(null); }}
        />
      )}

      {qrAusruestung && (
        <VerleihQrModal ausruestung={qrAusruestung} onClose={() => setQrAusruestung(null)} />
      )}
    </div>
  );
}

function AusleiheKarte({ ausleihe, ausruestung, ausleiherName, today, onClick, vergangen }) {
  const STATUS_STYLE = {
    'Reserviert':     'bg-blue-900/20 text-blue-400 border border-blue-700/30',
    'Ausgeliehen':    'bg-primary/20 text-primary border border-primary/30',
    'Zurückgegeben':  'bg-green-900/20 text-green-400 border border-green-700/30',
    'Abgesagt':       'bg-secondary text-gray-400',
  };
  const istUeberfaellig = ausleihe.bis_datum < today && ausleihe.status === 'Ausgeliehen';

  return (
    <button onClick={onClick} className={`w-full bg-card border rounded-xl p-4 text-left hover:border-primary/40 transition-all ${istUeberfaellig ? 'border-red-700/40' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{ausruestung?.name || '–'}</p>
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {ausleihe.ausleiher_typ === 'extern' ? <Globe size={13} className="inline" /> : <User size={13} className="inline" />}
            <span className="text-white">{ausleiherName}</span>
            {ausleihe.zweck && <span className="text-white">· {ausleihe.zweck}</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Calendar size={13} className="inline" />
            <span className="text-white">{ausleihe.von_datum} → {ausleihe.bis_datum}</span>
            {istUeberfaellig && (
              <span className="flex items-center gap-1 text-red-400 font-medium">
                <AlertTriangle size={12} /> Überfällig!
              </span>
            )}
          </div>
          {ausleihe.schadensbericht && (
            <div className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle size={12} />
              <span>{ausleihe.schadensbericht}</span>
            </div>
          )}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLE[ausleihe.status]}`}>
          {ausleihe.status}
        </span>
      </div>
    </button>
  );
}