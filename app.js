import en from "./lang/en.js";
import de from "./lang/de.js";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w780";
const PROFILE_KEY = "movieflip_profile_v1";
const API_KEY_STORAGE = "movieflip_tmdb_bearer";
const LANGUAGE_STORAGE = "movieflip_language";
const PROVIDERS_STORAGE = "movieflip_provider_ids";
const MIN_FLIPS_FOR_RECS = 10;
const I18N = { en, de };
const TMDB_LANGUAGE = { en: "en-US", de: "de-DE" };

const defaultLanguage = detectBrowserLanguage();

const state = {
  token: localStorage.getItem(API_KEY_STORAGE) || "",
  language: getInitialLanguage(),
  profile: loadProfile(),
  genres: new Map(),
  queue: [],
  current: null,
  loadingQueue: false,
  recs: [],
  availableProviders: [],
  providersDisplayOrder: [],
  selectedProviderIds: loadSelectedProviderIds(),
  certificationCache: new Map(),
  trailerCache: new Map(),
  providerAvailabilityCache: new Map(),
  lastAction: null,
  pendingOverride: null,
  activeLibraryView: "watched",
  lastStatusKey: "card.statusSetKey",
  confirmAction: null,
  confirmMessageKey: null,
  confirmMessageParams: null
};

const el = {
  settingsBtn: document.getElementById("settingsBtn"),
  providersBtn: document.getElementById("providersBtn"),
  settingsModal: document.getElementById("settingsModal"),
  settingsBackdrop: document.getElementById("settingsBackdrop"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  providersModal: document.getElementById("providersModal"),
  providersBackdrop: document.getElementById("providersBackdrop"),
  closeProvidersBtn: document.getElementById("closeProvidersBtn"),
  providersTitle: document.getElementById("providersTitle"),
  providersInfo: document.getElementById("providersInfo"),
  providersList: document.getElementById("providersList"),
  providersBtnLabel: document.getElementById("providersBtnLabel"),
  providersCountBadge: document.getElementById("providersCountBadge"),
  clearProvidersBtn: document.getElementById("clearProvidersBtn"),
  saveProvidersBtn: document.getElementById("saveProvidersBtn"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveApiKeyBtn: document.getElementById("saveApiKeyBtn"),
  langEnBtn: document.getElementById("langEnBtn"),
  langDeBtn: document.getElementById("langDeBtn"),
  appSubtitle: document.getElementById("appSubtitle"),
  flipCounter: document.getElementById("flipCounter"),
  likesCounter: document.getElementById("likesCounter"),
  watchedCounter: document.getElementById("watchedCounter"),
  dislikesCounter: document.getElementById("dislikesCounter"),
  flipLabel: document.getElementById("flipLabel"),
  likesLabel: document.getElementById("likesLabel"),
  watchedLabel: document.getElementById("watchedLabel"),
  dislikesLabel: document.getElementById("dislikesLabel"),
  movieCard: document.getElementById("movieCard"),
  moviePoster: document.getElementById("moviePoster"),
  movieTitle: document.getElementById("movieTitle"),
  movieMeta: document.getElementById("movieMeta"),
  movieDescriptionLabel: document.getElementById("movieDescriptionLabel"),
  movieOverview: document.getElementById("movieOverview"),
  movieKeywordsLabel: document.getElementById("movieKeywordsLabel"),
  genreList: document.getElementById("genreList"),
  emptyNote: document.getElementById("emptyNote"),
  likeBtn: document.getElementById("likeBtn"),
  watchedBtn: document.getElementById("watchedBtn"),
  bookmarkBtn: document.getElementById("bookmarkBtn"),
  dislikeBtn: document.getElementById("dislikeBtn"),
  skipBtn: document.getElementById("skipBtn"),
  backBtn: document.getElementById("backBtn"),
  recsTitle: document.getElementById("recsTitle"),
  refreshRecsBtn: document.getElementById("refreshRecsBtn"),
  libraryTitle: document.getElementById("libraryTitle"),
  clearLibraryBtn: document.getElementById("clearLibraryBtn"),
  libraryHint: document.getElementById("libraryHint"),
  libraryList: document.getElementById("libraryList"),
  libraryTabs: document.querySelectorAll(".library-tab"),
  recommendationsSection: document.getElementById("recommendationsSection"),
  recommendationsGrid: document.getElementById("recommendationsGrid"),
  settingsTitle: document.getElementById("settingsTitle"),
  settingsInfo: document.getElementById("settingsInfo"),
  settingsHelp: document.getElementById("settingsHelp"),
  confirmModal: document.getElementById("confirmModal"),
  confirmBackdrop: document.getElementById("confirmBackdrop"),
  confirmTitle: document.getElementById("confirmTitle"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
  confirmOkBtn: document.getElementById("confirmOkBtn"),
  libraryTemplate: document.getElementById("libraryItemTemplate"),
  recCardTemplate: document.getElementById("recCardTemplate")
};

init();

function init() {
  applyLanguageToUi();
  bindEvents();
  renderStats();
  renderLibrary();
  updateBackButtonState();
  updateProvidersBadge();

  if (state.token) {
    el.apiKeyInput.value = state.token;
    bootstrap().catch(showErrorOnCard);
  } else {
    openSettings();
    showStatus("card.statusSetKey");
  }
}

function detectBrowserLanguage() {
  const candidates = [
    ...(navigator.languages || []),
    navigator.language || "en"
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (candidates.some((value) => value.startsWith("de"))) {
    return "de";
  }
  return "en";
}

function getInitialLanguage() {
  const saved = localStorage.getItem(LANGUAGE_STORAGE);
  if (saved && I18N[saved]) {
    return saved;
  }
  return defaultLanguage;
}

function loadSelectedProviderIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROVIDERS_STORAGE) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function persistLanguagePreference() {
  if (state.language === defaultLanguage) {
    localStorage.removeItem(LANGUAGE_STORAGE);
    return;
  }
  localStorage.setItem(LANGUAGE_STORAGE, state.language);
}

function tmdbLanguage() {
  return TMDB_LANGUAGE[state.language] || TMDB_LANGUAGE.en;
}

function tmdbRegion() {
  return state.language === "de" ? "DE" : "US";
}

function saveSelectedProviderIds() {
  if (!state.selectedProviderIds.length) {
    localStorage.removeItem(PROVIDERS_STORAGE);
    return;
  }
  localStorage.setItem(PROVIDERS_STORAGE, JSON.stringify(state.selectedProviderIds));
}

function t(path) {
  const root = I18N[state.language] || I18N.en;
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), root) ?? path;
}

function tf(path, params = {}) {
  let text = String(t(path));
  Object.entries(params).forEach(([key, value]) => {
    text = text.replaceAll(`{${key}}`, String(value));
  });
  return text;
}

async function switchLanguage(nextLanguage) {
  if (!I18N[nextLanguage] || state.language === nextLanguage) {
    return;
  }

  state.language = nextLanguage;
  persistLanguagePreference();
  applyLanguageToUi();

  if (state.current) {
    renderMovie(state.current);
  } else {
    showStatus(state.lastStatusKey || "card.statusSetKey");
  }

  renderLibrary();
  renderRecommendations();

  if (state.token) {
    state.availableProviders = [];
    state.certificationCache.clear();
    state.providerAvailabilityCache.clear();
    state.queue = [];
    state.recs = [];
    await bootstrap().catch(showErrorOnCard);
    if (!el.providersModal.classList.contains("hidden")) {
      await loadProviders().catch(() => {});
      renderProvidersList();
    }
  }
}

function applyLanguageToUi() {
  document.documentElement.lang = state.language;

  el.langEnBtn.classList.toggle("active", state.language === "en");
  el.langDeBtn.classList.toggle("active", state.language === "de");

  el.settingsBtn.setAttribute("aria-label", t("settings.openAria"));
  el.closeSettingsBtn.setAttribute("aria-label", t("settings.closeAria"));
  el.providersBtn.setAttribute("aria-label", t("providers.openAria"));
  el.closeProvidersBtn.setAttribute("aria-label", t("providers.closeAria"));

  el.appSubtitle.textContent = t("appSubtitle");
  el.flipLabel.textContent = t("counters.flips");
  el.likesLabel.textContent = t("counters.likes");
  el.watchedLabel.textContent = t("counters.watched");
  el.dislikesLabel.textContent = t("counters.dislikes");

  el.backBtn.textContent = t("actions.back");
  el.dislikeBtn.textContent = t("actions.dislike");
  el.skipBtn.textContent = t("actions.skip");
  el.watchedBtn.textContent = t("actions.watched");
  el.bookmarkBtn.textContent = t("actions.bookmark");
  el.likeBtn.textContent = t("actions.like");
  el.movieDescriptionLabel.textContent = t("card.descriptionLabel");
  el.movieKeywordsLabel.textContent = t("card.keywordsLabel");

  el.recsTitle.textContent = t("recommendations.title");
  el.refreshRecsBtn.textContent = t("recommendations.refresh");

  el.libraryTitle.textContent = t("library.title");
  el.clearLibraryBtn.textContent = t("library.clearCurrent");

  el.libraryTabs.forEach((tab) => {
    const view = tab.dataset.view;
    tab.textContent = t(`library.tabs.${view}`);
  });

  el.settingsTitle.textContent = t("settings.title");
  el.settingsInfo.textContent = t("settings.info");
  el.saveApiKeyBtn.textContent = t("settings.saveKey");
  el.apiKeyInput.placeholder = "TMDB Bearer token";
  el.settingsHelp.innerHTML = `${t("settings.helpPrefix")} <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">themoviedb.org</a>. ${t("settings.helpSuffix")}`;
  el.providersBtnLabel.textContent = t("providers.button");
  el.providersTitle.textContent = t("providers.title");
  el.providersInfo.textContent = tf("providers.info", { region: tmdbRegion() });
  el.clearProvidersBtn.textContent = t("providers.clear");
  el.saveProvidersBtn.textContent = t("providers.save");

  el.emptyNote.textContent = t("card.emptyQueue");
  el.confirmTitle.textContent = t("confirm.title");
  el.confirmCancelBtn.textContent = t("confirm.cancel");
  el.confirmOkBtn.textContent = t("confirm.remove");
  refreshConfirmMessage();
  updateProvidersBadge();
}

async function bootstrap() {
  await loadGenres();
  await fillQueue();
  showNextMovie();
  maybeRefreshRecommendations();
}

function bindEvents() {
  el.settingsBtn.addEventListener("click", openSettings);
  el.providersBtn.addEventListener("click", () => openProvidersModal().catch(showErrorOnCard));
  el.closeSettingsBtn.addEventListener("click", closeSettings);
  el.settingsBackdrop.addEventListener("click", closeSettings);
  el.closeProvidersBtn.addEventListener("click", closeProvidersModal);
  el.providersBackdrop.addEventListener("click", closeProvidersModal);
  el.clearProvidersBtn.addEventListener("click", () => {
    state.selectedProviderIds = [];
    updateProvidersBadge();
    renderProvidersList();
  });
  el.saveProvidersBtn.addEventListener("click", () => {
    saveSelectedProviderIds();
    updateProvidersBadge();
    closeProvidersModal();
    maybeRefreshRecommendations(true);
  });
  el.confirmBackdrop.addEventListener("click", closeConfirmModal);
  el.confirmCancelBtn.addEventListener("click", closeConfirmModal);
  el.confirmOkBtn.addEventListener("click", executeConfirmAction);

  el.langEnBtn.addEventListener("click", () => {
    switchLanguage("en").catch(showErrorOnCard);
  });
  el.langDeBtn.addEventListener("click", () => {
    switchLanguage("de").catch(showErrorOnCard);
  });

  el.saveApiKeyBtn.addEventListener("click", async () => {
    const token = el.apiKeyInput.value.trim();
    if (!token) {
      return;
    }
    state.token = token;
    localStorage.setItem(API_KEY_STORAGE, token);
    closeSettings();
    await bootstrap().catch(showErrorOnCard);
  });

  el.likeBtn.addEventListener("click", () => handleDecision("like"));
  el.dislikeBtn.addEventListener("click", () => handleDecision("dislike"));
  el.watchedBtn.addEventListener("click", () => handleDecision("watched"));
  el.bookmarkBtn.addEventListener("click", () => handleDecision("bookmark"));
  el.skipBtn.addEventListener("click", () => handleSkip());
  el.backBtn.addEventListener("click", () => handleBack());
  el.clearLibraryBtn.addEventListener("click", () => clearActiveLibrary());
  el.libraryTabs.forEach((tab) => {
    tab.addEventListener("click", () => setActiveLibraryView(tab.dataset.view));
  });
  el.refreshRecsBtn.addEventListener("click", () => maybeRefreshRecommendations(true));

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.settingsModal.classList.contains("hidden")) {
      closeSettings();
      return;
    }
    if (event.key === "Escape" && !el.providersModal.classList.contains("hidden")) {
      closeProvidersModal();
      return;
    }
    if (event.key === "Escape" && !el.confirmModal.classList.contains("hidden")) {
      closeConfirmModal();
      return;
    }
    if (!state.current) {
      return;
    }
    if (event.key === "ArrowRight") {
      handleDecision("like");
    }
    if (event.key === "ArrowLeft") {
      handleDecision("dislike");
    }
    if (event.key === "ArrowUp") {
      handleDecision("watched");
    }
    if (event.key.toLowerCase() === "b") {
      handleDecision("bookmark");
    }
    if (event.key === "ArrowDown") {
      handleSkip();
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      handleBack();
    }
  });
}

function openSettings() {
  el.settingsModal.classList.remove("hidden");
  el.settingsModal.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  if (!state.token) {
    return;
  }
  el.settingsModal.classList.add("hidden");
  el.settingsModal.setAttribute("aria-hidden", "true");
}

async function openProvidersModal() {
  if (!state.token) {
    openSettings();
    return;
  }
  await loadProviders();
  prepareProvidersDisplayOrder();
  renderProvidersList();
  el.providersModal.classList.remove("hidden");
  el.providersModal.setAttribute("aria-hidden", "false");
}

function closeProvidersModal() {
  el.providersModal.classList.add("hidden");
  el.providersModal.setAttribute("aria-hidden", "true");
}

async function loadProviders() {
  const payload = await api("/watch/providers/movie", `language=${tmdbLanguage()}&watch_region=${tmdbRegion()}`);
  const results = Array.isArray(payload.results) ? payload.results : [];
  state.availableProviders = results
    .filter((item) => item && Number.isInteger(item.provider_id))
    .sort((a, b) => String(a.provider_name).localeCompare(String(b.provider_name)));
}

function renderProvidersList() {
  el.providersInfo.textContent = tf("providers.info", { region: tmdbRegion() });
  el.providersList.innerHTML = "";

  if (!state.availableProviders.length) {
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = t("providers.empty");
    el.providersList.appendChild(p);
    return;
  }

  const selected = new Set(state.selectedProviderIds);
  const orderedProviders = state.providersDisplayOrder.length
    ? state.providersDisplayOrder
    : state.availableProviders;

  orderedProviders.forEach((provider) => {
    const badge = document.createElement("button");
    const isSelected = selected.has(provider.provider_id);
    badge.type = "button";
    badge.className = `provider-badge${isSelected ? " selected" : ""}`;
    badge.textContent = provider.provider_name;
    badge.setAttribute("aria-pressed", isSelected ? "true" : "false");
    badge.addEventListener("click", () => {
      if (selected.has(provider.provider_id)) {
        selected.delete(provider.provider_id);
      } else {
        selected.add(provider.provider_id);
      }
      state.selectedProviderIds = Array.from(selected);
      updateProvidersBadge();
      renderProvidersList();
    });
    el.providersList.appendChild(badge);
  });
}

function prepareProvidersDisplayOrder() {
  const selected = new Set(state.selectedProviderIds);
  state.providersDisplayOrder = [...state.availableProviders].sort((a, b) => {
    const aSelected = selected.has(a.provider_id) ? 0 : 1;
    const bSelected = selected.has(b.provider_id) ? 0 : 1;
    if (aSelected !== bSelected) {
      return aSelected - bSelected;
    }
    return String(a.provider_name).localeCompare(String(b.provider_name), state.language);
  });
}

function updateProvidersBadge() {
  const count = state.selectedProviderIds.length;
  el.providersCountBadge.textContent = String(count);
  el.providersCountBadge.hidden = count === 0;
}

function openConfirmModal(messageKey, params, onConfirm) {
  state.confirmMessageKey = messageKey;
  state.confirmMessageParams = params || {};
  state.confirmAction = onConfirm;
  refreshConfirmMessage();
  el.confirmModal.classList.remove("hidden");
  el.confirmModal.setAttribute("aria-hidden", "false");
}

function closeConfirmModal() {
  state.confirmAction = null;
  state.confirmMessageKey = null;
  state.confirmMessageParams = null;
  el.confirmModal.classList.add("hidden");
  el.confirmModal.setAttribute("aria-hidden", "true");
}

function refreshConfirmMessage() {
  if (!state.confirmMessageKey) {
    return;
  }
  el.confirmMessage.textContent = tf(state.confirmMessageKey, state.confirmMessageParams || {});
}

function executeConfirmAction() {
  const action = state.confirmAction;
  closeConfirmModal();
  if (typeof action === "function") {
    action();
  }
}

function loadProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return {
      flips: parsed.flips || 0,
      likes: parsed.likes || [],
      dislikes: parsed.dislikes || [],
      watched: parsed.watched || [],
      bookmarks: parsed.bookmarks || [],
      ratings: parsed.ratings || {},
      seenIds: parsed.seenIds || []
    };
  } catch {
    return { flips: 0, likes: [], dislikes: [], watched: [], bookmarks: [], ratings: {}, seenIds: [] };
  }
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile));
}

async function api(path, query = "") {
  if (!state.token) {
    throw new Error("Missing TMDB token");
  }

  const joiner = query ? "?" : "";
  const res = await fetch(`${TMDB_BASE}${path}${joiner}${query}`, {
    headers: {
      Authorization: `Bearer ${state.token}`,
      "Content-Type": "application/json;charset=utf-8"
    }
  });

  if (!res.ok) {
    throw new Error(`TMDB request failed: ${res.status}`);
  }

  return res.json();
}

async function loadGenres() {
  const payload = await api("/genre/movie/list", `language=${tmdbLanguage()}`);
  state.genres = new Map(payload.genres.map((g) => [g.id, g.name]));
}

async function fillQueue() {
  if (state.loadingQueue) {
    return;
  }

  state.loadingQueue = true;
  el.emptyNote.hidden = false;

  try {
    const pages = pickRandomPages(3, 1, 60);
    const calls = pages.map((page) =>
      api(
        "/discover/movie",
        `include_adult=false&include_video=false&language=${tmdbLanguage()}&page=${page}&sort_by=popularity.desc&vote_count.gte=80`
      )
    );

    const results = await Promise.all(calls);
    const pool = results.flatMap((p) => p.results);
    const filtered = pool.filter((movie) => !isExcluded(movie.id));

    const unique = dedupeById(filtered);
    shuffle(unique);

    state.queue.push(...unique.slice(0, 30));
  } finally {
    state.loadingQueue = false;
    el.emptyNote.hidden = true;
  }
}

function showNextMovie() {
  state.current = state.queue.shift() || null;

  if (!state.current) {
    showStatus("card.statusLoadingMore");
    fillQueue().then(() => {
      state.current = state.queue.shift() || null;
      if (state.current) {
        renderMovie(state.current);
      } else {
        showStatus("card.statusNoUnseen");
      }
    }).catch(showErrorOnCard);
    return;
  }

  renderMovie(state.current);
  if (state.queue.length < 8) {
    fillQueue().catch(() => {});
  }
}

function renderMovie(movie) {
  const na = t("meta.na");
  el.moviePoster.src = movie.poster_path ? `${TMDB_IMG}${movie.poster_path}` : "";
  el.moviePoster.alt = movie.title || t("card.moviePosterAlt");
  el.movieTitle.textContent = movie.title || t("card.loadMovie");
  el.movieMeta.textContent = formatMovieMeta(movie, na);
  el.movieOverview.textContent = movie.overview || t("card.noOverview");

  el.genreList.innerHTML = "";
  for (const genreId of movie.genre_ids || []) {
    const chip = document.createElement("span");
    chip.textContent = state.genres.get(genreId) || t("card.unknownGenre");
    el.genreList.appendChild(chip);
  }

  fetchMovieCertification(movie.id).then((certification) => {
    if (state.current && state.current.id === movie.id) {
      el.movieMeta.textContent = formatMovieMeta(movie, certification);
    }
  }).catch(() => {});
}

function formatMovieMeta(movie, certification) {
  const na = t("meta.na");
  const year = movie.release_date ? movie.release_date.slice(0, 4) : na;
  const rating = Number(movie.vote_average || 0).toFixed(1);
  const age = certification || na;
  return `${year} · ${t("card.ratingLabel")} ${rating} · ${t("card.ageLabel")} ${age}`;
}

async function fetchMovieCertification(movieId) {
  if (state.certificationCache.has(movieId)) {
    return state.certificationCache.get(movieId);
  }

  let certification = t("meta.na");
  try {
    const payload = await api(`/movie/${movieId}/release_dates`);
    certification = extractCertification(payload.results || [], tmdbRegion()) || t("meta.na");
  } catch {
    certification = t("meta.na");
  }

  state.certificationCache.set(movieId, certification);
  return certification;
}

function extractCertification(results, preferredRegion) {
  const preferred = results.find((item) => item.iso_3166_1 === preferredRegion);
  const fallback = preferred || results[0];
  if (!fallback || !Array.isArray(fallback.release_dates)) {
    return "";
  }

  const withCert = fallback.release_dates.find((entry) => entry.certification && entry.certification.trim());
  return withCert ? withCert.certification.trim() : "";
}

async function fetchMovieTrailerUrl(movieId) {
  if (state.trailerCache.has(movieId)) {
    return state.trailerCache.get(movieId);
  }

  let trailerUrl = "";
  try {
    const payload = await api(`/movie/${movieId}/videos`, `language=${tmdbLanguage()}`);
    trailerUrl = selectTrailerUrl(payload?.results || []);
  } catch {
    trailerUrl = "";
  }

  state.trailerCache.set(movieId, trailerUrl);
  return trailerUrl;
}

function selectTrailerUrl(results) {
  if (!Array.isArray(results) || !results.length) {
    return "";
  }

  const languageCode = state.language === "de" ? "de" : "en";
  const regionCode = tmdbRegion();

  const scoreVideo = (video) => {
    let score = 0;
    if (video.type === "Trailer") {
      score += 4;
    }
    if (video.official) {
      score += 2;
    }
    if (video.iso_639_1 === languageCode) {
      score += 1;
    }
    if (video.iso_3166_1 === regionCode) {
      score += 1;
    }
    return score;
  };

  const youtube = results
    .filter((video) => video?.site === "YouTube" && video?.key)
    .sort((a, b) => scoreVideo(b) - scoreVideo(a));
  if (youtube[0]?.key) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(youtube[0].key)}`;
  }

  const vimeo = results
    .filter((video) => video?.site === "Vimeo" && video?.key)
    .sort((a, b) => scoreVideo(b) - scoreVideo(a));
  if (vimeo[0]?.key) {
    return `https://vimeo.com/${encodeURIComponent(vimeo[0].key)}`;
  }

  return "";
}

async function fetchProviderAvailability(movieId) {
  const cacheKey = `${movieId}:${tmdbRegion()}:${state.selectedProviderIds.slice().sort((a, b) => a - b).join(",")}`;
  if (state.providerAvailabilityCache.has(cacheKey)) {
    return state.providerAvailabilityCache.get(cacheKey);
  }

  let availability = null;
  try {
    const payload = await api(`/movie/${movieId}/watch/providers`);
    const regional = payload?.results?.[tmdbRegion()];
    if (!regional) {
      availability = {
        link: "",
        matchedProviders: [],
        fallbackProviders: []
      };
    } else {
      const buckets = [
        ...(regional.flatrate || []),
        ...(regional.free || []),
        ...(regional.ads || []),
        ...(regional.rent || []),
        ...(regional.buy || [])
      ];
      const unique = new Map();
      buckets.forEach((provider) => {
        if (provider && Number.isInteger(provider.provider_id)) {
          unique.set(provider.provider_id, provider.provider_name || String(provider.provider_id));
        }
      });
      const namesById = unique;
      const matchedProviders = state.selectedProviderIds
        .filter((id) => namesById.has(id))
        .map((id) => namesById.get(id));
      const fallbackProviders = Array.from(namesById.values()).sort((a, b) => String(a).localeCompare(String(b), state.language));
      availability = {
        link: regional.link || "",
        matchedProviders,
        fallbackProviders
      };
    }
  } catch {
    availability = {
      link: "",
      matchedProviders: [],
      fallbackProviders: []
    };
  }

  state.providerAvailabilityCache.set(cacheKey, availability);
  return availability;
}

function showStatus(statusKey) {
  state.lastStatusKey = statusKey;
  el.moviePoster.src = "";
  el.movieTitle.textContent = t(statusKey);
  el.movieMeta.textContent = "";
  el.movieOverview.textContent = "";
  el.genreList.innerHTML = "";
}

function showErrorOnCard(err) {
  console.error(err);
  showStatus("card.statusApiError");
}

function handleDecision(type) {
  const movie = state.current;
  if (!movie) {
    return;
  }

  const isOverrideDecision = Boolean(state.pendingOverride && state.pendingOverride.movie.id === movie.id);
  if (!isOverrideDecision) {
    state.profile.flips += 1;
    state.profile.seenIds.push(movie.id);
  }

  if (type === "like") {
    state.profile.likes.push(toMinimalMovie(movie));
    flick("like");
  }

  if (type === "dislike") {
    state.profile.dislikes.push(toMinimalMovie(movie));
    flick("dislike");
  }

  if (type === "watched") {
    state.profile.watched.push(toMinimalMovie(movie));
    if (!state.profile.ratings[movie.id]) {
      state.profile.ratings[movie.id] = 3;
    }
    state.activeLibraryView = "watched";
    flick("watched");
  }

  if (type === "bookmark") {
    state.profile.bookmarks.push(toMinimalMovie(movie));
    flick("bookmark");
  }

  state.pendingOverride = null;
  state.lastAction = { movie: { ...movie }, type };
  dedupeProfileLists();
  ensureSeenIdsContainsLists();
  saveProfile();
  renderStats();
  renderLibrary();
  updateBackButtonState();
  showNextMovie();
  maybeRefreshRecommendations();
}

function handleSkip() {
  if (!state.current) {
    return;
  }

  if (state.pendingOverride && state.pendingOverride.movie.id === state.current.id) {
    state.pendingOverride = null;
    saveProfile();
    renderStats();
    renderLibrary();
    updateBackButtonState();
    maybeRefreshRecommendations(true);
  }

  flick("skip");
  showNextMovie();
}

function handleBack() {
  if (!state.lastAction || state.pendingOverride) {
    return;
  }

  const { movie, type } = state.lastAction;
  undoDecision(movie.id, type);
  state.pendingOverride = state.lastAction;
  state.lastAction = null;

  if (state.current && state.current.id !== movie.id) {
    state.queue.unshift(state.current);
  }

  state.current = movie;
  renderMovie(movie);
  saveProfile();
  renderStats();
  renderLibrary();
  updateBackButtonState();
  maybeRefreshRecommendations(true);
}

function flick(type) {
  const cls = type === "like"
    ? "flick-like"
    : type === "dislike"
      ? "flick-dislike"
      : type === "bookmark"
        ? "flick-like"
        : type === "skip"
          ? "flick-dislike"
          : "flick-watched";
  el.movieCard.classList.add(cls);
  setTimeout(() => el.movieCard.classList.remove(cls), 160);
}

function dedupeProfileLists() {
  state.profile.likes = dedupeById(state.profile.likes);
  state.profile.dislikes = dedupeById(state.profile.dislikes);
  state.profile.watched = dedupeById(state.profile.watched);
  state.profile.bookmarks = dedupeById(state.profile.bookmarks);
  ensureSeenIdsContainsLists();
}

function renderStats() {
  el.flipCounter.textContent = String(state.profile.flips);
  el.likesCounter.textContent = String(state.profile.likes.length);
  el.watchedCounter.textContent = String(state.profile.watched.length);
  el.dislikesCounter.textContent = String(state.profile.dislikes.length);
}

function updateBackButtonState() {
  const canGoBack = Boolean(state.lastAction) && !state.pendingOverride;
  el.backBtn.disabled = !canGoBack;
}

function setActiveLibraryView(view) {
  const allowed = new Set(["watched", "bookmarks", "likes", "dislikes"]);
  state.activeLibraryView = allowed.has(view) ? view : "watched";
  renderLibrary();
}

function getActiveLibraryItems() {
  if (state.activeLibraryView === "likes") {
    return state.profile.likes;
  }
  if (state.activeLibraryView === "dislikes") {
    return state.profile.dislikes;
  }
  if (state.activeLibraryView === "bookmarks") {
    return state.profile.bookmarks;
  }
  return state.profile.watched;
}

function renderLibrary() {
  const hintMap = {
    watched: t("library.hints.watched"),
    bookmarks: t("library.hints.bookmarks"),
    likes: t("library.hints.likes"),
    dislikes: t("library.hints.dislikes")
  };

  el.libraryTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === state.activeLibraryView);
  });

  el.libraryHint.textContent = hintMap[state.activeLibraryView] || "";
  el.libraryList.innerHTML = "";
  const movies = getActiveLibraryItems();

  if (!movies.length) {
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = t("library.empty");
    el.libraryList.appendChild(p);
    return;
  }

  movies.forEach((movie) => {
    const node = el.libraryTemplate.content.cloneNode(true);
    const title = node.querySelector(".watched-title");
    const actions = node.querySelector(".watched-actions");
    const ratingGroup = node.querySelector(".rating-group");
    const menuPanel = node.querySelector(".item-menu-panel");
    title.textContent = movie.title;
    ratingGroup.innerHTML = "";
    menuPanel.innerHTML = "";

    if (state.activeLibraryView === "watched") {
      const selected = state.profile.ratings[movie.id] || 3;
      for (let score = 1; score <= 5; score += 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = String(score);
        if (score === selected) {
          btn.classList.add("active");
        }
        btn.addEventListener("click", () => {
          state.profile.ratings[movie.id] = score;
          if (!state.profile.seenIds.includes(movie.id)) {
            state.profile.seenIds.push(movie.id);
          }
          saveProfile();
          renderLibrary();
          maybeRefreshRecommendations(true);
        });
        ratingGroup.appendChild(btn);
      }
    }

    if (state.activeLibraryView === "bookmarks") {
      menuPanel.appendChild(buildMenuButton(t("library.watched"), () => markBookmarkedAsWatched(movie.id)));
      if (state.selectedProviderIds.length > 0) {
        const providerLink = document.createElement("a");
        providerLink.className = "menu-link-btn";
        providerLink.target = "_blank";
        providerLink.rel = "noreferrer";
        providerLink.href = "#";
        providerLink.textContent = t("library.providerLoading");
        providerLink.style.pointerEvents = "none";
        providerLink.style.opacity = "0.7";
        menuPanel.appendChild(providerLink);

        fetchProviderAvailability(movie.id).then((availability) => {
          if (!availability) {
            providerLink.textContent = t("library.providerUnavailable");
            return;
          }

          if (availability.matchedProviders.length > 0 && availability.link) {
            providerLink.href = availability.link;
            providerLink.textContent = tf("library.providerOpen", { provider: availability.matchedProviders[0] });
            providerLink.style.pointerEvents = "auto";
            providerLink.style.opacity = "1";
            return;
          }

          const fallback = availability.fallbackProviders.slice(0, 4).join(", ");
          providerLink.textContent = tf("library.providerFallback", { list: fallback || t("library.providerUnavailable") });
          if (availability.link) {
            providerLink.href = availability.link;
            providerLink.style.pointerEvents = "auto";
            providerLink.style.opacity = "1";
          }
        }).catch(() => {
          providerLink.textContent = t("library.providerUnavailable");
        });
      }
    }

    if (state.activeLibraryView === "likes") {
      menuPanel.appendChild(buildMenuButton(t("library.moveToWatched"), () => moveLikedToWatched(movie.id)));
    }

    if (state.activeLibraryView === "watched" || state.activeLibraryView === "likes" || state.activeLibraryView === "dislikes") {
      menuPanel.appendChild(buildMenuButton(t("library.bookmark"), () => bookmarkFromLibrary(movie.id)));
    }

    menuPanel.appendChild(buildMenuButton(t("library.remove"), () => removeFromActiveLibrary(movie.id), "remove-watched-btn"));

    el.libraryList.appendChild(node);
  });
}

function buildMenuButton(label, onClick, className = "") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  if (className) {
    btn.className = className;
  }
  btn.addEventListener("click", onClick);
  return btn;
}

function clearActiveLibrary() {
  const view = state.activeLibraryView;
  const currentItems = getActiveLibraryItems();
  if (!currentItems.length) {
    return;
  }

  openConfirmModal("confirm.clearCurrent", {}, () => doClearActiveLibrary(view));
}

function doClearActiveLibrary(view) {
  if (view === "watched") {
    state.profile.watched = [];
    state.profile.ratings = {};
  } else if (view === "bookmarks") {
    state.profile.bookmarks = [];
  } else if (view === "likes") {
    state.profile.likes = [];
  } else if (view === "dislikes") {
    state.profile.dislikes = [];
  }
  ensureSeenIdsContainsLists();
  saveProfile();
  renderStats();
  renderLibrary();
  maybeRefreshRecommendations(true);
}

function removeFromActiveLibrary(movieId) {
  const view = state.activeLibraryView;
  const list = view === "watched"
    ? state.profile.watched
    : view === "bookmarks"
      ? state.profile.bookmarks
      : view === "likes"
        ? state.profile.likes
        : state.profile.dislikes;
  const movie = list.find((item) => item.id === movieId);
  if (!movie) {
    return;
  }
  openConfirmModal("confirm.single", { title: movie.title }, () => doRemoveFromLibrary(movieId, view));
}

function doRemoveFromLibrary(movieId, view) {
  if (view === "watched") {
    state.profile.watched = state.profile.watched.filter((movie) => movie.id !== movieId);
    delete state.profile.ratings[movieId];
  } else if (view === "bookmarks") {
    state.profile.bookmarks = state.profile.bookmarks.filter((movie) => movie.id !== movieId);
  } else if (view === "likes") {
    state.profile.likes = state.profile.likes.filter((movie) => movie.id !== movieId);
  } else if (view === "dislikes") {
    state.profile.dislikes = state.profile.dislikes.filter((movie) => movie.id !== movieId);
  }

  ensureSeenIdsContainsLists();
  saveProfile();
  renderStats();
  renderLibrary();
  maybeRefreshRecommendations(true);
}

function markBookmarkedAsWatched(movieId) {
  const movie = state.profile.bookmarks.find((item) => item.id === movieId);
  if (!movie) {
    return;
  }
  state.profile.watched.push(movie);
  state.profile.bookmarks = state.profile.bookmarks.filter((item) => item.id !== movieId);
  if (!state.profile.ratings[movieId]) {
    state.profile.ratings[movieId] = 3;
  }
  if (!state.profile.seenIds.includes(movieId)) {
    state.profile.seenIds.push(movieId);
  }
  state.activeLibraryView = "watched";
  dedupeProfileLists();
  saveProfile();
  renderStats();
  renderLibrary();
  maybeRefreshRecommendations(true);
}

function moveLikedToWatched(movieId) {
  const movie = state.profile.likes.find((item) => item.id === movieId);
  if (!movie) {
    return;
  }
  state.profile.watched.push(movie);
  state.profile.likes = state.profile.likes.filter((item) => item.id !== movieId);
  if (!state.profile.ratings[movieId]) {
    state.profile.ratings[movieId] = 3;
  }
  if (!state.profile.seenIds.includes(movieId)) {
    state.profile.seenIds.push(movieId);
  }
  state.activeLibraryView = "watched";
  dedupeProfileLists();
  saveProfile();
  renderStats();
  renderLibrary();
  maybeRefreshRecommendations(true);
}

function bookmarkFromLibrary(movieId) {
  const source = state.activeLibraryView;
  if (source === "bookmarks") {
    return;
  }

  const list = source === "watched"
    ? state.profile.watched
    : source === "likes"
      ? state.profile.likes
      : state.profile.dislikes;
  const movie = list.find((item) => item.id === movieId);
  if (!movie) {
    return;
  }

  state.profile.bookmarks.push(movie);
  dedupeProfileLists();
  saveProfile();
  renderStats();
  renderLibrary();
}

function buildGenreWeights() {
  const map = new Map();

  const add = (genreIds, weight) => {
    for (const id of genreIds || []) {
      map.set(id, (map.get(id) || 0) + weight);
    }
  };

  for (const movie of state.profile.likes) {
    add(movie.genre_ids, 2.0);
  }

  for (const movie of state.profile.dislikes) {
    add(movie.genre_ids, -2.0);
  }

  for (const movie of state.profile.watched) {
    const rating = state.profile.ratings[movie.id] || 3;
    const centered = (rating - 3) * 1.2;
    add(movie.genre_ids, 1.0 + centered);
  }

  return map;
}

function maybeRefreshRecommendations(force = false) {
  if (!force && state.profile.flips < MIN_FLIPS_FOR_RECS) {
    el.recommendationsSection.hidden = true;
    return;
  }

  el.recommendationsSection.hidden = false;
  fetchRecommendations().catch((err) => {
    console.error(err);
  });
}

async function fetchRecommendations() {
  const genreWeights = buildGenreWeights();
  const topGenreIds = Array.from(genreWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id)
    .filter((id) => (genreWeights.get(id) || 0) > -0.5);

  const pages = pickRandomPages(2, 1, 70);
  const providerParam = state.selectedProviderIds.length
    ? `&watch_region=${tmdbRegion()}&with_watch_providers=${state.selectedProviderIds.join("|")}`
    : "";
  const queries = pages.map((page) => {
    const genreParam = topGenreIds.length ? `&with_genres=${topGenreIds.join("|")}` : "";
    return api(
      "/discover/movie",
      `include_adult=false&include_video=false&language=${tmdbLanguage()}&page=${page}&sort_by=vote_count.desc${genreParam}${providerParam}`
    );
  });

  const responses = await Promise.all(queries);
  const pool = dedupeById(responses.flatMap((r) => r.results));
  const candidates = pool.filter((movie) => !isExcluded(movie.id));

  const scored = candidates
    .map((movie) => ({
      movie,
      score: scoreMovie(movie, genreWeights)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((entry) => entry.movie);

  state.recs = scored;
  renderRecommendations();
}

function renderRecommendations() {
  el.recommendationsGrid.innerHTML = "";
  if (!state.recs.length) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = t("recommendations.empty");
    el.recommendationsGrid.appendChild(note);
    return;
  }

  for (const movie of state.recs) {
    const node = el.recCardTemplate.content.cloneNode(true);
    const poster = node.querySelector(".rec-poster");
    const trailerLink = node.querySelector(".rec-link.trailer");
    const tmdbLink = node.querySelector(".rec-link.tmdb");
    const title = node.querySelector(".rec-title");
    const meta = node.querySelector(".rec-meta");
    const likeBtn = node.querySelector(".rec-action.like");
    const dislikeBtn = node.querySelector(".rec-action.dislike");
    const watchedBtn = node.querySelector(".rec-action.watched");
    const bookmarkBtn = node.querySelector(".rec-action.bookmark");

    poster.src = movie.poster_path ? `${TMDB_IMG}${movie.poster_path}` : "";
    poster.alt = `${movie.title} ${t("recCard.posterSuffix")}`;
    trailerLink.href = "#";
    trailerLink.hidden = true;
    trailerLink.setAttribute("aria-label", t("recCard.openTrailerAria"));
    tmdbLink.href = `https://www.themoviedb.org/movie/${movie.id}`;
    tmdbLink.setAttribute("aria-label", t("recCard.openTmdbAria"));
    title.textContent = movie.title;

    meta.textContent = formatMovieMeta(movie, t("meta.na"));

    likeBtn.textContent = t("recCard.like");
    dislikeBtn.textContent = t("recCard.dislike");
    watchedBtn.textContent = t("recCard.watched");
    bookmarkBtn.textContent = t("recCard.bookmark");

    likeBtn.addEventListener("click", () => handleRecommendationAction(movie, "like"));
    dislikeBtn.addEventListener("click", () => handleRecommendationAction(movie, "dislike"));
    watchedBtn.addEventListener("click", () => handleRecommendationAction(movie, "watched"));
    bookmarkBtn.addEventListener("click", () => handleRecommendationAction(movie, "bookmark"));

    fetchMovieCertification(movie.id).then((certification) => {
      meta.textContent = formatMovieMeta(movie, certification);
    }).catch(() => {});
    fetchMovieTrailerUrl(movie.id).then((url) => {
      if (!url) {
        return;
      }
      trailerLink.href = url;
      trailerLink.hidden = false;
    }).catch(() => {});

    el.recommendationsGrid.appendChild(node);
  }
}

function handleRecommendationAction(movie, type) {
  if (!movie) {
    return;
  }

  if (type === "like") {
    state.profile.likes.push(toMinimalMovie(movie));
  }
  if (type === "dislike") {
    state.profile.dislikes.push(toMinimalMovie(movie));
  }
  if (type === "watched") {
    state.profile.watched.push(toMinimalMovie(movie));
    if (!state.profile.ratings[movie.id]) {
      state.profile.ratings[movie.id] = 3;
    }
    state.activeLibraryView = "watched";
  }
  if (type === "bookmark") {
    state.profile.bookmarks.push(toMinimalMovie(movie));
  }

  dedupeProfileLists();
  if (!state.profile.seenIds.includes(movie.id)) {
    state.profile.seenIds.push(movie.id);
  }
  state.recs = state.recs.filter((rec) => rec.id !== movie.id);
  state.queue = state.queue.filter((queuedMovie) => queuedMovie.id !== movie.id);
  saveProfile();
  renderStats();
  renderLibrary();
  updateBackButtonState();
  renderRecommendations();
  maybeRefreshRecommendations(true);
}

function scoreMovie(movie, genreWeights) {
  let score = 0;
  for (const id of movie.genre_ids || []) {
    score += genreWeights.get(id) || 0;
  }
  score += Number(movie.vote_average || 0) * 0.18;
  score += Number(movie.popularity || 0) * 0.002;
  return score;
}

function undoDecision(movieId, type) {
  if (type === "like") {
    state.profile.likes = state.profile.likes.filter((movie) => movie.id !== movieId);
  }
  if (type === "dislike") {
    state.profile.dislikes = state.profile.dislikes.filter((movie) => movie.id !== movieId);
  }
  if (type === "watched") {
    state.profile.watched = state.profile.watched.filter((movie) => movie.id !== movieId);
    delete state.profile.ratings[movieId];
  }
  if (type === "bookmark") {
    state.profile.bookmarks = state.profile.bookmarks.filter((movie) => movie.id !== movieId);
  }
  ensureSeenIdsContainsLists();
}

function isExcluded(movieId) {
  const p = state.profile;
  return p.seenIds.includes(movieId)
    || p.watched.some((m) => m.id === movieId)
    || p.bookmarks.some((m) => m.id === movieId)
    || p.likes.some((m) => m.id === movieId)
    || p.dislikes.some((m) => m.id === movieId);
}

function toMinimalMovie(movie) {
  return {
    id: movie.id,
    title: movie.title,
    poster_path: movie.poster_path,
    genre_ids: movie.genre_ids || [],
    release_date: movie.release_date,
    vote_average: movie.vote_average
  };
}

function dedupeById(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function ensureSeenIdsContainsLists() {
  const ids = new Set([
    ...(state.profile.seenIds || []),
    ...state.profile.likes.map((movie) => movie.id),
    ...state.profile.dislikes.map((movie) => movie.id),
    ...state.profile.bookmarks.map((movie) => movie.id),
    ...state.profile.watched.map((movie) => movie.id)
  ]);
  state.profile.seenIds = Array.from(ids);
}

function pickRandomPages(count, min, max) {
  const picks = new Set();
  while (picks.size < count) {
    picks.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  return Array.from(picks);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
