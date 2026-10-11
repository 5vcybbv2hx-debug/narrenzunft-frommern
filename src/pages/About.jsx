import { Link } from 'react-router-dom';
import { ArrowLeft, Info, Users, Calendar, Shirt, Briefcase, Shield } from 'lucide-react';

const FEATURES = [
  { icon: Users, title: 'Mitgliederverwaltung', text: 'Mitglieder, Familien und Sparten zentral verwalten – von Aufnahme über Statuswechsel bis zur kompletten Mitgliederhistorie.' },
  { icon: Calendar, title: 'Termine & Anmeldungen', text: 'Kalender für Umzüge, Ausfahrten, Arbeitsdienste und Sitzungen mit direkter Online-Anmeldung und Bus-Organisation.' },
  { icon: Shirt, title: 'Häsverwaltung', text: 'Häs-Inventar mit Zuordnungen, Historie und Gruppen-Feed für jede Sparte – nachvollziehbar bis zum ersten Träger.' },
  { icon: Briefcase, title: 'Arbeitsdienste', text: 'Arbeitsdienste einteilen, zuweisen und den Status live verfolgen – inklusive Vorlagen für wiederkehrende Einsätze.' },
  { icon: Shield, title: 'Ausschuss & Beschlüsse', text: 'Sitzungen, Tagesordnung, Abstimmungen, Beschlüsse und Protokolle an einem Ort – mit Rollen- und Zugriffsschutz.' },
];

export default function About() {
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

      <main className="max-w-2xl mx-auto px-4 py-6 pb-12">
        <div className="flex items-center gap-2.5 mb-4">
          <Info size={22} className="text-primary shrink-0" />
          <h1 className="font-oswald uppercase tracking-wide text-2xl text-foreground">Über die App</h1>
        </div>

        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Die App der <strong className="text-foreground">Narrenzunft Frommern e.V.</strong> ist die mobile-first
            Verwaltungszentrale für unseren Narrenverein. Sie bündelt alle Aufgaben, die bisher über Zettelwirtschaft,
            Tabellen und separate Verteiler liefen, in einer zentralen Plattform – von der Mitglieder- und
            Häsverwaltung über die Termin- und Arbeitsdienstplanung bis hin zur Ausschussorganisation mit
            Sitzungen, Beschlüssen und Protokollen.
          </p>
          <p>
            Die App richtet sich an alle Mitglieder der Narrenzunft Frommern: an aktive Narren, die ihre Termine
            und Anmeldungen verwalten möchten, an Spartenleiter, die ihre Gruppen organisieren, an den Vorstand
            und Ausschuss für die Vereinsführung sowie an Eltern, die über das Elternkonto die Teilnahme ihrer
            Kinder verwalten. Jede Rolle sieht genau die Bereiche, die für sie relevant sind – geschützt durch
            rollenbasierte Zugriffskontrolle.
          </p>
          <p>
            Entwickelt wird die App vom Vorstand der Narrenzunft Frommern in Zusammenarbeit mit
            <strong className="text-foreground"> Base44</strong> als technische Plattform. Sie wächst mit den
            Anforderungen des Vereins: Neue Funktionen wie die Verwaltung von Tanzfiguren, Shop-Bestellungen
            und Dokumentenverwaltung wurden Schritt für Schritt integriert. Ziel ist es, den Vereinsalltag für
            alle Mitglieder so einfach und transparent wie möglich zu gestalten – damit mehr Zeit für das
            Narrensein bleibt.
          </p>
        </div>

        {/* Feature-Übersicht */}
        <h2 className="font-oswald uppercase tracking-wide text-lg text-foreground mt-8 mb-3">Funktionen im Überblick</h2>
        <div className="grid gap-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="flex gap-3 bg-card border border-border rounded-xl p-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm mb-0.5">{f.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-2.5">
          <Link to="/contact" className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold text-center hover:bg-primary/90 active:scale-[0.98] transition-all">
            Kontakt aufnehmen
          </Link>
          <Link to="/" className="flex-1 py-3 rounded-xl bg-secondary text-muted-foreground text-sm font-medium text-center hover:text-foreground transition-colors">
            Zur App
          </Link>
        </div>
      </main>
    </div>
  );
}