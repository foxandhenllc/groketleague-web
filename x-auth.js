/** Sign in with X — OAuth 2.0 Authorization Code + PKCE (public client). */
import { X_CLIENT_ID, X_SCOPES } from "./x-config.js";

const STORAGE_KEY = "gl_x_auth";
const PKCE_KEY = "gl_x_pkce";

let user = null;
let tokens = null;
const listeners = new Set();

function redirectUri() {
  return window.location.origin + "/";
}

function notify() {
  for (const cb of listeners) {
    try { cb(user); } catch (_) {}
  }
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || !data.access_token) return;
    tokens = data;
  } catch (_) {}
}

function saveTokens(next) {
  tokens = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}

function b64url(buf) {
  let str;
  if (typeof buf === "string") str = btoa(buf);
  else {
    let s = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    str = btoa(s);
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

async function createPkce() {
  const verifier = randomString(32);
  const challenge = b64url(await sha256(verifier));
  return { verifier, challenge };
}

export function onAuthChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getXUser() {
  return user;
}

export function isSignedIn() {
  return !!user;
}

export async function loginWithX() {
  if (!X_CLIENT_ID) throw new Error("Missing X Client ID");
  const { verifier, challenge } = await createPkce();
  const state = randomString(16);
  try {
    sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, at: Date.now() }));
  } catch (_) {}
  const url = new URL("https://twitter.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", X_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("scope", X_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  window.location.assign(url.toString());
}

export function logoutX() {
  user = null;
  saveTokens(null);
  notify();
}

async function tokenRequest(body) {
  const res = await fetch("/api/x-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error_description || data.error || data.message || ("Token HTTP " + res.status);
    throw new Error(msg);
  }
  return data;
}

async function exchangeCode(code, verifier) {
  const data = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: X_CLIENT_ID,
    code_verifier: verifier,
  });
  const expiresAt = Date.now() + (Number(data.expires_in) || 7200) * 1000;
  saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token || null,
    expires_at: expiresAt,
    scope: data.scope || X_SCOPES,
    token_type: data.token_type || "bearer",
  });
}

async function refreshIfNeeded() {
  if (!tokens || !tokens.access_token) return false;
  if (tokens.expires_at && Date.now() < tokens.expires_at - 60_000) return true;
  if (!tokens.refresh_token) return false;
  const data = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: X_CLIENT_ID,
  });
  const expiresAt = Date.now() + (Number(data.expires_in) || 7200) * 1000;
  saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at: expiresAt,
    scope: data.scope || tokens.scope,
    token_type: data.token_type || "bearer",
  });
  return true;
}

async function fetchMe() {
  if (!(await refreshIfNeeded())) return null;
  const res = await fetch("/api/x-me", {
    method: "GET",
    headers: { Authorization: "Bearer " + tokens.access_token },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      logoutX();
      return null;
    }
    throw new Error(data.detail || data.title || data.message || ("Profile HTTP " + res.status));
  }
  const u = data.data || data;
  user = {
    id: u.id,
    name: u.name || "",
    username: u.username || "",
    profile_image_url: (u.profile_image_url || "").replace("_normal", "_bigger"),
  };
  notify();
  return user;
}

async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const err = params.get("error");
  if (!code && !err) return false;
  params.delete("code");
  params.delete("state");
  params.delete("error");
  params.delete("error_description");
  const q = params.toString();
  history.replaceState({}, "", window.location.pathname + (q ? "?" + q : "") + window.location.hash);

  if (err) throw new Error(err);
  let pkce = null;
  try { pkce = JSON.parse(sessionStorage.getItem(PKCE_KEY) || "null"); } catch (_) {}
  try { sessionStorage.removeItem(PKCE_KEY); } catch (_) {}
  if (!pkce || !pkce.verifier || pkce.state !== state) throw new Error("Sign-in state mismatch. Try again.");
  await exchangeCode(code, pkce.verifier);
  await fetchMe();
  return true;
}

export async function initXAuth() {
  loadStored();
  try {
    const handled = await handleCallback();
    if (handled) return { ok: true, user, justSignedIn: true };
  } catch (e) {
    logoutX();
    return { ok: false, error: e, justSignedIn: false };
  }
  if (tokens && tokens.access_token) {
    try {
      await fetchMe();
      return { ok: true, user, justSignedIn: false };
    } catch (e) {
      logoutX();
      return { ok: false, error: e, justSignedIn: false };
    }
  }
  return { ok: true, user: null, justSignedIn: false };
}
