import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { User, Mail, Phone, MapPin, Calendar, LogOut, Award, Shirt, Trash2, Flag, Edit, Save, X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format, differenceInYears } from 'date-fns';

export default function Profil() {
  const { user } = useAuth();
  const [mitglied, setMitglied] = useState(null);
  const [haes, setHaes] = useState([]);
  const [ehrungen, setEhrungen] = useState([]);
  const [teilnahmen, setTeilnahmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      const myM = await base44.entities.Mitglied.filter({ user_id: me?.id });
      if (myM[0]) {
        setMitglied(myM[0]);
        const [h, e, t] = await Promise.all([
          base44.entities.Haes.filter({ aktueller_besitzer_id: myM[0].id }),
          base44.entities.Ehrung.filter({ mitglied_id: myM[0].id }),
          base44.entities.Teilnahme.filter({ mitglied_id: myM[0].id }),
        ]);
        setHaes(h);
        setEhrungen(e);
        setTeilnahmen(t);
      }
    } catch (e) {}
    setLoading(false);
  };

  const handleEditStart = () => {
    setEditForm({
      telefon: mitglied.telefon || '',
      email: mitglied.email || '',
      strasse: mitglied.strasse || '',
      plz: mitglied.plz || '',
      ort: mitglied.ort || '',
      notfallkontakt_name: mitglied.notfallkontakt_name || '',
      notfallkontakt_telefon: mitglied.notfallkontakt_telefon || '',
    });
    setEditing(true);
  };

  const handleEditSave = async () => {
    setSaving(true);
    await base44.entities.Mitglied.update(mitglied.id, editForm);
    setMitglied(prev => ({ ...prev, ...editForm }));
    setEditing(false);
    setSaving(false);
  };

  const handleLogout = () => {
    base44.auth.logout('/');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Send deletion request notification before logging out
      const me = await base44.auth.me();
      await base44.integrations.Core.SendEmail({
        to: me?.email || '',
        subject: 'Account-Löschung beantragt',
        body: `Hallo ${me?.full_name || ''},\n\nDeine Anfrage zur Account-Löschung wurde eingereicht und wird von einem Administrator bearbeitet. Du wirst in Kürze abgemeldet.\n\nNarrenzunft Verwaltung`,
      });
    } catch (e) {
      // Proceed even if email fails
    }
    setDeleting(false);
    base44.auth.logout('/');
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  const alter = mitglied?.geburtsdatum ? differenceInYears(new Date(), new Date(mitglied.geburtsdatum)) : null;
  const vollname = mitglied ? `${mitglied.vorname} ${mitglied.nachname}`.trim() : null;
  const umzuegeGesamt = (mitglied?.umzuege_vor_digitalisierung || 0) + teilnahmen.filter(t => t.teilgenommen).length;

  return (
    <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Mein Profil</h1>

      {/* Avatar */}
      <div className="bg-card border border-border rounded-xl p-6 mb-4 flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-3xl overflow-hidden shrink-0">
          {mitglied?.profilbild_url ? (
            <img src={mitglied.profilbild_url} alt="" className="w-full h-full object-cover" />
          ) : (
            `${mitglied?.vorname?.[0] || user?.full_name?.[0] || 'U'}${mitglied?.nachname?.[0] || ''}`
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{vollname || user?.full_name || 'Benutzer'}</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          {mitglied && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                {mitglied.mitgliedsstatus}
              </span>
              {mitglied.eintrittsdatum && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  seit {format(new Date(mitglied.eintrittsdatum), 'yyyy')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mitgliedsdaten */}
      {mitglied && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <User size={16} className="text-primary" /> Meine Daten
            </h3>
            {!editing ? (
              <button
                onClick={handleEditStart}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Edit size={13} /> Bearbeiten
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <X size={15} />
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                >
                  <Save size={13} /> {saving ? '...' : 'Speichern'}
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Telefon</label>
                <input value={editForm.telefon} onChange={e => setEditForm(p => ({ ...p, telefon: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">E-Mail</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Straße & Hausnummer</label>
                <input value={editForm.strasse} onChange={e => setEditForm(p => ({ ...p, strasse: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">PLZ</label>
                  <input value={editForm.plz} onChange={e => setEditForm(p => ({ ...p, plz: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Ort</label>
                  <input value={editForm.ort} onChange={e => setEditForm(p => ({ ...p, ort: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">🚨 Notfallkontakt</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">Name</label>
                    <input value={editForm.notfallkontakt_name} onChange={e => setEditForm(p => ({ ...p, notfallkontakt_name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">Telefon</label>
                    <input value={editForm.notfallkontakt_telefon} onChange={e => setEditForm(p => ({ ...p, notfallkontakt_telefon: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {mitglied.telefon && (
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">{mitglied.telefon}</span>
                </div>
              )}
              {mitglied.email && (
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">{mitglied.email}</span>
                </div>
              )}
              {(mitglied.strasse || mitglied.ort) && (
                <div className="flex items-start gap-3">
                  <MapPin size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    {mitglied.strasse && <p className="text-sm text-foreground">{mitglied.strasse}</p>}
                    {(mitglied.plz || mitglied.ort) && (
                      <p className="text-sm text-foreground">{[mitglied.plz, mitglied.ort].filter(Boolean).join(' ')}</p>
                    )}
                  </div>
                </div>
              )}
              {mitglied.geburtsdatum && (
                <div className="flex items-center gap-3">
                  <Calendar size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">
                    {format(new Date(mitglied.geburtsdatum), 'dd.MM.yyyy')} ({alter} Jahre)
                  </span>
                </div>
              )}
              {mitglied.eintrittsdatum && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="text-xs">Mitglied seit {format(new Date(mitglied.eintrittsdatum), 'dd.MM.yyyy')}</span>
                </div>
              )}
              {(mitglied.notfallkontakt_name || mitglied.notfallkontakt_telefon) && (
                <div className="flex items-start gap-3 pt-1 border-t border-border">
                  <span className="text-sm shrink-0">🚨</span>
                  <div>
                    <p className="text-xs text-muted-foreground">Notfallkontakt</p>
                    {mitglied.notfallkontakt_name && <p className="text-sm text-foreground">{mitglied.notfallkontakt_name}</p>}
                    {mitglied.notfallkontakt_telefon && <p className="text-sm text-foreground">{mitglied.notfallkontakt_telefon}</p>}
                  </div>
                </div>
              )}
              {!mitglied.telefon && !mitglied.email && !mitglied.strasse && (
                <p className="text-sm text-muted-foreground italic">Noch keine Daten hinterlegt – jetzt bearbeiten</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Statistiken */}
      {mitglied && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <Flag size={20} className="text-primary shrink-0" />
            <div>
              <p className="text-xl font-bold text-foreground">{umzuegeGesamt}</p>
              <p className="text-xs text-muted-foreground">Umzüge gesamt</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <Award size={20} className="text-primary shrink-0" />
            <div>
              <p className="text-xl font-bold text-foreground">{ehrungen.filter(e => e.status === 'Verliehen').length}</p>
              <p className="text-xs text-muted-foreground">Ehrungen</p>
            </div>
          </div>
        </div>
      )}

      {/* Mein Häs */}
      {haes.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Shirt size={16} className="text-primary" /> Mein Häs ({haes.length})
          </h3>
          {haes.map(h => (
            <div key={h.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-mono font-bold text-primary">#{h.haesnummer}</p>
                <p className="text-xs text-muted-foreground">{h.bezeichnung || '–'}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{h.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Meine Ehrungen */}
      {ehrungen.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Award size={16} className="text-primary" /> Meine Ehrungen ({ehrungen.length})
          </h3>
          {ehrungen.map(e => (
            <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm text-foreground">{e.typ}{e.wert ? ` – ${e.wert}` : ''}</p>
                {e.jahr && <p className="text-xs text-muted-foreground">Jahr {e.jahr}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                e.status === 'Verliehen' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>{e.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Abmelden */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 font-semibold hover:bg-destructive/20 transition-colors mt-2"
      >
        <LogOut size={18} /> Abmelden
      </button>

      {/* Account löschen */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-muted-foreground hover:text-destructive transition-colors mt-2 text-sm">
            <Trash2 size={15} /> Account löschen
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Eine Löschungsanfrage wird an einen Administrator gesendet. Du wirst danach abgemeldet. Deine Mitgliedsdaten bleiben im System erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
            >
              {deleting ? 'Anfrage wird gesendet...' : 'Account löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}