import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Copy, RefreshCw, X, Loader2 } from 'lucide-react';

export default function HaesGroupTokenModal({ gruppe, onClose }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadToken();
  }, [gruppe.id]);

  const loadToken = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('generateHaesGroupToken', {
        haesgruppe_id: gruppe.id,
        regenerate: false
      });
      setToken(res.data);
    } catch (e) {}
    setLoading(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await base44.functions.invoke('generateHaesGroupToken', {
        haesgruppe_id: gruppe.id,
        regenerate: true
      });
      setToken(res.data);
    } catch (e) {}
    setRegenerating(false);
  };

  const handleCopy = () => {
    if (token?.url) {
      navigator.clipboard.writeText(token.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">📅 Kalender-Feed: {gruppe.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-[3px] border-border border-t-primary rounded-full animate-spin" />
          </div>
        ) : token ? (
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-xs text-blue-400 font-semibold mb-2">📲 ICS-KALENDER-URL</p>
              <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2">
                <code className="text-xs text-foreground flex-1 truncate font-mono">{token.url}</code>
                <button onClick={handleCopy} className="p-2 rounded-lg text-muted-foreground hover:text-primary transition-colors shrink-0">
                  {copied ? <span className="text-green-400 text-xs">✓</span> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold">📌 VERWENDUNG:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>✓ Link in Outlook, Google Calendar oder Thunderbird einfügen</li>
                <li>✓ Alle öffentlichen Termine dieser Häsgruppe werden angezeigt</li>
                <li>✓ Automatisch aktualisiert (stündlich)</li>
                <li>✓ Token ist eindeutig – nicht öffentlich teilen</li>
              </ul>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
              <p className="text-xs text-yellow-400">
                ⚠️ Token regenerieren erzeugt eine neue URL. Die alte URL funktioniert dann nicht mehr.
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">
                Schließen
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
              >
                {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {regenerating ? 'Generiere...' : 'Neu generieren'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Token konnte nicht geladen werden</p>
        )}
      </div>
    </div>
  );
}