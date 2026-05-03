import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAmA5wiUQFNP80t9lOWK03fTOVYOVIgGRU",
  authDomain: "chat-e44ca.firebaseapp.com",
  databaseURL: "https://chat-e44ca-default-rtdb.firebaseio.com",
  projectId: "chat-e44ca",
  storageBucket: "chat-e44ca.firebasestorage.app",
  messagingSenderId: "344219692344",
  appId: "1:344219692344:web:a50b4b3f21e2a4f64225cd",
  measurementId: "G-Y8T14D8CPE"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
