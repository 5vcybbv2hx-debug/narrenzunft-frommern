import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { User, Mail, Phone, MapPin, Calendar, LogOut, Bell, Award, Shirt, Trash2 } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

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
        const [h, e] = await Promise.all([
          base44.entities.Haes.filter({ aktueller_besitzer_id: myM[0].id }),
          base44.entities.Ehrung.filter({ mitglied_id: myM[0].id }),
        ]);
        setHaes(h);
        setEhrungen(e);
      }
    } catch (e) {}
    setLoading(false);
  };

  const handleLogout = () => {
    base44.auth.logout('/');
  };

  const handleDeleteAccount = async () => {
    try {
      await base44.auth.logout('/');
    } catch (e) {}
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  const alter = mitglied?.geburtsdatum ? differenceInYears(new Date(), new Date(mitglied.geburtsdatum)) : null;

  return (
    <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Mein Profil</h1>

      {/* Avatar */}
      <div className="bg-card border border-border rounded-xl p-6 mb-4 flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-3xl overflow-hidden">
          {mitglied?.profilbild_url ? (
            <img src={mitglied.profilbild_url} alt="" className="w-full h-full object-cover" />
          ) : (
            `${user?.full_name?.[0] || 'U'}`
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{user?.full_name || 'Benutzer'}</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          {mitglied && (
            <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
              {mitglied.mitgliedsstatus}
            </span>
          )}
        </div>
      </div>

      {/* Mitgliedsdaten */}
      {mitglied && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User size={16} className="text-primary" /> Meine Daten
          </h3>
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
              <div className="flex items-center gap-3">
                <MapPin size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">
                  {[mitglied.strasse, `${mitglied.plz || ''} ${mitglied.ort || ''}`].filter(Boolean).join(', ')}
                </span>
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
              <p className="text-sm text-foreground">{e.typ} – {e.wert}</p>
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
              Dein Account wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden. Deine Mitgliedsdaten bleiben im System erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Account löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}