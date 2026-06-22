import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBOYD9TE__fk2_4RlCXMj5HlTdqhDv5VR0',
  authDomain: 'entj-a496f.firebaseapp.com',
  projectId: 'entj-a496f',
  storageBucket: 'entj-a496f.firebasestorage.app',
  messagingSenderId: '640134430702',
  appId: '1:640134430702:web:6c2962ca7917daa3fa58ff'
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
