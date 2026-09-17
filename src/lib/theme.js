// Hell-/Dunkel-Theme der App. Standard ist Dunkel (Vereins-Branding),
// Light ist ein Opt-in pro Gerät — bewusst KEINE Systemerkennung, damit
// das Theme immer vorhersagbar ist.
const KEY = 'nzf-theme';

export function initTheme() {
  try {
    if (localStorage.getItem(KEY) === 'light') {
      document.documentElement.classList.add('light');
    }
  } catch { /* localStorage blockiert -> Dunkel-Default */ }
}

export function getTheme() {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* Speichern optional */ }
  document.documentElement.classList.toggle('light', theme === 'light');
}
