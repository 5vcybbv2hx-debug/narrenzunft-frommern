import { Calendar, Bus, ShoppingBag, Briefcase, Shirt, Users } from 'lucide-react';
import HubPage from '@/components/HubPage';

export default function Aktivitaeten() {
  const items = [
    { path: '/kalender', label: 'Veranstaltungen', icon: Calendar, roles: null, description: 'Termine & Veranstaltungen' },
    { path: '/ausfahrten', label: 'Ausfahrten', icon: Bus, roles: null, description: 'Bus-Anmeldungen' },
    { path: '/sparten', label: 'Sparten & Gruppen', icon: Users, roles: null, description: 'Häs- und Tanzgruppen' },
    { path: '/haes', label: 'Häs', icon: Shirt, roles: null, description: 'Häs-Verwaltung' },
    { path: '/shop', label: 'Shop', icon: ShoppingBag, roles: null, description: 'Zunftbekleidung' },
    { path: '/arbeitsdienste', label: 'Arbeitsdienste', icon: Briefcase, roles: null, description: 'Dienste & Stunden' },
  ];
  return <HubPage title="Aktivitäten" subtitle="Veranstaltungen, Ausfahrten, Häs und mehr" items={items} />;
}
