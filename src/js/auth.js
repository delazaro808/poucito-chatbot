import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export function initAuth() {
  const authModal = document.getElementById('authModal');
  const registerModal = document.getElementById('registerModal');
  const authError = document.getElementById('authError');
  const regError = document.getElementById('regError');
  
  // Referencia al botón de la X
  const closeAuthBtn = document.getElementById('closeAuthBtn');

  const showError = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };
  const hideErrors = () => { authError.style.display = 'none'; regError.style.display = 'none'; };

  // --- GUARDAR EL PERFIL EN LA BASE DE DATOS: users/{uid} ---
  // merge: true -> si el usuario ya existía, no se borra nada de lo que tenía.
  // Si falla (por ejemplo sin internet) NO rompe el inicio de sesión.
  async function saveUserProfile(user, nombre) {
    try {
      const data = {
        email: user.email || '',
        ultimaActualizacion: serverTimestamp()
      };
      if (nombre) data.nombre = nombre;
      await setDoc(doc(db, 'users', user.uid), data, { merge: true });
    } catch (e) {
      console.warn('No se pudo guardar el perfil del usuario', e);
    }
  }

  // Inicio de sesión / registro con Google (es el mismo flujo en los dos modales):
  // si la cuenta no existe, Google la crea y se registra en la base automáticamente;
  // si ya existía, simplemente inicia sesión.
  async function signInWithGoogle(errorEl) {
    hideErrors();
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const isNew = getAdditionalUserInfo(result)?.isNewUser;
      // Solo a las cuentas nuevas se les pone el nombre de Google;
      // a las que ya existían no se les cambia el que tenían.
      await saveUserProfile(result.user, isNew ? (result.user.displayName || '') : '');
    } catch (error) {
      // Cerrar la ventana de Google sin terminar no es un error: no se muestra nada
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') return;
      if (error.code === 'auth/popup-blocked') {
        showError(errorEl, "Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.");
      } else if (error.code === 'auth/network-request-failed') {
        showError(errorEl, "No hay conexión a internet. Inténtalo de nuevo.");
      } else {
        showError(errorEl, "No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
      }
    }
  }

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
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      switch (error.code) {
        case 'auth/user-not-found':
          showError(authError, "Este correo no está registrado. Crea tu cuenta con «Regístrate aquí».");
          break;
        case 'auth/wrong-password':
          showError(authError, "Contraseña incorrecta.");
          break;
        case 'auth/invalid-email':
          showError(authError, "El correo no es válido.");
          break;
        case 'auth/too-many-requests':
          showError(authError, "Demasiados intentos. Espera un momento e inténtalo de nuevo.");
          break;
        case 'auth/network-request-failed':
          showError(authError, "No hay conexión a internet. Inténtalo de nuevo.");
          break;
        default:
          // 'auth/invalid-credential': con la protección contra enumeración de correos
          // activada en Firebase, no se puede saber si el correo existe o la contraseña falló.
          showError(authError, "Correo o contraseña incorrectos. Si aún no tienes cuenta, regístrate aquí abajo.");
      }
    }
  });

  // --- LOGIN CON GOOGLE ---
  document.getElementById('btnGoogleAuthLogin').addEventListener('click', () => signInWithGoogle(authError));

  // --- REGISTRO CON CORREO ---
  document.getElementById('authFormRegister').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErrors();
    const name = document.getElementById('regName').value.trim();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, document.getElementById('regEmail').value.trim(), document.getElementById('regPassword').value);
      await updateProfile(userCredential.user, { displayName: name });
      // Se registra en la base de datos desde el primer momento, con su nombre real
      await saveUserProfile(userCredential.user, name);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') showError(regError, "Este correo ya está registrado.");
      else if (error.code === 'auth/weak-password') showError(regError, "La contraseña debe tener al menos 6 caracteres.");
      else if (error.code === 'auth/invalid-email') showError(regError, "El correo no es válido.");
      else if (error.code === 'auth/network-request-failed') showError(regError, "No hay conexión a internet. Inténtalo de nuevo.");
      else showError(regError, "Error al registrar: " + error.message);
    }
  });

  // --- REGISTRO CON GOOGLE ---
  document.getElementById('btnGoogleAuthRegister').addEventListener('click', () => signInWithGoogle(regError));

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