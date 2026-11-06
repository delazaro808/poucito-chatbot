import { auth } from './firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";

export function initAuth() {
  const authModal = document.getElementById('authModal');
  const registerModal = document.getElementById('registerModal');
  const authError = document.getElementById('authError');
  const regError = document.getElementById('regError');
  
  // Referencia al botón de la X
  const closeAuthBtn = document.getElementById('closeAuthBtn');

  const showError = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };
  const hideErrors = () => { authError.style.display = 'none'; regError.style.display = 'none'; };

  // --- BOTÓN DE LA X (MODO INVITADO) ---
  if (closeAuthBtn) {
    closeAuthBtn.addEventListener('click', () => {
      authModal.classList.remove('visible');
      // Avisamos al script principal que el usuario quiere ser invitado
      window.dispatchEvent(new CustomEvent('modoInvitado'));
    });
  }
  // -------------------------------------

  // --- LOGIN CON CORREO ---
  document.getElementById('authFormLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErrors();
    try {
      await signInWithEmailAndPassword(auth, document.getElementById('authEmail').value, document.getElementById('authPassword').value);
    } catch (error) {
      showError(authError, "Correo o contraseña incorrectos.");
    }
  });

  // --- LOGIN CON GOOGLE ---
  document.getElementById('btnGoogleAuthLogin').addEventListener('click', async () => {
    hideErrors();
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      showError(authError, "Error con Google: " + error.message);
    }
  });

  // --- REGISTRO CON CORREO ---
  document.getElementById('authFormRegister').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErrors();
    const name = document.getElementById('regName').value;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, document.getElementById('regEmail').value, document.getElementById('regPassword').value);
      await updateProfile(userCredential.user, { displayName: name });
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') showError(regError, "Este correo ya está registrado.");
      else if (error.code === 'auth/weak-password') showError(regError, "La contraseña debe tener al menos 6 caracteres.");
      else showError(regError, "Error al registrar: " + error.message);
    }
  });

  // --- REGISTRO CON GOOGLE ---
  document.getElementById('btnGoogleAuthRegister').addEventListener('click', async () => {
    hideErrors();
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      showError(regError, "Error con Google: " + error.message);
    }
  });

  // --- NAVEGACIÓN ENTRE MODALES ---
  document.getElementById('btnGoToRegister').addEventListener('click', () => {
    authModal.classList.remove('visible');
    registerModal.classList.add('visible');
  });
  document.getElementById('btnGoToLogin').addEventListener('click', () => {
    registerModal.classList.remove('visible');
    authModal.classList.add('visible');
  });
}