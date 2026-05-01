import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

/**
 * MobileSelect – on mobile renders a native bottom-sheet Drawer picker.
 * On desktop falls back to a styled <select>.
 *
 * Props:
 *   value        – current value
 *   onChange     – (value: string) => void
 *   options      – string[] | { label: string; value: string }[]
 *   placeholder  – string (optional)
 *   className    – extra classes for the trigger button (optional)
 *   label        – title shown in the drawer header (optional)
 */
export default function MobileSelect({ value, onChange, options = [], placeholder = 'Auswählen...', className = '', label }) {
  const [open, setOpen] = useState(false);

  const normalised = options.map(o =>
    typeof o === 'string' ? { label: o, value: o } : o
  );

  const selected = normalised.find(o => o.value === value);
  const isMobile = window.matchMedia('(max-width: 1023px)').matches;

  if (!isMobile) {
    return (
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary ${className}`}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {normalised.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary min-h-[44px] ${className}`}
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="text-muted-foreground shrink-0" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border">
          {label && (
            <DrawerHeader className="border-b border-border pb-3">
              <DrawerTitle className="text-foreground text-base">{label}</DrawerTitle>
            </DrawerHeader>
          )}
          <div className="py-2 pb-safe overflow-y-auto max-h-[60vh]">
            {normalised.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full flex items-center justify-between px-5 py-4 text-sm text-foreground hover:bg-secondary active:bg-secondary transition-colors min-h-[52px]"
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={16} className="text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}