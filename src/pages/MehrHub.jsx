import {
  Lock, CheckSquare, Package, AlertTriangle, Shield,
  FileText, Users, Bell, Search, MessageSquare, Calendar
} from 'lucide-react';
import HubPage from '@/components/HubPage';

export default function MehrHub() {
  const items = [
    { path: '/kalender', label: 'Kalender', icon: Calendar, roles: null, description: 'Monats- & Listenansicht' },
    { path: '/ausschuss', label: 'Ausschussbereich', icon: Lock, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'], zusatz: ['ausschuss'], description: 'Sitzungen & Protokolle' },
    { path: '/todos', label: 'Aufgaben', icon: CheckSquare, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'], zusatz: ['todos'], description: 'To-Do-Liste' },
    { path: '/inventar', label: 'Inventar & Verleih', icon: Package, roles: ['vorstand', 'stellv_vorstand', 'admin'], zusatz: ['inventar'], description: 'Verleih-Verwaltung' },
    { path: '/mitgliedsantraege', label: 'Mitgliedsanträge', icon: FileText, roles: ['vorstand', 'stellv_vorstand', 'admin'], description: 'Anträge prüfen' },
    { path: '/datenqualitaet', label: 'Datenqualität', icon: AlertTriangle, roles: ['vorstand', 'stellv_vorstand', 'admin'], description: 'Daten-Prüfung' },
    { path: '/berechtigungen', label: 'Berechtigungen', icon: Shield, roles: ['admin', 'vorstand', 'stellv_vorstand'], description: 'Rollen & Rechte' },
    { path: '/familie', label: 'Familie', icon: Users, roles: ['elternkonto'], description: 'Familien-Dashboard' },
    { path: '/benachrichtigungen', label: 'Benachrichtigungen', icon: Bell, roles: null, description: 'Meldungen' },
    { path: '/nachrichten', label: 'Nachrichten', icon: MessageSquare, roles: null, description: 'Postfach' },
    { path: '/suche', label: 'Suche', icon: Search, roles: null, description: 'Mitglieder & mehr' },
  ];
  return <HubPage title="Mehr" subtitle="Ausschuss, Inventar, System und weitere Bereiche" items={items} />;
}
