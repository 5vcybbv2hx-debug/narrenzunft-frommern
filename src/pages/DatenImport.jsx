import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { useNavigate } from 'react-router-dom';
import ImportSchritt from '@/components/import/ImportSchritt';
import { Database, ArrowLeft, AlertTriangle } from 'lucide-react';

// URLs der hochgeladenen CSV-Dateien (fest hinterlegt)
const CSV_URLS = {
  personen:               'https://media.base44.com/files/public/69f263f56f0ba624a7c9355c/8cac29552_personen.csv',
  kontakte:               'https://media.base44.com/files/public/69f263f56f0ba624a7c9355c/48280a884_kontakte.csv',
  adressen:               'https://media.base44.com/files/public/69f263f56f0ba624a7c9355c/32782fe08_adressen.csv',
  haes:                   'https://media.base44.com/files/public/69f263f56f0ba624a7c9355c/561719be3_haes.csv',
  gruppen:                'https://media.base44.com/files/public/69f263f56f0ba624a7c9355c/dd33bb54d_gruppen.csv',
  mitgliedschaft_gruppen: 'https://media.base44.com/files/public/69f263f56f0ba624a7c9355c/e1fea9649_mitgliedschaft_gruppen.csv',
};

const SCHRITTE = [
  {
    id: 'gruppen',
    nummer: 1,
    titel: 'Sparten & Gruppen synchronisieren',
    beschreibung: '6 Gruppen aus der bereinigten Liste (Brennnesseln, Hexen, Garde, Zäpfle Bomber, Junggarde, Junggarde Mini) anlegen und 307 Mitglieder-Gruppen-Zuordnungen setzen.',
    funktion: 'importGruppenCSV',
    payload: (mode) => ({
      mode,
      gruppen_url: CSV_URLS.gruppen,
      personen_url: CSV_URLS.personen,
      mitgliedschaft_gruppen_url: CSV_URLS.mitgliedschaft_gruppen,
    }),
    previewKey: 'zuordnungen',
    previewColumns: ['person', 'gruppen', 'mitglied_match', 'aktion'],
    statsKey: ['gruppen', 'zuordnungen_gesamt', 'zugeordnet', 'nichtGefunden'],
  },
  {
    id: 'personen',
    nummer: 2,
    titel: 'Mitglieder-Stammdaten bereinigen',
    beschreibung: '358 Personen abgleichen: Adresse, Geburtsdatum, Telefon, E-Mail aktualisieren. Matching über Name + Geburtsdatum.',
    funktion: 'importPersonenCSV',
    payload: (mode, offset) => ({
      mode,
      offset: offset || 0,
      limit: 20,
      personen_url: CSV_URLS.personen,
      kontakte_url: CSV_URLS.kontakte,
      adressen_url: CSV_URLS.adressen,
    }),
    previewKey: 'preview',
    previewColumns: ['vorname', 'nachname', 'geburtsdatum', 'status', 'match', 'aktion'],
    statsKey: ['total', 'updated', 'created'],
    batched: true,
  },
  {
    id: 'haes',
    nummer: 3,
    titel: 'Häs-Zuweisungen automatisieren',
    beschreibung: '217 Häs-Nummern aus der bereinigten Liste den richtigen Personen zuweisen + HaesHistorie anlegen. Matching über Name + Geburtsdatum.',
    funktion: 'importHaesCSV',
    payload: (mode, offset) => ({
      mode,
      offset: offset || 0,
      limit: 50,
      haes_url: CSV_URLS.haes,
      personen_url: CSV_URLS.personen,
      gruppen_url: CSV_URLS.gruppen,
      mitgliedschaft_gruppen_url: CSV_URLS.mitgliedschaft_gruppen,
    }),
    previewKey: 'preview',
    previewColumns: ['haesnummer', 'person_name', 'haes_in_db', 'mitglied_in_db', 'haesgruppe', 'aktion'],
    statsKey: ['total', 'haesZugewiesen', 'haesNichtGefunden', 'mitgliedNichtGefunden'],
    batched: true,
  },
];

export default function DatenImport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const admin = isAdmin(user);

  if (!admin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <AlertTriangle size={40} className="text-destructive mb-3" />
        <p className="text-foreground font-semibold">Kein Zugriff</p>
        <p className="text-sm text-muted-foreground">Nur Administratoren können Daten importieren.</p>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database size={22} className="text-primary" /> Daten-Import & Bereinigung
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Schrittweise Datenbereinigung aus der extern analysierten Mitgliederliste
          </p>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
        <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-300">
          <strong>Wichtig:</strong> Führe die Schritte der Reihe nach aus. Erst Vorschau prüfen, dann ausführen.
          Schritt 1 (Gruppen) muss vor Schritt 2 und 3 abgeschlossen sein.
        </div>
      </div>

      <div className="space-y-4">
        {SCHRITTE.map((schritt) => (
          <ImportSchritt key={schritt.id} schritt={schritt} />
        ))}
      </div>
    </div>
  );
}