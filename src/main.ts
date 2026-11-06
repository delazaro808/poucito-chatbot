import './css/styles.css';
import './js/script.js';
// @ts-ignore
import { initAuth } from './js/auth.js';

window.addEventListener('DOMContentLoaded', () => {
  initAuth(); // Inicializa los botones de login y registro
});