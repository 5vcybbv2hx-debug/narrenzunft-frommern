import React from 'react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      <div className="max-w-sm w-full">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center shadow-xl shadow-primary/30">
            <span className="text-3xl">🎭</span>
          </div>
        </div>
        {/* Vereinsname */}
        <div className="text-center mb-8">
          <h1 className="font-oswald font-semibold text-foreground text-2xl uppercase tracking-widest">
            Narrenzunft
          </h1>
          <p className="text-primary text-sm font-semibold uppercase tracking-[0.3em]">Frommern</p>
        </div>

        {/* Fehlerkarte */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-base mb-1">Kein Zugang</h2>
              <p className="text-sm text-muted-foreground">
                Dein Account ist noch nicht mit einem Mitgliedsprofil verknüpft.
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground border-t border-border pt-4">
            Wende dich an den Vorstand oder Administrator der Narrenzunft Frommern.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
