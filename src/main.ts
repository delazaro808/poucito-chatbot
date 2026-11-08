import './scss/styles.scss';
import { initAuth } from './services/auth';
import { initChat } from './ts/chat';

window.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initChat();
});
