import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const firebaseConfig = {
  apiKey: 'AIzaSyBOYD9TE__fk2_4RlCXMj5HlTdqhDv5VR0',
  authDomain: isLocalDevelopment ? 'entj-a496f.firebaseapp.com' : 'entj-murex.vercel.app',
  projectId: 'entj-a496f',
  storageBucket: 'entj-a496f.firebasestorage.app',
  messagingSenderId: '640134430702',
  appId: '1:640134430702:web:6c2962ca7917daa3fa58ff'
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
