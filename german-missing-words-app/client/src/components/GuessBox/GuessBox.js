import React from 'react';

export default props => {
  const className = `guessable ${
    props.correct === true
      ? 'correct'
      : props.correct === false ? 'wrong' : 'unsure'
  }`;
  return (
    <div className={className}>
      <input
        type="text"
        value={props.guess}
        onChange={props.onChange}
        onBlur={props.onBlur}
        onFocus={props.onFocus}
      />
    </div>
  );
};
