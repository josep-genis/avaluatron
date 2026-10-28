const CLIENT_ID_KEY = "avaluatro.google-client-id";

export function getGoogleClientId() {
  return localStorage.getItem(CLIENT_ID_KEY) || "";
}

export function saveGoogleClientId(value) {
  localStorage.setItem(CLIENT_ID_KEY, value);
}
