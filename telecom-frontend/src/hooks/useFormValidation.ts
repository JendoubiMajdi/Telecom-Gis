import React, { useCallback, useMemo, useState } from 'react';
import { FieldErrors, hasErrors, revealFirstInvalid } from '../utils/validation';

interface ServerError {
  message: string;
  value: unknown; // the error disappears as soon as the user changes this field
}

/**
 * Field-level "contrôle de saisie".
 *
 * - Errors are derived from the current values, so they update live while typing.
 * - A field's error is shown once the user has left it with something typed in it,
 *   or after a submit attempt (so empty fields don't turn red while the user is still filling the form).
 * - On submit with errors, the page scrolls smoothly to the first invalid field, focuses it and shakes it.
 */
export function useFormValidation<V extends Record<string, any>, K extends keyof V & string = keyof V & string>(
  values: V,
  validate: (values: V) => FieldErrors<K>,
  idPrefix = ''
) {
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<K, ServerError>>>({});

  const allErrors = useMemo(() => {
    const errs: FieldErrors<K> = { ...validate(values) };
    (Object.keys(serverErrors) as K[]).forEach(k => {
      const s = serverErrors[k];
      if (s && !errs[k] && values[k] === s.value) errs[k] = s.message;
    });
    return errs;
  }, [values, validate, serverErrors]);

  const id = useCallback((name: K) => `${idPrefix}${name}`, [idPrefix]);

  const error = useCallback(
    (name: K): string | undefined => (submitted || touched[name] ? allErrors[name] || undefined : undefined),
    [allErrors, submitted, touched]
  );

  const touch = useCallback((name: K) => setTouched(t => (t[name] ? t : { ...t, [name]: true })), []);

  /** Props to spread on an <input>/<select>/<textarea>. */
  const field = useCallback(
    (name: K) => ({
      id: id(name),
      name,
      'aria-invalid': !!error(name),
      'aria-describedby': error(name) ? `${id(name)}-error` : undefined,
      onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (e.target.value !== '') touch(name);
      },
    }),
    [id, error, touch]
  );

  /** Props for <FieldError />. */
  const errorProps = useCallback((name: K) => ({ id: `${id(name)}-error`, message: error(name) }), [id, error]);

  /** 'field-invalid' when the field should be shown in red. */
  const invalid = useCallback((name: K) => (error(name) ? 'field-invalid' : ''), [error]);

  /** Runs every rule. Returns true when the form is valid, otherwise takes the user to the first bad field. */
  const validateAll = useCallback((): boolean => {
    setSubmitted(true);
    if (!hasErrors(allErrors)) return true;
    revealFirstInvalid((Object.keys(allErrors) as K[]).filter(k => allErrors[k]).map(id));
    return false;
  }, [allErrors, id]);

  /** Attach a message coming from the API to a field (cleared when that field is edited). */
  const setServerError = useCallback(
    (name: K, message: string) => {
      setServerErrors(s => ({ ...s, [name]: { message, value: values[name] } }));
      setSubmitted(true);
      revealFirstInvalid([id(name)]);
    },
    [values, id]
  );

  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
  }, []);

  return { field, error, errorProps, invalid, validateAll, setServerError, reset, touch, id };
}
