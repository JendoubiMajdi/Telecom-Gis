// ── Contrôle de saisie: shared rules + "take the user to the field" helpers ────

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PASSWORD_MIN = 6; // same minimum as the backend

export const hasErrors = (errors: FieldErrors): boolean => Object.values(errors).some(Boolean);

// Each rule returns an error message, or '' when the value is fine.
export const rules = {
  required: (v: string, label: string): string => (v.trim() ? '' : `${label} is required`),

  email: (v: string): string => {
    if (!v.trim()) return 'Email address is required';
    if (!EMAIL_RE.test(v.trim())) return 'Enter a valid email address (e.g. name@company.com)';
    return '';
  },

  fullName: (v: string): string => {
    const name = v.trim();
    if (!name) return 'Full name is required';
    if (name.length < 2) return 'Full name must be at least 2 characters';
    if (name.length > 100) return 'Full name must be 100 characters or fewer';
    if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(name)) return 'Full name can only contain letters, spaces, apostrophes and hyphens';
    return '';
  },

  password: (v: string, label = 'Password'): string => {
    if (!v) return `${label} is required`;
    if (v.length < PASSWORD_MIN) return `${label} must be at least ${PASSWORD_MIN} characters`;
    if (v.length > 128) return `${label} must be 128 characters or fewer`;
    return '';
  },

  confirm: (v: string, original: string): string => {
    if (!v) return 'Please confirm the password';
    if (v !== original) return 'Passwords do not match';
    return '';
  },

  maxLength: (v: string, max: number, label: string): string =>
    v.trim().length > max ? `${label} must be ${max} characters or fewer` : '',

  // Numbers are kept as strings while the user types, so "empty" can be told apart from 0.
  number: (v: string, label: string, opts: { min?: number; max?: number; integer?: boolean; required?: boolean } = {}): string => {
    const raw = v.trim();
    if (!raw) return opts.required ? `${label} is required` : '';
    const n = Number(raw);
    if (!Number.isFinite(n)) return `${label} must be a number`;
    if (opts.integer && !Number.isInteger(n)) return `${label} must be a whole number`;
    if (opts.min !== undefined && opts.max !== undefined && (n < opts.min || n > opts.max)) {
      return `${label} must be between ${opts.min} and ${opts.max}`;
    }
    if (opts.min !== undefined && n < opts.min) return `${label} must be at least ${opts.min}`;
    if (opts.max !== undefined && n > opts.max) return `${label} must be at most ${opts.max}`;
    return '';
  },
};

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Replays the shake animation even if the element is already shaking.
export const shake = (el: HTMLElement | null): void => {
  if (!el || prefersReducedMotion()) return;
  el.classList.remove('field-shake');
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add('field-shake');
  el.addEventListener('animationend', () => el.classList.remove('field-shake'), { once: true });
};

// Smoothly scrolls an element into the middle of the view (works inside scrollable modals too).
export const reveal = (el: HTMLElement | null): void => {
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
};

// Fields are disabled while a request is running: wait (up to ~1s) for them to be enabled again.
const focusWhenEnabled = (el: HTMLElement, framesLeft = 60): void => {
  if (!(el as HTMLInputElement).disabled) {
    el.focus({ preventScroll: true });
  } else if (framesLeft > 0) {
    requestAnimationFrame(() => focusWhenEnabled(el, framesLeft - 1));
  }
};

// Scrolls to, focuses and shakes a field. `focus({ preventScroll })` keeps the smooth scroll intact.
export const revealField = (el: HTMLElement | null): void => {
  if (!el) return;
  reveal(el);
  focusWhenEnabled(el);
  shake(el);
};

// Among the given element ids, reveals the one that comes first on the page (top → bottom).
export const revealFirstInvalid = (ids: string[]): void => {
  const els = ids
    .map(id => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el);
  if (els.length === 0) return;
  els.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  // wait one frame so freshly rendered error messages are laid out before we centre the field
  requestAnimationFrame(() => revealField(els[0]));
};
