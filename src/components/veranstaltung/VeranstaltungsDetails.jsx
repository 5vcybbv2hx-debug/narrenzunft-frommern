/**
 * Typ-spezifische Detailfelder für Veranstaltungen.
 * Wird sowohl in VeranstaltungDetail (eigene) als auch in Umzuege (auswärtig) verwendet.
 */

import { MapPin, Clock, Navigation } from 'lucide-react';
import AdresseAutocomplete from '@/components/AdresseAutocomplete';

function NavButton({ adresse, label }) {
  if (!adresse) return null;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
    >
      <Navigation size={11} /> {label || 'Navigation öffnen'}
    </a>
  );
}

function InfoBlock({ color, emoji, title, children }) {
  const borderColors = {
    orange: 'border-orange-500/40',
    blue: 'border-blue-500/40',
    purple: 'border-purple-500/40',
    green: 'border-green-500/40',
    yellow: 'border-yellow-500/40',
    pink: 'border-pink-500/40',
    gray: 'border-border',
  };
  const textColors = {
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    pink: 'text-pink-400',
    gray: 'text-muted-foreground',
  };
  return (
    <div className={`border-l-4 ${borderColors[color] || borderColors.gray} bg-secondary/40 rounded-r-xl px-4 py-3`}>
      <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${textColors[color] || textColors.gray}`}>{emoji} {title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <p className="text-sm text-foreground">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

function TextAreaField({ label, field, value, onChange, rows = 3, placeholder }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground font-medium block mb-1">{label}</label>
      <textarea
        value={value || ''}
        onChange={e => onChange(field, e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
      />
    </div>
  );
}

function InputField({ label, field, value, onChange, placeholder, type = 'text', isAddress = false }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground font-medium block mb-1">{label}</label>
      {isAddress ? (
        <AdresseAutocomplete
          value={value || ''}
          onChange={(val) => onChange(field, val)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={e => onChange(field, e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
        />
      )}
    </div>
  );
}

/** Bearbeitungsformular – zeigt typ-spezifische Felder */
export function VeranstaltungsDetailsForm({ data, onChange, typ }) {
  const isUmzug = typ === 'Umzug';
  const isAbend = ['Abendveranstaltung', 'Fest', 'Intern'].includes(typ);

  return (
    <div className="space-y-4">
      {isUmzug && (
        <>
          <div className="text-xs font-semibold text-orange-400 uppercase tracking-wide">🅿️ Busparkplatz</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Treffzeit am Bus" field="busparkplatz_treffzeit" value={data.busparkplatz_treffzeit} onChange={onChange} placeholder="z.B. 09:30" />
            <InputField label="Adresse Busparkplatz" field="busparkplatz_adresse" value={data.busparkplatz_adresse} onChange={onChange} placeholder="Straße, Ort" isAddress />
          </div>

          <div className="text-xs font-semibold text-blue-400 uppercase tracking-wide">📋 Umzugsaufstellung</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Zeit Aufstellung" field="umzugsaufstellung_zeit" value={data.umzugsaufstellung_zeit} onChange={onChange} placeholder="z.B. 10:00" />
            <InputField label="Ort / Adresse Aufstellung" field="umzugsaufstellung_ort" value={data.umzugsaufstellung_ort} onChange={onChange} placeholder="Straße, Ort" isAddress />
          </div>

          <div className="text-xs font-semibold text-purple-400 uppercase tracking-wide">🎉 Festakt / Abschluss</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Beginn Festakt" field="festakt_zeit" value={data.festakt_zeit} onChange={onChange} placeholder="z.B. 14:00" />
            <InputField label="Name des Festakts" field="festakt_ort" value={data.festakt_ort} onChange={onChange} placeholder="z.B. Festhalle XY" />
            <div className="sm:col-span-2">
              <InputField label="Adresse Festakt" field="festakt_adresse" value={data.festakt_adresse} onChange={onChange} placeholder="Straße, Ort" isAddress />
            </div>
          </div>
        </>
      )}

      {isAbend && (
        <>
          <div className="text-xs font-semibold text-green-400 uppercase tracking-wide">📍 Veranstaltungsort</div>
          <InputField label="Vollständige Adresse (für Navigation)" field="veranstaltungsort_adresse" value={data.veranstaltungsort_adresse} onChange={onChange} placeholder="Musterstraße 1, 78050 VS-Villingen" isAddress />

          <div className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">🕐 Zeiten</div>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Einlass" field="einlass_zeit" value={data.einlass_zeit} onChange={onChange} placeholder="z.B. 19:00" />
            <InputField label="Beginn" field="beginn_zeit" value={data.beginn_zeit} onChange={onChange} placeholder="z.B. 20:00" />
          </div>

          <TextAreaField label="Programmablauf" field="programmablauf" value={data.programmablauf} onChange={onChange} rows={4} placeholder="19:00 Einlass&#10;20:00 Begrüßung&#10;..." />
          <InputField label="Dresscode / Kleidungshinweise" field="dresscode" value={data.dresscode} onChange={onChange} placeholder="z.B. Häs oder festliche Kleidung" />
        </>
      )}

      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📝 Allgemeines</div>
      <TextAreaField label="Allgemeine Hinweise" field="hinweise" value={data.hinweise} onChange={onChange} rows={3} placeholder="z.B. Parkinfos, Verhaltensregeln, Verpflegung..." />
      <InputField label="Ansprechpartner vor Ort (Name + Tel.)" field="kontakt_vor_ort" value={data.kontakt_vor_ort} onChange={onChange} placeholder="Max Mustermann, 0171 123456" />
    </div>
  );
}

/** Leseansicht – schön aufbereitet für Mitglieder */
export function VeranstaltungsDetailsView({ data }) {
  const typ = data.typ;
  const isUmzug = typ === 'Umzug';
  const isAbend = ['Abendveranstaltung', 'Fest', 'Intern'].includes(typ);

  const hasUmzugData = data.busparkplatz_adresse || data.busparkplatz_treffzeit || data.umzugsaufstellung_ort || data.festakt_ort;
  const hasAbendData = data.veranstaltungsort_adresse || data.einlass_zeit || data.programmablauf || data.dresscode;
  const hasAllgemein = data.hinweise || data.kontakt_vor_ort;

  if (!hasUmzugData && !hasAbendData && !hasAllgemein) return null;

  return (
    <div className="space-y-3">
      {isUmzug && (
        <>
          {(data.busparkplatz_adresse || data.busparkplatz_treffzeit) && (
            <InfoBlock color="orange" emoji="🅿️" title="Busparkplatz">
              <InfoRow label="Treffzeit" value={data.busparkplatz_treffzeit ? data.busparkplatz_treffzeit + ' Uhr' : null} />
              <InfoRow label="Adresse" value={data.busparkplatz_adresse} />
              <NavButton adresse={data.busparkplatz_adresse} label="Zum Busparkplatz navigieren" />
            </InfoBlock>
          )}
          {(data.umzugsaufstellung_ort || data.umzugsaufstellung_zeit) && (
            <InfoBlock color="blue" emoji="📋" title="Umzugsaufstellung">
              <InfoRow label="Zeit" value={data.umzugsaufstellung_zeit ? data.umzugsaufstellung_zeit + ' Uhr' : null} />
              <InfoRow label="Ort" value={data.umzugsaufstellung_ort} />
              <NavButton adresse={data.umzugsaufstellung_ort} label="Zur Aufstellung navigieren" />
            </InfoBlock>
          )}
          {(data.festakt_ort || data.festakt_adresse) && (
            <InfoBlock color="purple" emoji="🎉" title="Festakt / Abschluss">
              <InfoRow label="Beginn" value={data.festakt_zeit ? data.festakt_zeit + ' Uhr' : null} />
              <InfoRow label="Ort" value={data.festakt_ort} />
              <InfoRow label="Adresse" value={data.festakt_adresse} />
              <NavButton adresse={data.festakt_adresse || data.festakt_ort} label="Zum Festakt navigieren" />
            </InfoBlock>
          )}
        </>
      )}

      {isAbend && (
        <>
          {data.veranstaltungsort_adresse && (
            <InfoBlock color="green" emoji="📍" title="Veranstaltungsort">
              <p className="text-sm text-foreground font-medium">{data.ort || ''}</p>
              <p className="text-sm text-muted-foreground">{data.veranstaltungsort_adresse}</p>
              <NavButton adresse={data.veranstaltungsort_adresse} label="Navigation öffnen" />
            </InfoBlock>
          )}
          {(data.einlass_zeit || data.beginn_zeit) && (
            <InfoBlock color="yellow" emoji="🕐" title="Zeiten">
              <InfoRow label="Einlass" value={data.einlass_zeit ? data.einlass_zeit + ' Uhr' : null} />
              <InfoRow label="Beginn" value={data.beginn_zeit ? data.beginn_zeit + ' Uhr' : null} />
            </InfoBlock>
          )}
          {data.programmablauf && (
            <InfoBlock color="blue" emoji="📋" title="Programmablauf">
              <p className="text-sm text-foreground whitespace-pre-line">{data.programmablauf}</p>
            </InfoBlock>
          )}
          {data.dresscode && (
            <InfoBlock color="pink" emoji="👗" title="Dresscode">
              <p className="text-sm text-foreground">{data.dresscode}</p>
            </InfoBlock>
          )}
        </>
      )}

      {data.hinweise && (
        <InfoBlock color="gray" emoji="📝" title="Allgemeine Hinweise">
          <p className="text-sm text-foreground whitespace-pre-line">{data.hinweise}</p>
        </InfoBlock>
      )}
      {data.kontakt_vor_ort && (
        <InfoBlock color="green" emoji="📞" title="Ansprechpartner vor Ort">
          <p className="text-sm text-foreground">{data.kontakt_vor_ort}</p>
        </InfoBlock>
      )}
    </div>
  );
}