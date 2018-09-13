import React, { Component } from 'react';
import './App.css';

const dummyText = `
Die Grünen sehnen sich [[nach]] Sicherheit. Sie wollen [[die]] Polizei besser ausstatten, eine gute Ausrüstung der Beamten, bessere Revierstrukturen, so steht es in einem Vorstandsbeschluss [[von]] dieser Woche. Sie wollen [[ein]] Europäisches Kriminalamt, dass EKA heißen soll. Sie möchten die Zusammenarbeit [[der]] verschiedenen Länder ausbauen, so steht es [[im]] Europawahlprogramm.

Das klingt [[nun]] so gar nicht nach dem Erbe jener Ökos, die sich in ihrer frühen Zeit kategorisch gegen [[jede]] Form der militärischen Beteiligung Deutschlands an Auslandseinsätzen wandten, die auf Demos Steine warfen und von [[denen]] einige auch mal "Nie wieder Deutschland" skandierten.

Das Image der Partei der radikalen Aktivisten haben sie [[zwar]] abgelegt, dennoch haftet den Grünen ein gewisser "Dagegen"-Charakter [[an]]. Schon immer gab es in der Partei Flügel, die "Fundis" gegen die "Realos". Dass dieser Streit meist in [[aller]] Öffentlichkeit, persönlicher Beleidigungen inklusive, ausgefochten wurde, brachte [[den]] Grünen einen Ruf als mindestens undiszipliniert ein.
`;

const isGuessable = i => i % 2 === 1;

class App extends Component {
  // once the text is loaded it is split and saved here - so that it can be
  // easily reset later
  initialBlocks = [];

  state = {
    blocks: [],
    tags: [],
    typed: '',
    lastTyped: '',
    percentage: -1,
  };

  // creates a blank state
  initState() {
    this.setState({
      typed: '',
      percentage: -1,
      blocks: [
	...this.initialBlocks.map(block => ({
	  onBlur: this.onBlur.bind(null, block.id),
	  onChange: this.onChange.bind(null, block.id),
	  onFocus: this.onFocus.bind(null, block.id),
	  ...block,
	})),
      ],
    });
  }

  // placeholder
  loadText() {
    return Promise.resolve(dummyText);
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
  getTags = ({ predicate = {}, ordered = false, single = false } = {}) => {
    predicate.isGuessable = true;

    // runs every test in predicate on block and returns true if they all pass
    const onlyTheseBlocks = block => {
      return Object.entries(predicate).every(([k, v]) => block[k] === v);
    };
    const tags = this.state.blocks.filter(onlyTheseBlocks);
    if (ordered) {
      tags.sort((a, b) => (a.text < b.text ? -1 : 1));
    }
    return single ? tags[0] : tags;
  };

  // starts everything
  componentDidMount() {
    this.loadText().then(t => {
      this.initialBlocks = t.split(/[[\]]{2,2}/).map(
	(el, i) =>
	  isGuessable(i)
	    ? {
		id: i,
		text: el,
		isGuessable: true,
		guess: '',
		isUsed: false,
		lastId: -1,
	      }
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
    this.updateGuess(id, e.target.value);
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
      // somewhing was changed; we need to deal with i
      if (foundTag) {
	newState.blocks[id].guess = typed;
	newState.blocks[foundTag.id].isUsed = isUsed;
	// if the tag was already used elsewhere, we clear the old usage
	if (foundTag.lastId >= 0) {
	  newState.blocks[foundTag.lastId].guess = '';
	}
	newState.blocks[foundTag.id].lastId = id;

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
	) : (
	  <NormalText key={block.id} text={block.text} />
	),
    );

  renderTags = tags =>
    tags.map(tag => (
      <Tag
	key={tag.id}
	text={tag.text}
	typed={this.state.typed}
	isUsed={tag.isUsed}
      />
    ));

  render() {
    return (
      <div className="app">
	<div className="text">{this.renderText(this.state.blocks)}</div>
	<div className="side">
	  <Solution
	    onClick={this.onClickSolution}
	    onReset={this.onReset}
	    percentage={this.state.percentage}
	  />
	  {this.renderTags(this.getTags({ ordered: true }))}
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
