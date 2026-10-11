import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MessageSquare, Send } from 'lucide-react';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', nachricht: '' });
  const [gesendet, setGesendet] = useState(false);

  const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    // Kontaktformular öffnet das lokale E-Mail-Programm mit vorausgefüllter Nachricht
    const betreff = encodeURIComponent(`Kontaktanfrage über die App – ${form.name || 'Narrenzunft Frommern'}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nE-Mail: ${form.email}\n\nNachricht:\n${form.nachricht}`
    );
    window.location.href = `mailto:info@narrenzunft-frommern.de?subject=${betreff}&body=${body}`;
    setGesendet(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border px-4 py-3 flex items-center gap-3"
              style={{ background: 'hsl(var(--background) / 0.9)', backdropFilter: 'blur(12px)', paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <Link to="/" className="p-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0" aria-label="Zurück">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/30 shrink-0">
            <span className="text-lg">🎭</span>
          </div>
          <span className="font-oswald font-semibold text-foreground text-base uppercase tracking-wide">Narrenzunft Frommern</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 pb-12">
        <div className="flex items-center gap-2.5 mb-4">
          <Mail size={22} className="text-primary shrink-0" />
          <h1 className="font-oswald uppercase tracking-wide text-2xl text-foreground">Kontakt</h1>
        </div>

        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          Sie haben Fragen zur App, möchten einen Fehler melden oder eine Funktion vorschlagen?
          Schreiben Sie uns – wir melden uns schnellstmöglich zurück.
        </p>

        {/* Kontaktformular */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ihr Name"
              className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">E-Mail</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="ihre@email.de"
              className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Nachricht</label>
            <textarea
              required
              rows={5}
              value={form.nachricht}
              onChange={e => set('nachricht', e.target.value)}
              placeholder="Ihre Nachricht…"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            <Send size={15} /> Nachricht senden
          </button>
          {gesendet && (
            <p className="text-xs text-green-400 text-center">
              ✓ Ihr E-Mail-Programm wurde geöffnet. Bitte prüfen Sie Ihren Postausgang.
            </p>
          )}
        </form>

        {/* Direkter Kontakt */}
        <div className="mt-6 bg-card border border-border rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <MessageSquare size={16} className="text-primary shrink-0" />
            <p className="text-sm font-semibold text-foreground">Direkter Kontakt</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            E-Mail: <a href="mailto:info@narrenzunft-frommern.de" className="text-primary hover:underline">info@narrenzunft-frommern.de</a>
          </p>
          <p className="text-[11px] text-muted-foreground/70 pt-1 border-t border-border">
            Hinweis: Diese Kontaktdaten sind Platzhalter. Bitte aktualisieren Sie sie mit den echten Vereins-Kontaktdaten.
          </p>
        </div>

        <Link to="/" className="mt-5 block text-center py-3 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:text-foreground transition-colors">
          Zurück zur App
        </Link>
      </main>
    </div>
  );
}