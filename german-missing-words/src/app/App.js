import React, { Component } from 'react';
import './App.css';

const dummyText = `
Die Grünen sehnen sich [[nach]] Sicherheit. Sie wollen [[die]] Polizei besser ausstatten, eine gute Ausrüstung der Beamten, bessere Revierstrukturen, so steht es in einem Vorstandsbeschluss [[von]] dieser Woche. Sie wollen [[ein]] Europäisches Kriminalamt, dass EKA heißen soll. Sie möchten die Zusammenarbeit [[der]] verschiedenen Länder ausbauen, so steht es [[im]] Europawahlprogramm.

Das klingt [[nun]] so gar nicht nach dem Erbe jener Ökos, die sich in ihrer frühen Zeit kategorisch gegen [[jede]] Form der militärischen Beteiligung Deutschlands an Auslandseinsätzen wandten, die auf Demos Steine warfen und von [[denen]] einige auch mal "Nie wieder Deutschland" skandierten.

Das Image der Partei der radikalen Aktivisten haben sie [[zwar]] abgelegt, dennoch haftet den Grünen ein gewisser "Dagegen"-Charakter [[an]]. Schon immer gab es in der Partei Flügel, die "Fundis" gegen die "Realos". Dass dieser Streit meist in [[aller]] Öffentlichkeit, persönlicher Beleidigungen inklusive, ausgefochten wurde, brachte [[den]] Grünen einen Ruf als mindestens undiszipliniert ein.
`;

const isGuessable = i => i % 2 === 1;

class App extends Component {
  initialState = {
    blocks: [],
    tags: [],
    typed: '',
    percentage: -1,
  };
  state = {
    blocks: [],
    tags: [],
    typed: '',
    percentage: -1,
  };

  componentDidMount() {
    Promise.resolve(dummyText).then(t => {
      const blocks = t.split(/[[\]]{2,2}/).map((el, i) => {
        const id = i;
        let block = {
          id,
          text: el,
        };
        if (isGuessable(i)) {
          block = {
            isGuessable: true,
            onBlur: this.onBlur.bind(null, id),
            onChange: this.onChange.bind(null, id),
            guess: '',
            ...block,
          };
        }
        return block;
      });
      const tags = blocks
        .filter(tag => tag.isGuessable)
        .map(tag => ({ id: tag.id, text: tag.text }));
      tags.sort((a, b) => (a.text < b.text ? -1 : 1));
      this.setState({ blocks, tags });
      this.initialState.blocks = blocks.map(block => ({ ...block }));
      this.initialState.tags = tags.map(tag => ({ ...tag }));
    });
  }

  onChange = (id, e) => {
    const typed = e.target.value;
    this.setState(prevState => {
      const blocks = [...prevState.blocks];
      blocks[id].guess = typed;
      return { blocks, typed };
    });
  };

  onClickSolution = e => {
    this.setState(prevState => {
      let correct = 0;
      const blocks = prevState.blocks.map(block => {
        const newBlock = { ...block };
        if (!block.isGuessable) return newBlock;
        if (block.guess === block.text) {
          newBlock.correct = true;
          correct++;
        } else {
          newBlock.correct = false;
          newBlock.guess = `${newBlock.guess} (${newBlock.text})`;
        }
        return newBlock;
      });
      const percentage = Number(correct * 100 / this.state.tags.length).toFixed(
        1,
      );
      return { typed: '', blocks, percentage };
    });
  };

  onReset = () => {
    this.setState({
      blocks: this.initialState.blocks.map(block => ({ ...block })),
      tags: this.initialState.tags.map(tag => ({ ...tag })),
    });
  };

  onBlur = (id, e) => {
    const typed = e.target.value.trim();
    let guessExists;
    let indexTag;
    for (indexTag = 0; indexTag < this.state.tags.length; indexTag++) {
      if (this.state.tags[indexTag].text === typed) {
        guessExists = true;
        break;
      }
    }
    this.setState(prevState => {
      const newState = { typed: '' };
      newState.blocks = [...prevState.blocks];
      newState.blocks[id].guess = guessExists ? typed : '';
      if (guessExists) {
        newState.tags = [...prevState.tags];
        newState.tags[indexTag].guessed = true;
      }
      return newState;
    });
  };

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
          />
        ) : (
          <NormalText key={block.id} text={block.text} />
        ),
    );

  renderSide = tags =>
    tags.map(tag => (
      <Tag
        key={tag.id}
        text={tag.text}
        typed={this.state.typed}
        guessed={tag.guessed}
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
          {this.renderSide(this.state.tags)}
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
      />
    </div>
  );
}

function NormalText({ text }) {
  return <span className="normal">{text}</span>;
}

function Tag({ typed = '', text = '', guessed = false }) {
  const enabled = !guessed && typed === text.substr(0, typed.length);
  const prefix = enabled ? typed : '';
  const postfix = enabled ? text.substr(typed.length) : text;
  const className = `tag ${guessed || !enabled ? 'disabled ' : ''} ${
    guessed ? 'guessed' : ''
  }`;
  return (
    <span className={className}>
      <span className="typed">{prefix}</span>
      {postfix}
    </span>
  );
}

export default App;
