import React from 'react';

// Inline message shown under a field that failed the "contrôle de saisie".
const FieldError: React.FC<{ id?: string; message?: string }> = ({ id, message }) =>
  message ? (
    <div id={id} className="field-error-msg" role="alert">
      <span className="field-error-icon" aria-hidden="true">!</span>
      {message}
    </div>
  ) : null;

export default FieldError;
