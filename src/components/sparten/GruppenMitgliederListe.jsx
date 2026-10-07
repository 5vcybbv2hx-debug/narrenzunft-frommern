import { Link } from 'react-router-dom';

/**
 * GruppenMitgliederListe – das komplette Gruppen-Roster aus den Mitglieds-
 * Profilen, gruppiert nach Mitgliedsstatus (Aktiv, Passiv, Kinder,
 * Jugendliche, Ehrenmitglieder, Weitere), mit Kontaktinfo und Profil-Links.
 * Für Tanzgruppen im Teilnehmer-Tab unter der Teilnehmer-Verwaltung, für
 * alle anderen Gruppen im Mitglieder-Tab. Nur für Leitungs-Personen
 * sichtbar — enthält private Kontaktdaten.
 */
export default function GruppenMitgliederListe({ mitglieder, gruppe }) {
  return (
    <>
    {mitglieder.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            Keine Mitglieder in dieser Gruppe eingetragen.
          </div>
        ) : (
          (() => {
            const STATUS_SEKTIONEN = [
              { titel: 'Aktiv',        status: ['Aktiv'] },
              { titel: 'Passiv',        status: ['Passiv', 'Passiv mit Häs', 'Leihäs'] },
              { titel: 'Kinder',        status: ['Kleinkind 0-3', 'Kinder 4-10'] },
              { titel: 'Jugendliche',   status: ['Jugendliche 11-14', 'Jungaktive 15-17'] },
              { titel: 'Ehrenmitglieder', status: ['Ehrenmitglied'] },
            ];
            const erfassteStatus = new Set(STATUS_SEKTIONEN.flatMap(s => s.status));
            const sonstige = mitglieder.filter(m => !erfassteStatus.has(m.mitgliedsstatus) && m.mitgliedsstatus !== 'Verstorben');
            const renderMitglied = (m) => {
              const isSplat = gruppe.verantwortliche_ids?.includes(m.id);
              return (
                <div key={m.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center font-bold text-white font-oswald border border-border">
                      {m.vorname?.[0]}{m.nachname?.[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link to={`/mitglieder/${m.id}`} className="font-semibold text-white text-sm hover:text-primary transition-colors">
                          {m.vorname} {m.nachname}
                        </Link>
                        {isSplat && (
                          <span className="text-[10px] bg-primary/15 border border-primary/40 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                            Leiter
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        {m.ort || 'Kein Wohnort hinterlegt'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    {m.mobiltelefon ? (
                      <span className="text-xs text-muted-foreground font-medium">{m.mobiltelefon}</span>
                    ) : m.email ? (
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{m.email}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Keine Kontaktinfo</span>
                    )}
                  </div>
                </div>
              );
            };
            return (
              <div className="space-y-6">
                {STATUS_SEKTIONEN.map(sektion => {
                  const sm = mitglieder.filter(m => sektion.status.includes(m.mitgliedsstatus));
                  if (sm.length === 0) return null;
                  return (
                    <div key={sektion.titel}>
                      <h3 className="text-sm font-oswald uppercase tracking-wide text-muted-foreground mb-3">
                        {sektion.titel} <span className="text-muted-foreground">({sm.length})</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sm.map(renderMitglied)}
                      </div>
                    </div>
                  );
                })}
                {sonstige.length > 0 && (
                  <div>
                    <h3 className="text-sm font-oswald uppercase tracking-wide text-muted-foreground mb-3">
                      Weitere <span className="text-muted-foreground">({sonstige.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sonstige.map(renderMitglied)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
    )}
    </>
  );
}
