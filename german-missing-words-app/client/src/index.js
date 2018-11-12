import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import './assets/reset.css';
import App from './app/App';
import registerServiceWorker from './assets/registerServiceWorker';
import store from './store/store';

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root'),
);
registerServiceWorker();
