import { ClipboardList, Users, Award, CreditCard, ShoppingBag, Users2 } from 'lucide-react';
import HubPage from '@/components/HubPage';

export default function VerwaltungHub() {
  const items = [
    { path: '/vorstand', label: 'Führungs-Dashboard', icon: ClipboardList, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'], description: 'Übersicht & Kennzahlen' },
    { path: '/mitglieder', label: 'Mitglieder', icon: Users, roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'spartenleiter', 'admin'], description: 'Mitgliederverwaltung' },
    { path: '/beitraege', label: 'Beiträge', icon: CreditCard, roles: ['vorstand', 'stellv_vorstand', 'kassierer', 'admin'], description: 'Zahlungen & Status' },
    { path: '/ehrungen', label: 'Ehrungen', icon: Award, roles: ['vorstand', 'stellv_vorstand', 'admin'], description: 'Auszeichnungen' },
    { path: '/shop/verwaltung', label: 'Shop-Verwaltung', icon: ShoppingBag, roles: ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'], description: 'Artikel & Bestellungen' },
    { path: '/vereine', label: 'Vereine & Zünfte', icon: Users2, roles: ['vorstand', 'stellv_vorstand', 'admin'], description: 'Partner-Vereine' },
  ];
  return <HubPage title="Verwaltung" subtitle="Mitglieder, Beiträge, Ehrungen und mehr" items={items} />;
}
