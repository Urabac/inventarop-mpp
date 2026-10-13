import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { getFirebaseConfig } from "./firebase.functions";

type FirebaseServices = { app: FirebaseApp; auth: Auth; db: Firestore };
let servicesPromise: Promise<FirebaseServices> | null = null;

export function getFirebaseServices() {
  if (!servicesPromise) {
    servicesPromise = getFirebaseConfig().then((config) => {
      const app = getApps().length ? getApp() : initializeApp(config);
      return { app, auth: getAuth(app), db: getFirestore(app) };
    });
  }
  return servicesPromise;
}