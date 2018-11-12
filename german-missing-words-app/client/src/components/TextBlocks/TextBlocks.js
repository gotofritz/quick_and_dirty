import React from 'react';
import { connect } from 'react-redux';

import BlankSpace from '../BlankSpace/BlankSpace';
import GuessBox from '../GuessBox/GuessBox';
import NormalText from '../NormalText/NormalText';

const mapStateToProps = state => {
  return { blocks: state.blocks };
};

const ConnectedTextBlocks = ({ blocks }) => (
  <div className="text">
    {blocks.map(
      block =>
        block.isGuessable ? (
          <GuessBox
            correct={block.correct}
            guess={block.guess}
            isGuessable={block.isGuessable}
            key={block.id}
            onBlur={block.onBlur}
            onChange={block.onChange}
            onFocus={block.onFocus}
          />
        ) : /^\\n+$/.test(block.text) ? (
          <BlankSpace />
        ) : (
          <NormalText key={block.id} text={block.text} />
        ),
    )}
  </div>
);

const TextBlocks = connect(mapStateToProps)(ConnectedTextBlocks);
export default TextBlocks;
