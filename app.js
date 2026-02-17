const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w780";
const PROFILE_KEY = "movieflip_profile_v1";
const API_KEY_STORAGE = "movieflip_tmdb_bearer";
const MIN_FLIPS_FOR_RECS = 10;

const state = {
  token: localStorage.getItem(API_KEY_STORAGE) || "",
  profile: loadProfile(),
  genres: new Map(),
  queue: [],
  current: null,
  loadingQueue: false,
  recs: []
};

const el = {
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveApiKeyBtn: document.getElementById("saveApiKeyBtn"),
  flipCounter: document.getElementById("flipCounter"),
  likesCounter: document.getElementById("likesCounter"),
  watchedCounter: document.getElementById("watchedCounter"),
  dislikesCounter: document.getElementById("dislikesCounter"),
  movieCard: document.getElementById("movieCard"),
  moviePoster: document.getElementById("moviePoster"),
  movieTitle: document.getElementById("movieTitle"),
  movieMeta: document.getElementById("movieMeta"),
  movieOverview: document.getElementById("movieOverview"),
  genreList: document.getElementById("genreList"),
  emptyNote: document.getElementById("emptyNote"),
  likeBtn: document.getElementById("likeBtn"),
  watchedBtn: document.getElementById("watchedBtn"),
  dislikeBtn: document.getElementById("dislikeBtn"),
  recommendationsSection: document.getElementById("recommendationsSection"),
  recommendationsGrid: document.getElementById("recommendationsGrid"),
  refreshRecsBtn: document.getElementById("refreshRecsBtn"),
  watchedList: document.getElementById("watchedList"),
  watchedTemplate: document.getElementById("watchedItemTemplate"),
  recCardTemplate: document.getElementById("recCardTemplate")
};

init();

function init() {
  bindEvents();
  renderStats();
  renderWatchedList();

  if (state.token) {
    el.apiKeyInput.value = state.token;
    bootstrap().catch(showErrorOnCard);
  } else {
    showStatus("Set your TMDB key to start.");
  }
}

async function bootstrap() {
  await loadGenres();
  await fillQueue();
  showNextMovie();
  maybeRefreshRecommendations();
}

function bindEvents() {
  el.saveApiKeyBtn.addEventListener("click", async () => {
    const token = el.apiKeyInput.value.trim();
    if (!token) {
      return;
    }
    state.token = token;
    localStorage.setItem(API_KEY_STORAGE, token);
    await bootstrap().catch(showErrorOnCard);
  });

  el.likeBtn.addEventListener("click", () => handleDecision("like"));
  el.dislikeBtn.addEventListener("click", () => handleDecision("dislike"));
  el.watchedBtn.addEventListener("click", () => handleDecision("watched"));
  el.refreshRecsBtn.addEventListener("click", () => maybeRefreshRecommendations(true));

  window.addEventListener("keydown", (event) => {
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
  });
}

function loadProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return {
      flips: parsed.flips || 0,
      likes: parsed.likes || [],
      dislikes: parsed.dislikes || [],
      watched: parsed.watched || [],
      ratings: parsed.ratings || {},
      seenIds: parsed.seenIds || []
    };
  } catch {
    return { flips: 0, likes: [], dislikes: [], watched: [], ratings: {}, seenIds: [] };
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
  const payload = await api("/genre/movie/list", "language=en-US");
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
        `include_adult=false&include_video=false&language=en-US&page=${page}&sort_by=popularity.desc&vote_count.gte=80`
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
    showStatus("Loading more movies...");
    fillQueue().then(() => {
      state.current = state.queue.shift() || null;
      if (state.current) {
        renderMovie(state.current);
      } else {
        showStatus("No unseen movies found right now.");
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
  el.moviePoster.src = movie.poster_path ? `${TMDB_IMG}${movie.poster_path}` : "";
  el.moviePoster.alt = movie.title || "Movie poster";
  el.movieTitle.textContent = movie.title || "Untitled";
  const year = movie.release_date ? movie.release_date.slice(0, 4) : "n/a";
  el.movieMeta.textContent = `${year} · Rating ${Number(movie.vote_average || 0).toFixed(1)}`;
  el.movieOverview.textContent = movie.overview || "No overview available.";

  el.genreList.innerHTML = "";
  for (const genreId of movie.genre_ids || []) {
    const chip = document.createElement("span");
    chip.textContent = state.genres.get(genreId) || "Unknown";
    el.genreList.appendChild(chip);
  }
}

function showStatus(text) {
  el.moviePoster.src = "";
  el.movieTitle.textContent = text;
  el.movieMeta.textContent = "";
  el.movieOverview.textContent = "";
  el.genreList.innerHTML = "";
}

function showErrorOnCard(err) {
  console.error(err);
  showStatus("Could not load movies. Verify your TMDB token.");
}

function handleDecision(type) {
  const movie = state.current;
  if (!movie) {
    return;
  }

  state.profile.flips += 1;
  state.profile.seenIds.push(movie.id);

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
    flick("watched");
  }

  dedupeProfileLists();
  saveProfile();
  renderStats();
  renderWatchedList();
  showNextMovie();
  maybeRefreshRecommendations();
}

function flick(type) {
  const cls = type === "like" ? "flick-like" : type === "dislike" ? "flick-dislike" : "flick-watched";
  el.movieCard.classList.add(cls);
  setTimeout(() => el.movieCard.classList.remove(cls), 160);
}

function dedupeProfileLists() {
  state.profile.likes = dedupeById(state.profile.likes);
  state.profile.dislikes = dedupeById(state.profile.dislikes);
  state.profile.watched = dedupeById(state.profile.watched);

  const all = new Set([
    ...state.profile.likes.map((m) => m.id),
    ...state.profile.dislikes.map((m) => m.id),
    ...state.profile.watched.map((m) => m.id)
  ]);
  state.profile.seenIds = Array.from(new Set([...state.profile.seenIds, ...all]));
}

function renderStats() {
  el.flipCounter.textContent = String(state.profile.flips);
  el.likesCounter.textContent = String(state.profile.likes.length);
  el.watchedCounter.textContent = String(state.profile.watched.length);
  el.dislikesCounter.textContent = String(state.profile.dislikes.length);
}

function renderWatchedList() {
  el.watchedList.innerHTML = "";
  if (!state.profile.watched.length) {
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = "Mark movies as watched to rate them here.";
    el.watchedList.appendChild(p);
    return;
  }

  state.profile.watched.forEach((movie) => {
    const node = el.watchedTemplate.content.cloneNode(true);
    const title = node.querySelector(".watched-title");
    const group = node.querySelector(".rating-group");
    const selected = state.profile.ratings[movie.id] || 3;

    title.textContent = movie.title;

    for (let score = 1; score <= 5; score += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(score);
      if (score === selected) {
        btn.classList.add("active");
      }
      btn.addEventListener("click", () => {
        state.profile.ratings[movie.id] = score;
        saveProfile();
        renderWatchedList();
        maybeRefreshRecommendations(true);
      });
      group.appendChild(btn);
    }

    el.watchedList.appendChild(node);
  });
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
  const queries = pages.map((page) => {
    const genreParam = topGenreIds.length ? `&with_genres=${topGenreIds.join("|")}` : "";
    return api(
      "/discover/movie",
      `include_adult=false&include_video=false&language=en-US&page=${page}&sort_by=vote_count.desc${genreParam}`
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
    note.textContent = "No recommendations yet. Keep flipping.";
    el.recommendationsGrid.appendChild(note);
    return;
  }

  for (const movie of state.recs) {
    const node = el.recCardTemplate.content.cloneNode(true);
    const poster = node.querySelector(".rec-poster");
    const title = node.querySelector(".rec-title");
    const meta = node.querySelector(".rec-meta");

    poster.src = movie.poster_path ? `${TMDB_IMG}${movie.poster_path}` : "";
    poster.alt = `${movie.title} poster`;
    title.textContent = movie.title;
    meta.textContent = `${(movie.release_date || "").slice(0, 4) || "n/a"} · ${Number(movie.vote_average || 0).toFixed(1)}`;

    el.recommendationsGrid.appendChild(node);
  }
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

function isExcluded(movieId) {
  const p = state.profile;
  return p.seenIds.includes(movieId)
    || p.watched.some((m) => m.id === movieId)
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
