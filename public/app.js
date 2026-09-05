const form = document.getElementById("film-form");
const compose = document.getElementById("compose");
const stage = document.getElementById("stage");
const progressEl = document.getElementById("progress");
const cinema = document.getElementById("cinema");
const screen = document.getElementById("screen");
const videoEl = document.getElementById("player-video");
const imageEl = document.getElementById("player-image");
const captionEl = document.getElementById("caption");
const filmTitle = document.getElementById("film-title");
const filmLogline = document.getElementById("film-logline");
const errorEl = document.getElementById("error");
const againBtn = document.getElementById("again");
const generateBtn = document.getElementById("generate");
const keyHint = document.getElementById("key-hint");
const sceneDots = document.getElementById("scene-dots");
const playBtn = document.getElementById("play");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");

/** @type {{ sceneId: string, kind: string, fileName: string, mimeType: string, caption: string, holdSeconds: number, error?: string }[]} */
let playlist = [];
let filmId = "";
let index = 0;
let playing = false;
/** @type {ReturnType<typeof setTimeout> | null} */
let holdTimer = null;

async function boot() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    keyHint.textContent = data.hasServerKey
      ? "Server key detected — paste only if you want to override."
      : "No server key — paste your OpenRouter API key to generate.";
  } catch {
    keyHint.textContent = "Could not reach API health check.";
  }
}

function addProgress(message, active = true) {
  for (const li of progressEl.querySelectorAll("li.active")) {
    li.classList.remove("active");
  }
  const li = document.createElement("li");
  li.textContent = message;
  if (active) li.classList.add("active");
  progressEl.appendChild(li);
  li.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function showError(message) {
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function resetPlayer() {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = null;
  playing = false;
  playBtn.textContent = "Play";
  videoEl.pause();
  videoEl.removeAttribute("src");
  videoEl.load();
  imageEl.removeAttribute("src");
  captionEl.textContent = "";
  sceneDots.innerHTML = "";
}

function buildDots() {
  sceneDots.innerHTML = "";
  playlist.forEach((item, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = `Scene ${i + 1}`;
    btn.addEventListener("click", () => {
      index = i;
      showScene(true);
    });
    sceneDots.appendChild(btn);
  });
}

function updateDots() {
  [...sceneDots.children].forEach((el, i) => {
    el.classList.toggle("on", i === index);
  });
}

function mediaUrl(item) {
  if (!item.fileName) return "";
  return `/api/films/${filmId}/media/${encodeURIComponent(item.fileName)}`;
}

function showScene(autoplay) {
  const item = playlist[index];
  if (!item) return;
  updateDots();
  captionEl.textContent = item.caption || "";
  if (holdTimer) clearTimeout(holdTimer);

  if (!item.fileName) {
    screen.classList.remove("show-video", "show-image");
    captionEl.textContent = `${item.caption}\n\n(Media failed: ${item.error || "unknown"})`;
    if (autoplay && playing) {
      holdTimer = setTimeout(() => advance(1), (item.holdSeconds || 4) * 1000);
    }
    return;
  }

  if (item.kind === "video") {
    screen.classList.add("show-video");
    screen.classList.remove("show-image");
    videoEl.src = mediaUrl(item);
    videoEl.onended = () => {
      if (playing) advance(1);
    };
    if (autoplay && playing) {
      videoEl.play().catch(() => {
        playing = false;
        playBtn.textContent = "Play";
      });
    }
  } else {
    screen.classList.add("show-image");
    screen.classList.remove("show-video");
    videoEl.pause();
    imageEl.src = mediaUrl(item);
    if (autoplay && playing) {
      holdTimer = setTimeout(() => advance(1), (item.holdSeconds || 5) * 1000);
    }
  }
}

function advance(delta) {
  if (!playlist.length) return;
  index = (index + delta + playlist.length) % playlist.length;
  showScene(true);
}

function startPlayback() {
  if (!playlist.length) return;
  cinema.hidden = false;
  buildDots();
  index = 0;
  playing = true;
  playBtn.textContent = "Pause";
  showScene(true);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  againBtn.hidden = true;
  cinema.hidden = true;
  progressEl.innerHTML = "";
  playlist = [];
  resetPlayer();

  const premise = document.getElementById("premise").value.trim();
  const styleNote = document.getElementById("style").value.trim();
  const sceneCount = Number(document.getElementById("sceneCount").value);
  const mediaMode = document.getElementById("mediaMode").value;
  const apiKey = document.getElementById("apiKey").value.trim();

  generateBtn.disabled = true;
  compose.hidden = true;
  stage.hidden = false;
  filmTitle.textContent = "Generating…";
  filmLogline.textContent = premise;
  addProgress("Starting Film Job…");

  try {
    const res = await fetch("/api/films", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        premise,
        styleNote: styleNote || undefined,
        sceneCount,
        mediaMode,
        apiKey: apiKey || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start film");
    filmId = data.id;

    const source = new EventSource(`/api/films/${filmId}/events`);
    source.onmessage = (msg) => {
      const event = JSON.parse(msg.data);
      if (event.type === "status") {
        addProgress(event.message);
      } else if (event.type === "screenplay") {
        filmTitle.textContent = event.screenplay.title;
        filmLogline.textContent = event.screenplay.logline;
        addProgress(`Screenplay locked: ${event.screenplay.scenes.length} scenes`);
      } else if (event.type === "scene") {
        addProgress(event.message);
      } else if (event.type === "media") {
        playlist.push(event.media);
        addProgress(
          event.media.error
            ? `Scene ${event.media.sceneId} fallback/error noted`
            : `Scene ${event.media.sceneId} media ready (${event.media.kind})`,
        );
      } else if (event.type === "done") {
        source.close();
        addProgress("Short film ready — rolling…", false);
        playlist = event.film.media || playlist;
        againBtn.hidden = false;
        generateBtn.disabled = false;
        startPlayback();
      } else if (event.type === "error") {
        source.close();
        showError(event.message);
        againBtn.hidden = false;
        generateBtn.disabled = false;
      }
    };
    source.onerror = () => {
      // EventSource retries; if film already terminal, server will re-send
    };
  } catch (err) {
    showError(err instanceof Error ? err.message : "Generation failed");
    againBtn.hidden = false;
    generateBtn.disabled = false;
  }
});

againBtn.addEventListener("click", () => {
  stage.hidden = true;
  compose.hidden = false;
  resetPlayer();
  progressEl.innerHTML = "";
  errorEl.hidden = true;
});

playBtn.addEventListener("click", () => {
  if (!playlist.length) return;
  playing = !playing;
  playBtn.textContent = playing ? "Pause" : "Play";
  const item = playlist[index];
  if (!item) return;
  if (playing) {
    if (item.kind === "video" && item.fileName) {
      videoEl.play().catch(() => {});
    } else {
      showScene(true);
    }
  } else {
    videoEl.pause();
    if (holdTimer) clearTimeout(holdTimer);
  }
});

prevBtn.addEventListener("click", () => advance(-1));
nextBtn.addEventListener("click", () => advance(1));

boot();
