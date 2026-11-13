import { createCloud } from "../js/cloud.js";

const results = document.querySelector("#results");
const storage = new Map();
const mismatchTest = new URLSearchParams(location.search).has("mismatch");
const recoveryTest = new URLSearchParams(location.search).has("recovery");
const immediateSignupTest = new URLSearchParams(location.search).has("signup");
const reauthTest = new URLSearchParams(location.search).has("reauth");
if (mismatchTest) {
  const url = "https://old-project.supabase.co";
  storage.set("avaluatro.cloud.active.v1", JSON.stringify({ url, userId: "teacher" }));
  storage.set(`avaluatro.cloud.workspace.v1:${encodeURIComponent(url)}:teacher`,
    JSON.stringify({ payload: { value: "old pending edit" }, revision: 1, pending: true, conflict: false }));
}
if (reauthTest) {
  const url = "https://example.supabase.co";
  storage.set("avaluatro.cloud.active.v1", JSON.stringify({ url, userId: "teacher" }));
  storage.set(`avaluatro.cloud.workspace.v1:${encodeURIComponent(url)}:teacher`,
    JSON.stringify({ payload: { value: "pending offline" }, revision: 1, pending: true, conflict: false }));
}
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  }
});
window.confirm = () => true;
let session = null;
let callback;
let remote = reauthTest ? { revision: 1, payload: { value: "previous remote" } } : null;
let offline = false;
let holdSave = null;
let resetEmail;
let signupConfirmation = true;
let updatedPassword;
const clone = value => structuredClone(value);
const failure = () => offline ? { message: "Servidor inaccessible" } : null;
window.supabase = {
  createClient(url, key) {
    if (url !== "https://example.supabase.co" || key !== "sb_publishable_test") throw new Error("Incorrect app project configuration");
    return {
      auth: {
        onAuthStateChange(fn) { callback = fn; },
        async getSession() { return { data: { session }, error: null }; },
        async signInWithPassword({ email, password }) {
          if (email !== "teacher@example.com" || password !== "correct-password") {
            return { data: { session: null }, error: { message: "Invalid login credentials" } };
          }
          session = { user: { id: "teacher" } };
          callback("SIGNED_IN", session);
          return { data: { session }, error: null };
        },
        async signUp({ email, password, options }) {
          if (email !== "teacher@example.com" || password !== "correct-password" || options.emailRedirectTo !== location.origin + location.pathname) throw new Error("Incorrect signup parameters");
          if (signupConfirmation) return { data: { session: null }, error: null };
          session = { user: { id: "teacher" } };
          callback("SIGNED_IN", session);
          return { data: { session }, error: null };
        },
        async resetPasswordForEmail(email, { redirectTo }) {
          if (redirectTo !== location.origin + location.pathname) throw new Error("Incorrect recovery redirect");
          resetEmail = email;
          return { error: null };
        },
        async updateUser({ password }) {
          updatedPassword = password;
          return { data: { user: session.user }, error: null };
        },
        async signOut() { session = null; return { error: failure() }; }
      },
      from() {
        return { select() { return { eq() { return { async maybeSingle() {
          return { data: clone(remote), error: failure() };
        } }; } }; } };
      },
      async rpc(name, { expected_revision, new_payload }) {
        if (holdSave) await holdSave;
        if (failure()) return { data: null, error: failure() };
        if ((remote?.revision ?? null) !== expected_revision) return { data: [], error: null };
        remote = { revision: (remote?.revision ?? 0) + 1, payload: clone(new_payload) };
        return { data: [{ revision: remote.revision }], error: null };
      }
    };
  }
};

const local = { value: "local" };
let visible = clone(local);
const notices = [];
const cloud = createCloud({
  projectConfig: { url: "https://example.supabase.co", key: "sb_publishable_test" },
  readLocal: () => clone(local),
  applyData: value => { visible = clone(value); },
  validate: clone,
  serialize: clone,
  notify: message => notices.push(message)
});
const status = () => document.querySelector("#cloud-status").textContent;
const waitFor = async (condition, label) => {
  for (let i = 0; i < 100; i++) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(label);
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const click = selector => document.querySelector(selector).click();

async function run() {
  cloud.start();
  if (reauthTest) {
    await waitFor(() => !document.querySelector("#cloud-config-form").hidden, "Expired session prompts for sign-in");
    assert(visible.value === "pending offline", "Pending data remains available");
    assert(document.querySelector("#cloud-signup").hidden, "Existing workspace requires original account");
    document.querySelector("#cloud-email").value = "teacher@example.com";
    document.querySelector("#cloud-password").value = "correct-password";
    click("#cloud-signin");
    await waitFor(() => remote.payload.value === "pending offline" && status() === "Núvol sincronitzat", "Reauthentication syncs pending data");
    results.textContent = "PASS: expired session reauthentication and pending sync";
    return;
  }
  if (recoveryTest) {
    session = { user: { id: "teacher" } };
    callback("PASSWORD_RECOVERY", session);
    await waitFor(() => !document.querySelector("#cloud-recovery-form").hidden, "Recovery form opens");
    assert(document.querySelector("#cloud-config-form").hidden, "Sign-in form hidden during recovery");
    document.querySelector("#cloud-new-password").value = "new-password";
    document.querySelector("#cloud-recovery-form").requestSubmit();
    await waitFor(() => remote?.revision === 1 && status() === "Núvol sincronitzat", "Recovery activates cloud after update");
    assert(updatedPassword === "new-password", "New password passed to Supabase");
    assert(document.querySelector("#cloud-new-password").value === "", "New password cleared after update");
    results.textContent = "PASS: password recovery and account activation";
    return;
  }
  if (mismatchTest) {
    assert(cloud.isActive() && visible.value === "old pending edit", "Previous project copy remains available");
    assert(status() === "Còpia d'un altre projecte", "Project change is clearly indicated");
    assert(document.querySelector("#privacy-status").textContent.includes("no se sincronitzarà"), "Previous project copy is not described as syncing");
    assert(document.querySelector("#cloud-config-form").hidden, "Cannot sign in to a different project over old data");
    cloud.save({ value: "additional old edit" });
    assert(remote === null, "Old data is never uploaded to the new project");
    assert([...storage.values()].some(value => value.includes("additional old edit")), "Edits remain stored locally");
    click("#cloud-disconnect");
    await waitFor(() => !cloud.isActive(), "Return to local mode from previous project");
    assert(visible.value === "local", "Original local data remains available");
    assert([...storage.values()].some(value => value.includes("additional old edit")), "Old project copy is retained");
    results.textContent = "PASS: previous project copy remains available and is never uploaded to the new project";
    return;
  }
  assert(!cloud.isActive() && status() === "Mode local", "Starts in local mode");
  click("#cloud-button");
  document.querySelector("#cloud-email").value = "teacher@example.com";
  if (immediateSignupTest) {
    signupConfirmation = false;
    document.querySelector("#cloud-password").value = "correct-password";
    click("#cloud-signup");
    await waitFor(() => remote?.revision === 1 && status() === "Núvol sincronitzat", "Immediate signup activates cloud");
    assert(document.querySelector("#cloud-password").value === "", "Password cleared after signup");
    results.textContent = "PASS: signup without email confirmation";
    return;
  }
  document.querySelector("#cloud-password").value = "wrong-password";
  click("#cloud-signin");
  await waitFor(() => status() === "Error del núvol", "Invalid password is reported");
  assert(!cloud.isActive() && remote === null, "Invalid password keeps local mode");
  click("#cloud-reset");
  await waitFor(() => resetEmail === "teacher@example.com", "Password reset requested");
  assert(!cloud.isActive(), "Password reset keeps local mode");
  document.querySelector("#cloud-password").value = "correct-password";
  click("#cloud-signup");
  await waitFor(() => document.querySelector("#cloud-detail").textContent.includes("confirmació"), "Signup confirmation instructions");
  assert(!cloud.isActive() && remote === null, "Unconfirmed signup does not sync");
  document.querySelector("#cloud-password").value = "correct-password";
  click("#cloud-signin");
  await waitFor(() => remote?.revision === 1 && status() === "Núvol sincronitzat", "Initial upload");
  assert(visible.value === "local" && remote.payload.value === "local", "Confirmed local copy is uploaded");

  offline = true;
  cloud.save({ value: "offline edit" });
  await waitFor(() => status().includes("canvis pendents"), "Offline pending indicator");
  assert(remote.payload.value === "local", "Offline changes do not reach server");
  assert(notices.some(message => message.includes("pendents de sincronitzar")), "Offline changes are reported");
  offline = false;
  click("#cloud-retry");
  await waitFor(() => remote.payload.value === "offline edit" && status() === "Núvol sincronitzat", "Retry uploads queued edit");

  let release;
  holdSave = new Promise(resolve => { release = resolve; });
  cloud.save({ value: "first" });
  await waitFor(() => status() === "Sincronitzant…", "Save begins");
  cloud.save({ value: "second" });
  release();
  holdSave = null;
  await waitFor(() => remote.payload.value === "second" && status() === "Núvol sincronitzat", "Concurrent local edit is also uploaded");

  remote = { revision: remote.revision + 1, payload: { value: "remote edit" } };
  cloud.save({ value: "local edit" });
  await waitFor(() => status() === "Conflicte de sincronització", "Remote conflict detected");
  assert(remote.payload.value === "remote edit", "Conflict does not overwrite remote");
  click("#cloud-use-remote");
  await waitFor(() => visible.value === "remote edit" && status() === "Núvol sincronitzat", "Explicit remote resolution");

  remote = { revision: remote.revision + 1, payload: { value: "other remote edit" } };
  cloud.save({ value: "chosen local edit" });
  await waitFor(() => status() === "Conflicte de sincronització", "Second conflict detected");
  click("#cloud-use-local");
  await waitFor(() => remote.payload.value === "chosen local edit" && status() === "Núvol sincronitzat", "Explicit local resolution");

  offline = true;
  cloud.save({ value: "pending before disconnect" });
  await waitFor(() => status().includes("canvis pendents"), "Pending edit before disconnect");
  click("#cloud-disconnect");
  await waitFor(() => !cloud.isActive(), "Return to local mode while offline");
  assert(visible.value === "local", "Original local workspace remains separate");
  assert([...storage.values()].some(value => value.includes("pending before disconnect")), "Pending cloud copy is preserved");
  callback("SIGNED_IN", { user: { id: "teacher" } });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert(!cloud.isActive() && visible.value === "local", "Local mode ignores automatic sign-in after disconnect");
  results.textContent = "PASS: local mode, initial upload, offline queue, retry, in-flight edits, conflict resolution and offline disconnect";
}

run().catch(error => {
  results.textContent = `FAIL: ${error.stack || error.message}`;
});
