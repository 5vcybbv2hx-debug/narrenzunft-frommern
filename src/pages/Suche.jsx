import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams } from 'react-router-dom';
import SecureSearch from '@/components/SecureSearch';

export default function Suche() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Suche</h1>
        <p className="text-sm text-muted-foreground">Finde Mitglieder, Häs und Arbeitsdienste (nur zugängliche Daten)</p>
      </div>

      <div className="w-full max-w-md mb-6">
        <SecureSearch />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 text-center text-muted-foreground text-sm">
        <p>Gib mindestens 2 Zeichen ein um zu suchen.</p>
      </div>
    </div>
  );
}