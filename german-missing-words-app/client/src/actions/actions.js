import { ADD_TEXT } from '../constants/action-types';

export const addText = text => ({
  type: ADD_TEXT,
  payload: text,
});
