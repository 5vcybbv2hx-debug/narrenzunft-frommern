import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Loader2, Check, X } from 'lucide-react';

export default function NachrichtForm({ absenderId, onSent, onClose }) {
  const [empfaenger, setEmpfaenger] = useState([]);
  const [form, setForm] = useState({ empfaenger_mitglied_id: '', betreff: '', inhalt: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Nur Funktionäre laden – jede Rolle einzeln filtern und zusammenführen
    const rollen = ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter'];
    Promise.all(
      rollen.map(rolle => base44.entities.Mitglied.filter({ app_rolle: rolle, archiviert: false }))
    ).then(results => {
      const alle = results.flat();
      // Deduplizieren nach ID
      const unique = Array.from(new Map(alle.map(m => [m.id, m])).values());
      unique.sort((a, b) => a.nachname.localeCompare(b.nachname));
      setEmpfaenger(unique);
    });
  }, []);

  const handleSend = async () => {
    if (!form.empfaenger_mitglied_id || !form.betreff || !form.inhalt) return;
    setSending(true);
    setError(null);
    try {
      // Nachricht erstellen
      const nachricht = await base44.entities.Nachricht.create({
        absender_mitglied_id: absenderId,
        empfaenger_mitglied_id: form.empfaenger_mitglied_id,
        betreff: form.betreff,
        inhalt: form.inhalt,
      });

      // Email-Benachrichtigung versenden
      await base44.functions.invoke('sendeNachrichtBenachrichtigung', {
        nachricht_id: nachricht.id,
      });

      setSent(true);
      setTimeout(() => {
        onSent?.();
        onClose?.();
      }, 1500);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Fehler beim Senden');
    }
    setSending(false);
  };

  const ausgewaehlt = empfaenger.find(e => e.id === form.empfaenger_mitglied_id);

  if (sent) {
    return (
      <div className="text-center py-6">
        <Check size={40} className="text-green-400 mx-auto mb-3" />
        <p className="font-semibold text-foreground">Nachricht gesendet!</p>
        <p className="text-sm text-muted-foreground mt-1">Eine Email-Benachrichtigung wurde versendet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          <X size={13} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground font-medium block mb-1">An (Vorstand/Funktionär) *</label>
        <select
          value={form.empfaenger_mitglied_id}
          onChange={e => setForm(p => ({ ...p, empfaenger_mitglied_id: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
        >
          <option value="">– Auswählen –</option>
          {empfaenger.map(e => (
            <option key={e.id} value={e.id}>
              {e.vorname} {e.nachname} ({e.app_rolle})
            </option>
          ))}
        </select>
        {ausgewaehlt && (
          <p className="text-xs text-muted-foreground mt-1.5">
            ✉️ Benachrichtigung wird an {ausgewaehlt.email} versendet
          </p>
        )}
      </div>

      <div>
        <label className="text-xs text-muted-foreground font-medium block mb-1">Betreff *</label>
        <input
          type="text"
          placeholder="Kurzer Betreff..."
          value={form.betreff}
          onChange={e => setForm(p => ({ ...p, betreff: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground font-medium block mb-1">Nachricht *</label>
        <textarea
          placeholder="Deine Nachricht hier..."
          value={form.inhalt}
          onChange={e => setForm(p => ({ ...p, inhalt: e.target.value }))}
          rows={5}
          className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !form.empfaenger_mitglied_id || !form.betreff || !form.inhalt}
          className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? 'Wird gesendet...' : 'Senden'}
        </button>
      </div>
    </div>
  );
}