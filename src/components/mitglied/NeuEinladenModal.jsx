import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Mail, Send, Check, AlertCircle } from 'lucide-react';

/**
 * Modal für Admins: Mitglied neu einladen.
 * - E-Mail kann angepasst werden (wird im Profil aktualisiert)
 * - Einladung wird versendet (Passwort-vergessen- / E-Mail-Wechsel-Fall)
 * - Einladungsdatum wird am Mitglied notiert
 * - Beim nächsten Login verknüpft verknuepfeMitgliedLogin das Konto automatisch
 */
export default function NeuEinladenModal({ mitglied, onClose, onSuccess }) {
  const [email, setEmail] = useState(mitglied.email || '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const emailChanged = email.trim().toLowerCase() !== (mitglied.email || '').trim().toLowerCase();

  const handleConfirm = async () => {
    const trimmed = email.trim();
    if (!trimmed) { setError('Bitte E-Mail-Adresse eingeben.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Ungültige E-Mail-Adresse.'); return; }
    setSending(true);
    setError(null);
    try {
      // 1) E-Mail am Mitglied aktualisieren, falls geändert
      if (emailChanged) {
        await base44.entities.Mitglied.update(mitglied.id, { email: trimmed });
      }
      // 2) Rolle bestimmen (vorstand/stellv_vorstand → admin, sonst user)
      const baseRolle = ['vorstand', 'stellv_vorstand'].includes(mitglied.app_rolle) ? 'admin' : 'user';
      // 3) Einladung versenden
      await base44.users.inviteUser(trimmed, baseRolle);
      // 4) Einladungsdatum notieren
      const today = new Date().toISOString().split('T')[0];
      await base44.entities.Mitglied.update(mitglied.id, { einladung_gesendet_am: today });
      setSuccess(true);
      onSuccess?.({ email: trimmed, einladung_gesendet_am: today });
      setTimeout(() => onClose(), 1200);
    } catch (e) {
      console.error('Neu einladen:', e);
      setError(e?.response?.data?.error || e?.message || 'Einladung konnte nicht gesendet werden.');
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Send size={18} className="text-primary" /> Mitglied neu einladen
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Sendet eine neue Einladung an diese E-Mail-Adresse. Bei einer Änderung wird die Adresse im
          Mitgliederprofil aktualisiert – beim nächsten Login verknüpft sich das Konto automatisch.
        </p>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check size={24} className="text-green-400" />
            </div>
            <p className="text-sm font-medium text-white text-center">
              Einladung an <span className="text-primary">{email}</span> gesendet!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">E-Mail-Adresse</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              {emailChanged && (
                <p className="text-xs text-yellow-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} /> E-Mail wird im Profil aktualisiert.
                </p>
              )}
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-red-900/20 border border-red-700/30 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-muted-foreground text-sm font-medium hover:text-white transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirm}
                disabled={sending || !email.trim()}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {sending ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sendet…</>
                ) : (
                  <><Send size={14} /> Neu einladen</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}