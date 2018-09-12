import React from 'react';
import ReactDOM from 'react-dom';
import './assets/reset.css';
import App from './app/App';
import registerServiceWorker from './assets/registerServiceWorker';

ReactDOM.render(<App />, document.getElementById('root'));
registerServiceWorker();
