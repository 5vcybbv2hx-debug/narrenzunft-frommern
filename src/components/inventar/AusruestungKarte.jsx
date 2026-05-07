import { Edit, AlertTriangle } from 'lucide-react';

const KATEGORIE_EMOJIS = {
  'Anhänger': '🚛', 'Kühlanhänger': '🧊', 'Bar': '🍺',
  'Zelt': '⛺', 'Technik': '🔌', 'Sonstiges': '📦',
};

const ZUSTAND_FARBEN = {
  'Sehr gut': 'bg-green-500/20 text-green-400',
  'Gut':      'bg-blue-500/20 text-blue-400',
  'Ausreichend': 'bg-yellow-500/20 text-yellow-400',
  'Defekt':   'bg-red-500/20 text-red-400',
};

const FAHRZEUG_KATEGORIEN = ['Anhänger', 'Kühlanhänger'];

function getTuevStatus(datum) {
  if (!datum) return null;
  const today = new Date();
  const faellig = new Date(datum);
  const diffTage = Math.ceil((faellig - today) / (1000 * 60 * 60 * 24));
  if (diffTage < 0) return { label: `TÜV abgelaufen (${datum})`, color: 'text-red-400 bg-red-500/10 border-red-500/30' };
  if (diffTage <= 60) return { label: `TÜV fällig am ${datum}`, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' };
  return { label: `TÜV bis ${datum}`, color: 'text-green-400 bg-green-500/10 border-green-500/30' };
}

export default function AusruestungKarte({ ausruestung, aktuelleAusleihe, ausleiherName, isAdmin, onEdit, onAusleihen }) {
  const frei = !aktuelleAusleihe;
  const istFahrzeug = FAHRZEUG_KATEGORIEN.includes(ausruestung.kategorie);
  const tuevStatus = getTuevStatus(ausruestung.tuev_faellig);
  const versStatus = getTuevStatus(ausruestung.versicherung_gueltig_bis);

  return (
    <div className={`bg-card border rounded-xl p-4 transition-all ${frei ? 'border-border' : 'border-orange-500/30'}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${frei ? 'bg-secondary' : 'bg-orange-500/10'}`}>
          {ausruestung.bild_url
            ? <img src={ausruestung.bild_url} alt="" className="w-full h-full object-cover rounded-xl" />
            : KATEGORIE_EMOJIS[ausruestung.kategorie] || '📦'
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{ausruestung.name}</p>
              <p className="text-xs text-muted-foreground">{ausruestung.kategorie}</p>
            </div>
            {isAdmin && (
              <button onClick={onEdit} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0">
                <Edit size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            {/* Status */}
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${frei ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
              {frei ? '✓ Verfügbar' : '● Ausgeliehen'}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${ZUSTAND_FARBEN[ausruestung.zustand]}`}>
              {ausruestung.zustand}
            </span>
            {ausruestung.standort && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ausruestung.standort)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                📍 {ausruestung.standort}
              </a>
            )}
          </div>

          {/* Aktuelle Ausleihe */}
          {aktuelleAusleihe && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs">
              <p className="text-orange-300">
                {aktuelleAusleihe.ausleiher_typ === 'extern' ? '🌐' : '👤'} {ausleiherName} · bis {aktuelleAusleihe.bis_datum}
                {aktuelleAusleihe.zweck && ` · ${aktuelleAusleihe.zweck}`}
              </p>
            </div>
          )}

          {ausruestung.beschreibung && (
            <p className="text-xs text-muted-foreground mt-2">{ausruestung.beschreibung}</p>
          )}

          {/* Fahrzeug-Infos */}
          {istFahrzeug && (ausruestung.kennzeichen || tuevStatus || versStatus) && (
            <div className="mt-2 space-y-1">
              {ausruestung.kennzeichen && (
                <p className="text-xs text-muted-foreground">🚗 {ausruestung.kennzeichen}{ausruestung.baujahr ? ` · Bj. ${ausruestung.baujahr}` : ''}</p>
              )}
              {tuevStatus && (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-medium ${tuevStatus.color}`}>
                  <AlertTriangle size={11} /> {tuevStatus.label}
                </div>
              )}
              {versStatus && ausruestung.versicherung_gueltig_bis && (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-medium ${versStatus.color}`}>
                  <AlertTriangle size={11} /> Versicherung: {versStatus.label.replace('TÜV', '').trim()}
                </div>
              )}
            </div>
          )}

          {/* Ausleihen-Button */}
          <button
            onClick={onAusleihen}
            className="mt-3 w-full py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
          >
            + Ausleihe eintragen
          </button>
        </div>
      </div>
    </div>
  );
}