import { ADD_TEXT } from '../constants/action-types';

const initialState = {
  blocks: [],
  typed: '',
  lastTyped: '',
  percentage: -1,
};

const rootReducer = (state = initialState, action) => {
  switch (action) {
    case ADD_TEXT:
      return {
	...state,
	blocks: [...action.payload],
      };
    default:
      return state;
  }
};

export default rootReducer;
