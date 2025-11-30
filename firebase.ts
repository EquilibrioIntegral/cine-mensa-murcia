import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuración real de Firebase para Cine Mensa Murcia
const firebaseConfig = {
  apiKey: "AIzaSyDAPUrqq5ClPBJN6hcuw4eSQdWN-mHqdAg",
  authDomain: "cine-mensa-murcia-40d53.firebaseapp.com",
  projectId: "cine-mensa-murcia-40d53",
  storageBucket: "cine-mensa-murcia-40d53.firebasestorage.app",
  messagingSenderId: "137908790918",
  appId: "1:137908790918:web:56a1e599c898cd5d0bd307"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);