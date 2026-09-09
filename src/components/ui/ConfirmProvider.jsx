import React, { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

/**
 * Globaler Promise-basierter Bestätigungs-Dialog (Design-System-Stil).
 *
 * Nutzung (überall, ohne Hook):
 *   import { confirmDialog } from '@/components/ui/ConfirmProvider';
 *   ...
 *   if (!(await confirmDialog('Dies wirklich löschen?')))) return;
 *   // oder mit Optionen:
 *   if (!(await confirmDialog({ title: 'Löschen?', message: '...', confirmLabel: 'Löschen' })))) return;
 *
 * Der Provider (in App.jsx) registriert die UI-Implementierung;
 * ohne Provider fällt confirmDialog auf window.confirm() zurück.
 */

let impl = (options) => {
  const opts = typeof options === 'string' ? { message: options } : (options || {});
  return Promise.resolve(window.confirm(opts.message || opts.title || 'Sicher?'));
};

export async function confirmDialog(options) {
  return impl(options);
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  useEffect(() => {
    impl = (options) => {
      const opts = typeof options === 'string' ? { message: options } : (options || {});
      return new Promise((resolve) => {
        setState({
          title: opts.title || (opts.danger === false ? 'Bestätigen' : 'Sicher?'),
          message: opts.message || '',
          danger: opts.danger !== false, // Standard: destruktiv
          confirmLabel: opts.confirmLabel || (opts.danger === false ? 'OK' : 'Löschen'),
          cancelLabel: opts.cancelLabel || 'Abbrechen',
          resolve,
        });
      });
    };
    return () => {
      impl = (options) => {
        const opts = typeof options === 'string' ? { message: options } : (options || {});
        return Promise.resolve(window.confirm(opts.message || opts.title || 'Sicher?'));
      };
    };
  }, []);

  const close = (result) => {
    if (state?.resolve) state.resolve(result);
    setState(null);
  };

  const Icon = state?.danger ? (state.confirmLabel === 'Löschen' ? Trash2 : AlertTriangle) : HelpCircle;

  return (
    <>
      {children}
      <AlertDialog open={!!state} onOpenChange={(open) => { if (!open) close(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5">
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                state?.danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
              }`}>
                <Icon size={17} />
              </span>
              {state?.title}
            </AlertDialogTitle>
            {state?.message && (
              <AlertDialogDescription className="whitespace-pre-line">{state.message}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="min-h-[44px] mt-0" onClick={() => close(false)}>
              {state?.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              className={`min-h-[44px] ${state?.danger ? 'bg-destructive text-white hover:bg-destructive/90' : ''}`}
              onClick={(e) => { e.preventDefault(); close(true); }}
            >
              {state?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
