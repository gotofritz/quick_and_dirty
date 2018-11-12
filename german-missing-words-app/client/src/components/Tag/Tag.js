import React from 'react';

export default ({ typed = '', text = '', isUsed = false }) => {
  const enabled = !isUsed && typed === text.substr(0, typed.length);
  const prefix = enabled ? typed : '';
  const postfix = enabled ? text.substr(typed.length) : text;
  const className = `tag ${isUsed || !enabled ? 'disabled ' : ''} ${
    isUsed ? 'guessed' : ''
  }`;
  return (
    <span className={className}>
      <span className="typed">{prefix}</span>
      {postfix}
    </span>
  );
};
