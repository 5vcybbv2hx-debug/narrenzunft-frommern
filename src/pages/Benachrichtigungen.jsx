import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Check, Info, Award, Briefcase, Calendar, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const TYP_ICONS = {
  'Info': Info,
  'Warnung': Info,
  'Ehrung': Award,
  'Arbeitsdienst': Briefcase,
  'Veranstaltung': Calendar,
  'Beitrag': CreditCard,
};

const TYP_COLORS = {
  'Info': 'text-blue-400 bg-blue-500/10',
  'Warnung': 'text-yellow-400 bg-yellow-500/10',
  'Ehrung': 'text-yellow-400 bg-yellow-500/10',
  'Arbeitsdienst': 'text-orange-400 bg-orange-500/10',
  'Veranstaltung': 'text-primary bg-primary/10',
  'Beitrag': 'text-red-400 bg-red-500/10',
};

export default function Benachrichtigungen() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Benachrichtigung.list('-created_date', 100);
      setNotifs(data);
    } catch (e) {}
    setLoading(false);
  };

  const markRead = async (id) => {
    try {
      await base44.entities.Benachrichtigung.update(id, { gelesen: true });
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, gelesen: true } : n));
    } catch (e) {}
  };

  const markAllRead = async () => {
    try {
      const unread = notifs.filter(n => !n.gelesen);
      await Promise.all(unread.map(n => base44.entities.Benachrichtigung.update(n.id, { gelesen: true })));
      setNotifs(prev => prev.map(n => ({ ...n, gelesen: true })));
    } catch (e) {}
  };

  const unreadCount = notifs.filter(n => !n.gelesen).length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Benachrichtigungen</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{unreadCount} ungelesen</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            <Check size={14} /> Alle lesen
          </button>
        )}
      </div>

      <div className="space-y-2">
        {notifs.map(n => {
          const Icon = TYP_ICONS[n.typ] || Info;
          const colorClass = TYP_COLORS[n.typ] || 'text-blue-400 bg-blue-500/10';
          return (
            <div
              key={n.id}
              className={`bg-card border rounded-xl p-4 flex gap-3 transition-all ${
                !n.gelesen ? 'border-primary/30' : 'border-border'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${!n.gelesen ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {n.titel}
                </p>
                {n.nachricht && (
                  <p className="text-xs text-muted-foreground mt-0.5">{n.nachricht}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(n.created_date), 'dd. MMM yyyy, HH:mm', { locale: de })}
                </p>
              </div>
              {!n.gelesen && (
                <button
                  onClick={() => markRead(n.id)}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground shrink-0"
                >
                  <Check size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {notifs.length === 0 && (
        <div className="text-center py-12">
          <Bell size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Benachrichtigungen</p>
        </div>
      )}
    </div>
  );
}