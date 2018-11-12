import React, { Component } from 'react';

import TextBlocks from '../components/TextBlocks/TextBlocks';
import './App.css';

const isGuessable = i => i % 2 === 1;
const makeTag = (text, id) => {
  return {
    id,
    text,
    isGuessable: true,
    guess: '',
    isUsed: false,
    lastId: -1,
  };
};

class App extends Component {
  // once the text is loaded it is split and saved here - so that it can be
  // easily reset later
  initialBlocks = [];
  initialTags = [];

  // there are some fake tags meant to confuse
  fillers = [];

  state = {
    blocks: [],
    tags: [],
    typed: '',
    lastTyped: '',
    percentage: -1,
  };

  makeTags(blocks = this.initialBlocks) {
    let tags = this.fillers
      .map(block => ({
	onBlur: this.onBlur.bind(null, block.id),
	onChange: this.onChange.bind(null, block.id),
	onFocus: this.onFocus.bind(null, block.id),
	...block,
      }))
      .concat(
	blocks.filter(block => block.isGuessable).map(block => ({
	  onBlur: this.onBlur.bind(null, block.id),
	  onChange: this.onChange.bind(null, block.id),
	  onFocus: this.onFocus.bind(null, block.id),
	  ...block,
	})),
      );
    tags.sort((a, b) => (a.text.toLowerCase() < b.text.toLowerCase() ? -1 : 1));
    return tags;
  }

  // creates a blank state
  initState() {
    const state = {
      typed: '',
      percentage: -1,
      blocks: this.initialBlocks.map(block => ({
	onBlur: this.onBlur.bind(null, block.id),
	onChange: this.onChange.bind(null, block.id),
	onFocus: this.onFocus.bind(null, block.id),
	...block,
      })),
    };
    state.tags = this.makeTags(state.blocks);
    this.setState(state);
  }

  // placeholder
  loadText() {
    return fetch('/api').then(res => res.json());
  }

  // the input element is a controlled element; this is the function that
  // updates it
  updateGuess = (id, typed) => {
    this.setState(prevState => {
      const blocks = [...prevState.blocks];
      blocks[id].guess = typed;
      return { blocks, typed };
    });
  };

  // For now the tags are mixed with the normal text blocks - not a long term
  // solution, but it makes no sense to optimise prematurely. This allows you to
  // find tags and pass a series of criteria (like 'where' in _.find)
  // You can also order it and select just one
  getTags = ({ predicate, single } = {}) => {
    let tags = this.state.tags;
    if (predicate) {
      // runs every test in predicate on block and returns true if they all pass
      const onlyTheseBlocks = block => {
	return Object.entries(predicate).every(([k, v]) => block[k] === v);
      };
      tags = tags.filter(onlyTheseBlocks);
    }
    return single ? tags[0] : tags;
  };

  // starts everything
  componentDidMount() {
    this.loadText().then(t => {
      this.fillers = t.fillers.map((filler, i) => makeTag(filler, i + 1000));
      this.initialBlocks = t.text.split(/[[\]]{2,2}/).map(
	(el, i) =>
	  isGuessable(i)
	    ? makeTag(el, i)
	    : {
		id: i,
		text: el,
	      },
      );
      this.initState();
    });
  }

  // basic controlled form input
  onChange = (id, e) => {
    // no trim here - you are still in the middle of typing, the space may be
    // important
    this.updateGuess(id, e.target.value.toLowerCase());
  };

  // Saved the content of the form field at the start to restore it if needed,
  // or to otherwsie manage it
  onFocus = (id, e) => {
    const typed = e.target.value || '';
    this.setState(prevState => ({
      lastTyped: typed,
      typed,
    }));
  };

  // Goes through all the fields and works out with one is correct and which one isn't
  onClickSolution = e => {
    this.setState(prevState => {
      let correctOnes = 0;
      let numberOfTags = 0;

      const blocks = prevState.blocks.map(block => {
	if (!block.isGuessable) return block;

	numberOfTags += 1;
	const newBlock = { ...block };
	if (block.guess === block.text) {
	  newBlock.correct = true;
	  correctOnes += 1;
	} else {
	  newBlock.correct = false;
	  newBlock.guess = `${newBlock.guess} (${newBlock.text})`;
	}
	return newBlock;
      });
      const percentage = Number(correctOnes * 100 / numberOfTags).toFixed(1);
      return { typed: '', blocks, percentage };
    });
  };

  onReset = () => {
    this.initState();
  };

  // Does most of the work. See if what you've typed is legit, whether it was
  // already used, and updates state accortdinglu
  onBlur = (id, e) => {
    const typed = this.state.typed.trim();
    if (typed === this.state.lastTyped) return;

    let foundTag;
    let isUsed;
    if (typed === '') {
      // the user may have deleted an existing entry, then we may need to clean up
      foundTag = this.getTags({
	predicate: { text: this.state.lastTyped },
	single: true,
      });
      isUsed = false;
    } else {
      // trying to work out whether user has typed something useful
      foundTag = this.getTags({
	predicate: { text: typed },
	single: true,
      });
      isUsed = true;
    }

    this.setState(prevState => {
      const newState = { typed: '' };
      newState.blocks = [...prevState.blocks];
      newState.tags = this.makeTags(newState.blocks);
      // somewhing was changed; we need to deal with i
      if (foundTag) {
	newState.blocks[id].guess = typed;
	// we need to check becuase the fake tags are not found this way
	if (newState.blocks[foundTag.id]) {
	  newState.blocks[foundTag.id].isUsed = isUsed;
	  newState.blocks[foundTag.id].lastId = id;
	}
	// if the tag was already used elsewhere, we clear the old usage
	if (foundTag.lastId >= 0) {
	  newState.blocks[foundTag.lastId].guess = '';
	}

	// nothing useful was typed, we restore last entry
      } else {
	newState.blocks[id].guess = this.state.lastTyped;
      }
      return newState;
    });
  };

  // For the part of the UI with the text in it
  renderText = blocks =>
    blocks.map(
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
    );

  renderTags = tags =>
    tags.map(tag => (
      <Tag
	key={tag.id}
	text={tag.text.toLowerCase()}
	typed={this.state.typed}
	isUsed={tag.isUsed}
      />
    ));

  render() {
    return (
      <div className="app">
	<TextBlocks />
	<div className="text">{this.renderText(this.state.blocks)}</div>
	<div className="side">
	  <Solution
	    onClick={this.onClickSolution}
	    onReset={this.onReset}
	    percentage={this.state.percentage}
	  />
	  {this.renderTags(this.state.tags)}
	</div>
      </div>
    );
  }
}

function Solution(props) {
  return (
    <div className="solution">
      {props.percentage < 0 ? (
	<button onClick={props.onClick}>Solution</button>
      ) : (
	<React.Fragment>
	  {props.percentage}% correct{' '}
	  <button onClick={props.onReset}>Reset</button>
	</React.Fragment>
      )}
    </div>
  );
}

function GuessBox(props) {
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
}

function NormalText({ text }) {
  return <span className="normal">{text}</span>;
}

function BlankSpace() {
  return <div className="blank" />;
}

function Tag({ typed = '', text = '', isUsed = false }) {
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
}

export default App;
