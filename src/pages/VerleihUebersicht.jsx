import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle, Snowflake, Truck, Tent, Plug, Package, Wine, Euro, ChevronRight } from 'lucide-react';

const KATEGORIE_ICONS = {
  'Anhänger': Truck, 'Kühlanhänger': Snowflake, 'Bar': Wine,
  'Zelt': Tent, 'Technik': Plug, 'Sonstiges': Package,
};

const euro = (v) => Number(v || 0).toFixed(2).replace('.', ',') + ' €';

export default function VerleihUebersicht() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getVerleihListe', {});
        if (res.data?.error) {
          setFehler(res.data.error);
        } else {
          setItems(res.data?.liste || []);
        }
      } catch (e) {
        setFehler('Liste konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center px-4 py-8">
      {/* Kopf */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto rounded-xl bg-[#EA2525] flex items-center justify-center shadow-xl shadow-red-900/30">
          <span className="text-2xl">🎭</span>
        </div>
        <p className="font-oswald font-semibold text-white text-lg uppercase tracking-widest mt-2">Narrenzunft</p>
        <p className="text-[#EA2525] text-[10px] font-semibold uppercase tracking-[0.3em]">Frommern</p>
      </div>

      <div className="w-full max-w-md">
        <h1 className="font-oswald uppercase text-xl text-white text-center mb-1">Verleih-Anfrage</h1>
        <p className="text-sm text-gray-400 text-center mb-5">
          Wählt einen Gegenstand aus und stellt eine Anfrage — der Vorstand meldet sich bei euch.
        </p>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={28} className="animate-spin text-[#EA2525]" />
            <p className="text-sm text-gray-400">Wird geladen…</p>
          </div>
        )}

        {fehler && !loading && (
          <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-5 text-center">
            <AlertCircle size={28} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400">{fehler}</p>
          </div>
        )}

        {!loading && !fehler && items.length === 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
            <Package size={32} className="text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aktuell sind keine Gegenstände für den Verleih freigegeben.</p>
          </div>
        )}

        {!loading && !fehler && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = KATEGORIE_ICONS[item.kategorie] || Package;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/verleih/${item.id}`)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden hover:border-[#EA2525]/50 transition-colors text-left group"
                >
                  <div className="flex items-stretch">
                    {item.bild_url ? (
                      <img src={item.bild_url} alt={item.name} className="w-24 h-24 object-cover shrink-0" />
                    ) : (
                      <div className="w-24 h-24 shrink-0 bg-black/40 flex items-center justify-center">
                        <Icon size={28} className="text-[#EA2525]" />
                      </div>
                    )}
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="font-oswald uppercase text-base text-white leading-tight truncate">{item.name}</h2>
                          <p className="text-xs text-gray-500">{item.kategorie}</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-600 group-hover:text-[#EA2525] shrink-0 mt-0.5 transition-colors" />
                      </div>
                      {item.beschreibung && (
                        <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{item.beschreibung}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {item.preis > 0 && (
                          <span className="text-xs text-gray-300 flex items-center gap-1">
                            <Euro size={11} /> {euro(item.preis)} / Tag
                          </span>
                        )}
                        {item.kaution > 0 && (
                          <span className="text-xs text-gray-500">Kaution: {euro(item.kaution)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-gray-600 text-center mt-6 leading-relaxed">
          Eure Daten werden nur zur Bearbeitung der Anfrage verwendet.
        </p>
      </div>
    </div>
  );
}