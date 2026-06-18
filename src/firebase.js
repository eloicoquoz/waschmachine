// ─────────────────────────────────────────────
//  firebase.js  —  Waschmachine
//  Remplace les valeurs YOUR_* par celles de
//  ton projet Firebase (console.firebase.google.com)
// ─────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// ── Config Firebase — Waschmachine ───────────
const firebaseConfig = {
  apiKey:            "AIzaSyDS0VlYE9gacH4rymt3Z9dUahjy5UwYxbs",
  authDomain:        "waschmachine-eebd2.firebaseapp.com",
  projectId:         "waschmachine-eebd2",
  storageBucket:     "waschmachine-eebd2.firebasestorage.app",
  messagingSenderId: "325023590063",
  appId:             "1:325023590063:web:505d3a0abb8d546cbc565a",
};
// ─────────────────────────────────────────────

const app       = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const storage   = getStorage(app);
export const messaging = getMessaging(app);

const googleProvider = new GoogleAuthProvider();

// ── Auth helpers ──────────────────────────────

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(result.user);
  return result.user;
}

export async function registerWithEmail(email, password, displayName) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  await ensureUserDoc(result.user);
  return result.user;
}

export async function loginWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export const logout = () => signOut(auth);

export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

// Creates a user doc in Firestore if it doesn't already exist
async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid:         user.uid,
      displayName: user.displayName || "",
      email:       user.email || "",
      photoURL:    user.photoURL || "",
      createdAt:   serverTimestamp(),
    });
  }
}

// ── Tournaments ───────────────────────────────

export function subscribeTournaments(callback) {
  const q = query(collection(db, "tournaments"), orderBy("rawDate", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createTournament(data) {
  return addDoc(collection(db, "tournaments"), {
    ...data,
    yesResponses: data.proposedBy ? [data.proposedBy] : [],
    noResponses:  [],
    teamValidated: false,
    result: null,
    createdAt: serverTimestamp(),
  });
}

export async function respondToTournament(tournamentId, userId, answer) {
  const ref = doc(db, "tournaments", tournamentId);
  if (answer === "yes") {
    await updateDoc(ref, {
      yesResponses: arrayUnion(userId),
      noResponses:  arrayRemove(userId),
    });
  } else {
    await updateDoc(ref, {
      noResponses:  arrayUnion(userId),
      yesResponses: arrayRemove(userId),
    });
  }
}

export async function removeResponse(tournamentId, userId) {
  const ref = doc(db, "tournaments", tournamentId);
  await updateDoc(ref, {
    yesResponses: arrayRemove(userId),
    noResponses:  arrayRemove(userId),
  });
}

export async function validateTeam(tournamentId, validated) {
  await updateDoc(doc(db, "tournaments", tournamentId), { teamValidated: validated });
}

export async function addResult(tournamentId, result) {
  await updateDoc(doc(db, "tournaments", tournamentId), { result });
}

// ── Chat ──────────────────────────────────────

export function subscribeChat(tournamentId, callback) {
  const q = query(
    collection(db, "chats", tournamentId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function sendMessage(tournamentId, uid, displayName, text) {
  await addDoc(collection(db, "chats", tournamentId, "messages"), {
    author:     uid,
    authorName: displayName,
    text,
    createdAt:  serverTimestamp(),
  });
}

// ── Feed ─────────────────────────────────────

export function subscribeFeed(callback) {
  const q = query(collection(db, "feed"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function uploadMedia(file, uid) {
  const path = `feed/${uid}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function createFeedPost(uid, displayName, { caption, mediaUrl, mediaType, grad, emoji }) {
  await addDoc(collection(db, "feed"), {
    author:      uid,
    authorName:  displayName,
    caption,
    mediaUrl:    mediaUrl || null,
    mediaType:   mediaType || "gradient",
    grad,
    emoji,
    likes:       [],
    createdAt:   serverTimestamp(),
  });
}

export async function toggleLike(postId, uid) {
  const ref  = doc(db, "feed", postId);
  const snap = await getDoc(ref);
  const likes = snap.data()?.likes || [];
  if (likes.includes(uid)) {
    await updateDoc(ref, { likes: arrayRemove(uid) });
  } else {
    await updateDoc(ref, { likes: arrayUnion(uid) });
  }
}

// ── Push notifications (FCM) ──────────────────

const VAPID_KEY = "YOUR_VAPID_KEY"; // Firebase Console → Project Settings → Cloud Messaging

export async function requestNotifPermission(uid) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    // Save token to user doc so backend can send targeted notifications
    await updateDoc(doc(db, "users", uid), { fcmToken: token });
    return token;
  } catch (e) {
    console.error("FCM token error:", e);
    return null;
  }
}

export function onForegroundMessage(callback) {
  return onMessage(messaging, callback);
}

// ── Users / Members ──────────────────────────

export function subscribeUsers(callback) {
  return onSnapshot(collection(db, "users"), (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
  });
}

// ── Delete feed post ─────────────────────────

export async function deleteFeedPost(postId) {
  await deleteDoc(doc(db, "feed", postId));
}