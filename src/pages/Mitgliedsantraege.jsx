import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { FileText, Check, X, Clock, Eye, UserPlus, ChevronRight, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const STATUS_COLORS = {
  'Neu': 'bg-yellow-500/20 text-yellow-400',
  'In Bearbeitung': 'bg-blue-500/20 text-blue-400',
  'Angelegt': 'bg-green-500/20 text-green-400',
  'Abgelehnt': 'bg-red-500/20 text-red-400',
};

const STATUS_ICONS = {
  'Neu': <Clock size={13} className="text-yellow-400" />,
  'In Bearbeitung': <Eye size={13} className="text-blue-400" />,
  'Angelegt': <Check size={13} className="text-green-400" />,
  'Abgelehnt': <X size={13} className="text-red-400" />,
};

export default function Mitgliedsantraege() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [antraege, setAntraege] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('Alle');
  const [notizen, setNotizen] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [a, m] = await Promise.all([
      base44.entities.Mitgliedsantrag.list('-created_date', 200),
      base44.entities.Mitglied.list('nachname', 300),
    ]);
    setAntraege(a);
    setMitglieder(m);
    setLoading(false);
  };

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const handleStatusChange = async (antragId, newStatus) => {
    setSaving(true);
    await base44.entities.Mitgliedsantrag.update(antragId, { status: newStatus, notizen });
    setAntraege(prev => prev.map(a => a.id === antragId ? { ...a, status: newStatus, notizen } : a));
    if (selected?.id === antragId) setSelected(prev => ({ ...prev, status: newStatus }));
    setSaving(false);
  };

  const handleNotizSave = async () => {
    if (!selected) return;
    setSaving(true);
    await base44.entities.Mitgliedsantrag.update(selected.id, { notizen });
    setAntraege(prev => prev.map(a => a.id === selected.id ? { ...a, notizen } : a));
    setSaving(false);
  };

  const openAntrag = (a) => {
    setSelected(a);
    setNotizen(a.notizen || '');
  };

  const filtered = statusFilter === 'Alle' ? antraege : antraege.filter(a => a.status === statusFilter);
  const neuCount = antraege.filter(a => a.status === 'Neu').length;

  if (!admin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4 text-center">
        <div>
          <FileText size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nur Admins können Mitgliedsanträge verwalten.</p>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText size={22} className="text-primary" /> Mitgliedsanträge
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {antraege.length} gesamt {neuCount > 0 && <span className="text-yellow-400 font-semibold">· {neuCount} neu</span>}
          </p>
        </div>
        <a
          href="/mitgliedsantrag"
          target="_blank"
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <ExternalLink size={14} /> Formular öffnen
        </a>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {['Alle', 'Neu', 'In Bearbeitung', 'Angelegt', 'Abgelehnt'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <FileText size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Keine Anträge vorhanden</p>
          </div>
        )}
        {filtered.map(a => (
          <button key={a.id} onClick={() => openAntrag(a)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-left hover:border-primary/40 transition-all flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
              {a.vorname?.[0]}{a.nachname?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{a.vorname} {a.nachname}</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${STATUS_COLORS[a.status]}`}>
                  {STATUS_ICONS[a.status]} {a.status}
                </span>
                {a.sparte && <span className="text-xs text-muted-foreground">{a.sparte}</span>}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(a.created_date), 'dd.MM.yyyy', { locale: de })}
                </span>
              </div>
            </div>
            <ChevronRight size={15} className="text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-foreground text-lg">{selected.vorname} {selected.nachname}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 mt-1 ${STATUS_COLORS[selected.status]}`}>
                    {STATUS_ICONS[selected.status]} {selected.status}
                  </span>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Daten */}
              <div className="space-y-4 text-sm">
                <Section titel="Persönliches">
                  <Row label="Name" value={`${selected.vorname} ${selected.nachname}`} />
                  <Row label="Geburtsdatum" value={selected.geburtsdatum} />
                  <Row label="Eintritt ab" value={selected.eintrittsdatum} />
                  <Row label="Sparte" value={selected.sparte} highlight />
                </Section>

                <Section titel="Kontakt">
                  <Row label="Adresse" value={[selected.strasse, `${selected.plz} ${selected.ort}`].filter(Boolean).join(', ')} />
                  <Row label="Telefon" value={selected.telefon} />
                  <Row label="Handy" value={selected.handy} />
                  <Row label="E-Mail" value={selected.email} />
                </Section>

                {(selected.sepa_iban || selected.sepa_kontoinhaber) && (
                  <Section titel="SEPA-Mandat">
                    <Row label="Kontoinhaber" value={selected.sepa_kontoinhaber} />
                    <Row label="IBAN" value={selected.sepa_iban} mono />
                    <Row label="BIC" value={selected.sepa_bic} mono />
                    <Row label="Datum" value={selected.sepa_datum} />
                  </Section>
                )}

                {selected.eingereicht_von_mitglied_id && (
                  <p className="text-xs text-muted-foreground">Eingereicht von: {getMitgliedName(selected.eingereicht_von_mitglied_id)}</p>
                )}

                {/* Notizen */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Interne Notizen</label>
                  <textarea
                    value={notizen}
                    onChange={e => setNotizen(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
                    placeholder="z.B. Kontakt aufgenommen, wartet auf Rückmeldung..."
                  />
                </div>
              </div>

              {/* Aktionen */}
              <div className="mt-5 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleStatusChange(selected.id, 'In Bearbeitung')} disabled={saving}
                    className="py-2.5 rounded-xl bg-blue-500/20 text-blue-400 text-sm font-semibold hover:bg-blue-500/30 transition-colors disabled:opacity-50">
                    In Bearbeitung
                  </button>
                  <button onClick={() => handleStatusChange(selected.id, 'Angelegt')} disabled={saving}
                    className="py-2.5 rounded-xl bg-green-500/20 text-green-400 text-sm font-semibold hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    <UserPlus size={14} /> Als Mitglied angelegt
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleNotizSave} disabled={saving}
                    className="py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:bg-border transition-colors disabled:opacity-50">
                    {saving ? 'Speichern...' : 'Notiz speichern'}
                  </button>
                  <button onClick={() => handleStatusChange(selected.id, 'Abgelehnt')} disabled={saving}
                    className="py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50">
                    Ablehnen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ titel, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">{titel}</p>
      <div className="bg-secondary rounded-xl p-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, highlight, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right ${highlight ? 'font-semibold text-primary' : 'text-foreground'} ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}