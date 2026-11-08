import { auth, db } from './firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo,
  updateProfile,
  type User,
  type UserCredential
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

interface FirebaseErrorLike {
  code?: string;
  message?: string;
}

export function initAuth(): void {
  const authModal = document.getElementById('authModal') as HTMLDivElement | null;
  const registerModal = document.getElementById('registerModal') as HTMLDivElement | null;
  const authError = document.getElementById('authError') as HTMLParagraphElement | null;
  const regError = document.getElementById('regError') as HTMLParagraphElement | null;
  const closeAuthBtn = document.getElementById('closeAuthBtn') as HTMLButtonElement | null;

  const showError = (el: HTMLElement | null, msg: string): void => {
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  };

  const hideErrors = (): void => {
    if (authError) authError.style.display = 'none';
    if (regError) regError.style.display = 'none';
  };

  /**
   * Guarda o actualiza el perfil del usuario en Firestore (users/{uid})
   */
  async function saveUserProfile(user: User, nombre?: string): Promise<void> {
    try {
      const data: Record<string, unknown> = {
        email: user.email || '',
        ultimaActualizacion: serverTimestamp()
      };
      if (nombre) {
        data.nombre = nombre;
      }
      await setDoc(doc(db, 'users', user.uid), data, { merge: true });
    } catch (e) {
      console.warn('No se pudo guardar el perfil del usuario', e);
    }
  }

  /**
   * Maneja el inicio de sesión o registro mediante Google Popup
   */
  async function signInWithGoogle(errorEl: HTMLElement | null): Promise<void> {
    hideErrors();
    try {
      const result: UserCredential = await signInWithPopup(auth, new GoogleAuthProvider());
      const isNew = getAdditionalUserInfo(result)?.isNewUser;
      await saveUserProfile(result.user, isNew ? (result.user.displayName || '') : '');
    } catch (err: unknown) {
      const error = err as FirebaseErrorLike;
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return;
      }
      if (error.code === 'auth/popup-blocked') {
        showError(errorEl, "Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.");
      } else if (error.code === 'auth/network-request-failed') {
        showError(errorEl, "No hay conexión a internet. Inténtalo de nuevo.");
      } else {
        showError(errorEl, "No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
      }
    }
  }

  // --- MODO INVITADO ---
  if (closeAuthBtn) {
    closeAuthBtn.addEventListener('click', () => {
      authModal?.classList.remove('visible');
      window.dispatchEvent(new CustomEvent('modoInvitado'));
    });
  }

  // --- LOGIN CON CORREO ---
  const authFormLogin = document.getElementById('authFormLogin') as HTMLFormElement | null;
  authFormLogin?.addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();
    hideErrors();
    const emailInput = document.getElementById('authEmail') as HTMLInputElement | null;
    const passwordInput = document.getElementById('authPassword') as HTMLInputElement | null;
    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value || '';

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const error = err as FirebaseErrorLike;
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
          showError(authError, "Correo o contraseña incorrectos. Si aún no tienes cuenta, regístrate aquí abajo.");
      }
    }
  });

  // --- LOGIN CON GOOGLE ---
  const btnGoogleAuthLogin = document.getElementById('btnGoogleAuthLogin') as HTMLButtonElement | null;
  btnGoogleAuthLogin?.addEventListener('click', () => signInWithGoogle(authError));

  // --- REGISTRO CON CORREO ---
  const authFormRegister = document.getElementById('authFormRegister') as HTMLFormElement | null;
  authFormRegister?.addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();
    hideErrors();
    const regNameInput = document.getElementById('regName') as HTMLInputElement | null;
    const regEmailInput = document.getElementById('regEmail') as HTMLInputElement | null;
    const regPasswordInput = document.getElementById('regPassword') as HTMLInputElement | null;

    const name = regNameInput?.value.trim() || '';
    const email = regEmailInput?.value.trim() || '';
    const password = regPasswordInput?.value || '';

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      await saveUserProfile(userCredential.user, name);
    } catch (err: unknown) {
      const error = err as FirebaseErrorLike;
      if (error.code === 'auth/email-already-in-use') {
        showError(regError, "Este correo ya está registrado.");
      } else if (error.code === 'auth/weak-password') {
        showError(regError, "La contraseña debe tener al menos 6 caracteres.");
      } else if (error.code === 'auth/invalid-email') {
        showError(regError, "El correo no es válido.");
      } else if (error.code === 'auth/network-request-failed') {
        showError(regError, "No hay conexión a internet. Inténtalo de nuevo.");
      } else {
        showError(regError, "Error al registrar: " + (error.message || 'Error desconocido'));
      }
    }
  });

  // --- REGISTRO CON GOOGLE ---
  const btnGoogleAuthRegister = document.getElementById('btnGoogleAuthRegister') as HTMLButtonElement | null;
  btnGoogleAuthRegister?.addEventListener('click', () => signInWithGoogle(regError));

  // --- NAVEGACIÓN ENTRE MODALES ---
  const btnGoToRegister = document.getElementById('btnGoToRegister') as HTMLButtonElement | null;
  btnGoToRegister?.addEventListener('click', () => {
    authModal?.classList.remove('visible');
    registerModal?.classList.add('visible');
  });

  const btnGoToLogin = document.getElementById('btnGoToLogin') as HTMLButtonElement | null;
  btnGoToLogin?.addEventListener('click', () => {
    registerModal?.classList.remove('visible');
    authModal?.classList.add('visible');
  });
}

