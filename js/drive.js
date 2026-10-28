import { getGoogleClientId } from "./config.js";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const BACKUP_NAME = "avaluatro-backup.json";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

function requestAccessToken() {
  const clientId = getGoogleClientId();
  if (!clientId.trim()) {
    throw new Error("Configura primer el Client ID OAuth a «Configura Drive».");
  }
  if (!globalThis.google?.accounts?.oauth2) {
    throw new Error("No s'ha pogut carregar l'inici de sessió de Google. Comprova la connexió i torna-ho a provar.");
  }
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: response => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        if (!response.access_token) {
          reject(new Error("Google no ha retornat cap token d'accés."));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: error => reject(new Error(error.message || "S'ha tancat la finestra d'autorització de Google."))
    });
    try {
      client.requestAccessToken({ prompt: "" });
    } catch (error) {
      reject(error);
    }
  });
}

async function driveRequest(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.error?.message || "";
    } catch {
      detail = response.statusText;
    }
    throw new Error(`Google Drive ha retornat un error (${response.status})${detail ? `: ${detail}` : "."}`);
  }
  return response;
}

async function findBackup(token) {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${BACKUP_NAME}' and trashed = false`,
    orderBy: "modifiedTime desc",
    pageSize: "1",
    fields: "files(id,name,modifiedTime)"
  });
  const response = await driveRequest(token, `${DRIVE_API}/files?${params}`);
  const result = await response.json();
  return result.files?.[0] || null;
}

function multipartBody(metadata, contents) {
  const boundary = `avaluatro_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    contents,
    `--${boundary}--`,
    ""
  ].join("\r\n");
  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`
  };
}

export async function saveToDrive(value) {
  const token = await requestAccessToken();
  const existing = await findBackup(token);
  const metadata = existing
    ? { name: BACKUP_NAME, mimeType: "application/json" }
    : { name: BACKUP_NAME, mimeType: "application/json", parents: ["appDataFolder"] };
  const { body, contentType } = multipartBody(metadata, `${JSON.stringify(value, null, 2)}\n`);
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=multipart&fields=id,name,modifiedTime`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime";
  await driveRequest(token, url, {
    method: existing ? "PATCH" : "POST",
    headers: { "Content-Type": contentType },
    body
  });
}

export async function loadFromDrive() {
  const token = await requestAccessToken();
  const backup = await findBackup(token);
  if (!backup) return null;
  const response = await driveRequest(token, `${DRIVE_API}/files/${encodeURIComponent(backup.id)}?alt=media`);
  return response.json();
}
