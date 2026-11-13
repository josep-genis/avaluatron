import { supabaseConfig } from "./supabase-config.js";

const ACTIVE_KEY = "avaluatro.cloud.active.v1";
const LOCAL_MODE_KEY = "avaluatro.cloud.local-mode.v1";
const CACHE_PREFIX = "avaluatro.cloud.workspace.v1:";

function cacheKey(url, userId) {
  return CACHE_PREFIX + encodeURIComponent(url) + ":" + encodeURIComponent(userId);
}

function publicConfig(url, key) {
  const parsed = new URL(url);
  if ((parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) ||
      parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("Introdueix l'URL HTTPS base del projecte Supabase.");
  }
  if (!key || key.startsWith("sb_secret_")) throw new Error("Cal una clau publicable o anon, mai una clau secreta.");
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.role === "service_role") throw new Error("No facis servir una clau service_role.");
    } catch (error) {
      if (error.message === "No facis servir una clau service_role.") throw error;
      throw new Error("La clau JWT no és vàlida.");
    }
  }
  return { url: parsed.origin, key };
}

export function createCloud({ readLocal, applyData, validate, serialize, notify, projectConfig = supabaseConfig }) {
  const dialog = document.querySelector("#cloud-dialog");
  const button = document.querySelector("#cloud-button");
  const status = document.querySelector("#cloud-status");
  const detail = document.querySelector("#cloud-detail");
  const form = document.querySelector("#cloud-config-form");
  const emailInput = document.querySelector("#cloud-email");
  const retryButton = document.querySelector("#cloud-retry");
  const remoteButton = document.querySelector("#cloud-use-remote");
  const localButton = document.querySelector("#cloud-use-local");
  const disconnectButton = document.querySelector("#cloud-disconnect");
  const privacy = document.querySelector("#privacy-status");
  let config, client, active, cache, rawCache;
  let busy = false;
  let stale = false;
  let connection = "local";
  let lastError = "";
  let info = "";
  let onboarding = false;
  let authRequired = false;
  let projectMismatch = false;

  function display() {
    let text = "Mode local";
    let description = "El mode local funciona sense compte. Introdueix el correu per iniciar sessió o crear un compte.";
    let indicator = "local";
    if (active) {
      indicator = connection === "connected" && !cache.pending && !cache.conflict && !stale ? "connected" : "warning";
      if (projectMismatch) text = "Còpia d'un altre projecte";
      else if (stale) text = "Una altra pestanya ha fet canvis";
      else if (cache.conflict) text = "Conflicte de sincronització";
      else if (connection === "offline") text = cache.pending ? "Sense connexió · canvis pendents" : "Sense connexió al servidor";
      else if (connection === "syncing") text = "Sincronitzant…";
      else if (cache.pending) text = "Canvis pendents";
      else if (connection === "connected") text = "Núvol sincronitzat";
      else text = "Comprovant el núvol…";
      description = `${text}. ${cache.pending ? "Els canvis són al dispositiu i encara no estan sincronitzats. " : ""}${info || lastError}`;
    } else if (lastError) {
      description = lastError;
      indicator = "warning";
      text = "Error del núvol";
    } else if (info) {
      description = info;
    }
    status.textContent = text;
    button.dataset.status = indicator;
    button.title = description;
    detail.textContent = description;
    form.hidden = !client || projectMismatch || (Boolean(active) && !authRequired);
    retryButton.hidden = !active || stale || projectMismatch;
    remoteButton.hidden = !active || !cache.conflict || stale || projectMismatch;
    localButton.hidden = !active || !cache.conflict || stale || projectMismatch;
    disconnectButton.hidden = !active;
    privacy.textContent = projectMismatch
      ? "Aquesta còpia es desa només al dispositiu i no se sincronitzarà amb el projecte actual."
      : active
        ? "Les dades es desen al dispositiu i se sincronitzen amb el núvol quan hi ha connexió."
        : "Les dades es desen al dispositiu.";
  }

  function setCache(next) {
    const key = cacheKey(active.url, active.userId);
    if (localStorage.getItem(key) !== rawCache) {
      stale = true;
      display();
      throw new Error("Una altra pestanya ha modificat aquesta còpia. Recarrega abans de continuar.");
    }
    const nextRaw = JSON.stringify(next);
    localStorage.setItem(key, nextRaw);
    rawCache = nextRaw;
    cache = next;
  }

  function initializeClient() {
    if (!config) return;
    client = globalThis.supabase.createClient(config.url, config.key);
    client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setTimeout(() => {
          if (!active) {
            if (!localStorage.getItem(LOCAL_MODE_KEY)) activate(session.user).catch(reportError);
          } else if (projectMismatch) {
            return;
          } else if (session.user.id === active.userId) {
            authRequired = false;
            sync();
          } else {
            authRequired = true;
            reportError(new Error("Aquest espai pertany a un altre compte. Inicia sessió amb el compte original."));
          }
        }, 0);
      }
    });
  }

  function reportError(error) {
    const previousError = lastError;
    lastError = error.message || String(error);
    info = "";
    if (active) connection = "offline";
    display();
    if (previousError !== lastError) {
      notify(`No s'ha pogut sincronitzar amb Supabase: ${lastError}${active && cache.pending ? " Els canvis continuen desats al dispositiu, pendents de sincronitzar." : ""}`, true);
    }
  }

  async function sessionForActive(target = active) {
    if (!client || !target) throw new Error("Falta la configuració del projecte.");
    const { data: result, error } = await client.auth.getSession();
    if (error) {
      authRequired = true;
      throw error;
    }
    if (!result.session || result.session.user.id !== target.userId) {
      authRequired = true;
      throw new Error("La sessió ha caducat o pertany a un altre compte. Torna a iniciar sessió.");
    }
    authRequired = false;
    return result.session;
  }

  async function fetchRemote(target = active) {
    await sessionForActive(target);
    const { data: row, error } = await client.from("avaluatro_workspaces")
      .select("revision,payload").eq("user_id", target.userId).maybeSingle();
    if (error) throw error;
    if (row) validate(row.payload);
    return row;
  }

  async function activate(user) {
    if (active || onboarding || !config) return;
    onboarding = true;
    let activated = false;
    try {
      const key = cacheKey(config.url, user.id);
      const stored = localStorage.getItem(key);
      if (stored) {
        const saved = JSON.parse(stored);
        const validated = validate(saved.payload);
        active = { url: config.url, userId: user.id };
        cache = saved;
        rawCache = stored;
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
        applyData(validated);
      } else {
        const target = { url: config.url, userId: user.id };
        const remote = await fetchRemote(target);
        const useLocal = globalThis.confirm(remote
          ? "Aquest compte ja té dades al núvol. Vols substituir-les per la còpia local d'aquest dispositiu?\n\nCancel·la per escollir la còpia del núvol. Exporta primer una còpia si cal."
          : "Aquest compte encara no té dades al núvol. Vols pujar-hi la còpia local d'aquest dispositiu?\n\nCancel·la per romandre en mode local.");
        if (!remote && !useLocal) {
          localStorage.setItem(LOCAL_MODE_KEY, "1");
          display();
          return;
        }
        if (remote && !useLocal && !globalThis.confirm("Vols obrir la còpia del núvol? La còpia local es conservarà separada en aquest dispositiu.")) {
          localStorage.setItem(LOCAL_MODE_KEY, "1");
          display();
          return;
        }
        const payload = useLocal ? serialize(readLocal()) : remote.payload;
        const validated = validate(payload);
        active = target;
        cache = { payload, revision: remote?.revision ?? null, pending: useLocal, conflict: false };
        rawCache = null;
        setCache(cache);
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
        applyData(validated);
      }
      stale = false;
      lastError = "";
      info = "";
      connection = "checking";
      activated = true;
      display();
      dialog.close();
      await sync();
    } catch (error) {
      if (!activated) {
        active = undefined;
        cache = undefined;
        rawCache = undefined;
      }
      throw error;
    } finally {
      onboarding = false;
    }
  }

  async function sync() {
    if (!active || busy || stale || cache.conflict || projectMismatch) return;
    busy = true;
    connection = "syncing";
    display();
    try {
      const remote = await fetchRemote();
      if (stale || !active) return;
      if ((remote?.revision ?? null) !== cache.revision) {
        setCache({ ...cache, conflict: true });
        connection = "connected";
        lastError = "La còpia del núvol ha canviat. Tria quina còpia vols conservar; exporta abans la còpia actual si cal.";
        notify(lastError, "warning");
        return;
      }
      while (cache.pending && !stale && active) {
        const payload = cache.payload;
        const { data: rows, error } = await client.rpc("avaluatro_save_workspace", {
          expected_revision: cache.revision,
          new_payload: payload
        });
        if (error) throw error;
        if (stale || !active) return;
        if (!rows?.length) {
          setCache({ ...cache, conflict: true });
          lastError = "La còpia del núvol ha canviat durant la sincronització. Tria quina còpia vols conservar.";
          notify(lastError, "warning");
          break;
        }
        setCache({ ...cache, revision: rows[0].revision, pending: cache.payload !== payload });
      }
      connection = "connected";
      if (!cache.conflict) lastError = "";
    } catch (error) {
      reportError(error);
    } finally {
      busy = false;
      display();
    }
  }

  async function resolveConflict(useLocal) {
    if (!active || busy || stale || projectMismatch) return;
    const message = useLocal
      ? "Vols substituir la còpia del núvol per aquesta còpia del dispositiu? Els canvis remots es perdran. Exporta les dades que vulguis conservar."
      : "Vols substituir aquesta còpia del dispositiu per la del núvol? Els canvis locals pendents es perdran. Exporta'ls abans si els vols conservar.";
    if (!globalThis.confirm(message)) return;
    busy = true;
    try {
      const remote = await fetchRemote();
      if (stale || !active) return;
      if (!useLocal && !remote) throw new Error("No existeix cap còpia al núvol per carregar.");
      const payload = useLocal ? cache.payload : remote.payload;
      const validated = validate(payload);
      setCache({ payload, revision: remote?.revision ?? null, pending: useLocal, conflict: false });
      if (!useLocal) applyData(validated);
      connection = "connected";
      lastError = "";
    } catch (error) {
      reportError(error);
    } finally {
      busy = false;
      display();
    }
    await sync();
  }

  button.addEventListener("click", () => dialog.showModal());
  document.querySelector("#cloud-close").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      if (!client || projectMismatch) throw new Error("La sincronització no està disponible. Contacta amb l'administrador.");
      const redirectTo = location.origin + location.pathname;
      localStorage.removeItem(LOCAL_MODE_KEY);
      const { error } = await client.auth.signInWithOtp({ email: emailInput.value.trim(), options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      lastError = "";
      info = "Revisa el correu i obre l'enllaç en aquest mateix navegador.";
      display();
      notify(info);
    } catch (error) {
      reportError(error);
    }
  });
  retryButton.addEventListener("click", () => sync());
  remoteButton.addEventListener("click", () => resolveConflict(false));
  localButton.addEventListener("click", () => resolveConflict(true));
  disconnectButton.addEventListener("click", async () => {
    if (busy) {
      notify("Espera que acabi la sincronització abans de canviar de mode.", "warning");
      return;
    }
    if (!globalThis.confirm(projectMismatch
      ? "Aquesta còpia pertany a un projecte anterior i no se sincronitzarà amb el compte actual. Exporta-la abans de tornar al mode local. Vols continuar?"
      : cache.pending
      ? "Hi ha canvis sense sincronitzar. Es conservaran en aquest navegador per a aquest compte, però no arribaran al núvol fins que tornis a connectar-lo. Vols tornar al mode local?"
      : "Vols tornar al mode local? La còpia local original es conserva separada.")) return;
    try {
      const localData = readLocal();
      localStorage.setItem(LOCAL_MODE_KEY, "1");
      localStorage.removeItem(ACTIVE_KEY);
      active = undefined;
      cache = undefined;
      rawCache = undefined;
      stale = false;
      projectMismatch = false;
      connection = "local";
      lastError = "";
      info = "";
      authRequired = false;
      applyData(localData);
      display();
      dialog.close();
      if (client) {
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) {
          lastError = `No s'ha pogut tancar la sessió del núvol: ${error.message}. El mode local continua disponible.`;
          display();
          notify(lastError, true);
        }
      }
    } catch (error) {
      reportError(error);
    }
  });
  window.addEventListener("storage", event => {
    if (active && event.key === cacheKey(active.url, active.userId) && event.newValue !== rawCache) {
      stale = true;
      display();
      notify("Una altra pestanya ha modificat la còpia del núvol. Recarrega aquesta pestanya abans de continuar.", "warning");
    }
  });
  window.addEventListener("online", () => sync());
  window.addEventListener("offline", () => {
    if (active) {
      connection = "offline";
      display();
      notify("Sense connexió: els canvis es desen al dispositiu però no se sincronitzaran fins que torni la connexió.", "warning");
    }
  });
  setInterval(() => sync(), 30000);

  return {
    start() {
      try {
        config = publicConfig(projectConfig.url, projectConfig.key);
        const savedActive = localStorage.getItem(ACTIVE_KEY);
        if (savedActive) {
          const parsed = JSON.parse(savedActive);
          if (!parsed.url || !parsed.userId) throw new Error("La configuració del compte no és vàlida.");
          const stored = localStorage.getItem(cacheKey(parsed.url, parsed.userId));
          if (!stored) throw new Error("No s'ha trobat la còpia local del compte.");
          const saved = JSON.parse(stored);
          const validated = validate(saved.payload);
          active = parsed;
          cache = saved;
          rawCache = stored;
          applyData(validated);
          if (parsed.url !== config.url) {
            projectMismatch = true;
            connection = "offline";
            lastError = "Aquesta còpia pertany a un projecte anterior i no se sincronitzarà. Exporta-la abans de tornar al mode local i connectar el compte actual.";
            notify(lastError, "warning");
          }
        }
        initializeClient();
        display();
        if (active) sync();
        else if (client) client.auth.getSession().then(({ data: result, error }) => {
          if (error) throw error;
          if (result.session?.user && !localStorage.getItem(LOCAL_MODE_KEY)) return activate(result.session.user);
        }).catch(reportError);
      } catch (error) {
        reportError(error);
      }
    },
    isActive() { return Boolean(active); },
    save(payload) {
      if (!active) return false;
      if (stale) throw new Error("Una altra pestanya ha modificat aquesta còpia. Recarrega abans de desar.");
      setCache({ ...cache, payload, pending: true });
      display();
      sync();
      return true;
    }
  };
}
