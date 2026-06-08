import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Mail, Plus, X } from 'lucide-react';
import NachrichtForm from '@/components/nachricht/NachrichtForm';
import NachrichtenInbox from '@/components/nachricht/NachrichtenInbox';

export default function Nachrichten() {
  const { user } = useAuth();
  const [mitglied, setMitglied] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadMitglied();
  }, [user?.email]);

  const loadMitglied = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      if (me?.email) {
        const mitglieder = await base44.entities.Mitglied.filter({ email: me.email });
        if (mitglieder.length > 0) setMitglied(mitglieder[0]);
      }
    } catch (e) {}
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!mitglied) {
    return (
      <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto text-center">
        <Mail size={40} className="text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Keine Mitgliederdaten zugeordnet.</p>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nachrichten</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kommuniziere mit Vorstand & Funktionären</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> Neue Nachricht
        </button>
      </div>

      {/* Formular Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-foreground text-lg">Neue Nachricht</h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <NachrichtForm
              absenderId={mitglied.id}
              onSent={() => loadMitglied()}
              onClose={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {/* Inbox */}
      <div className="bg-card border border-border rounded-xl p-6">
        <NachrichtenInbox empfaengerId={mitglied.id} />
      </div>
    </div>
  );
}