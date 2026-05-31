const menuButton = document.querySelector("[data-menu-button]");
const menuPanel = document.querySelector("[data-menu-panel]");

function setMenuOpen(isOpen) {
  if (!menuButton || !menuPanel) {
    return;
  }

  menuPanel.hidden = !isOpen;
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
}

if (menuButton && menuPanel) {
  menuButton.addEventListener("click", () => {
    setMenuOpen(menuPanel.hidden);
  });

  menuPanel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });

  document.addEventListener("click", (event) => {
    if (!menuPanel.hidden && !event.target.closest(".site-menu")) {
      setMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
    }
  });
}

const MAX_SCENE_VIDEOS = 24;

function getSceneNumber(basePath) {
  const match = basePath.match(/(?:^|\/)scene_(\d+)$/);
  return match ? Number(match[1]) : null;
}

function makeSceneVideoNames(basePath) {
  const sceneNumber = getSceneNumber(basePath);
  if (!sceneNumber) {
    return [];
  }

  const names = [];
  for (let index = 1; index <= MAX_SCENE_VIDEOS; index += 1) {
    names.push(`${basePath}/scene_${sceneNumber}_${index}.mp4`);
  }
  return names;
}

function videoExists(url) {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    let settled = false;
    const timeout = window.setTimeout(() => settle(false), 2200);

    function settle(exists) {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      probe.removeAttribute("src");
      probe.load();
      resolve(exists);
    }

    probe.preload = "metadata";
    probe.muted = true;
    probe.playsInline = true;
    probe.addEventListener("loadedmetadata", () => settle(true), { once: true });
    probe.addEventListener("error", () => settle(false), { once: true });
    probe.src = url;
    probe.load();
  });
}

async function findSceneVideos(basePath) {
  const candidates = makeSceneVideoNames(basePath);
  const availability = await Promise.all(candidates.map((url) => videoExists(url)));
  return candidates.filter((url, index) => availability[index]);
}

const videoButtons = Array.from(document.querySelectorAll("[data-video-step]"));
const sceneStates = [];
let globalVideoIndex = 0;
let maxVideos = 0;

function updateGlobalControls() {
  const hasMultipleVideos = maxVideos > 1;
  videoButtons.forEach((button) => {
    button.disabled = !hasMultipleVideos;
  });
}

function playVideo(video) {
  const playPromise = video.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function setSceneVideo(state, videoIndex) {
  if (!state.videos.length) {
    return;
  }

  const sceneIndex = ((videoIndex % state.videos.length) + state.videos.length) % state.videos.length;
  state.card.classList.remove("is-loaded");
  state.source.setAttribute("src", state.videos[sceneIndex]);
  state.video.load();
  playVideo(state.video);
}

function setGlobalVideo(nextIndex) {
  if (!maxVideos) {
    return;
  }

  globalVideoIndex = ((nextIndex % maxVideos) + maxVideos) % maxVideos;
  sceneStates.forEach((state) => setSceneVideo(state, globalVideoIndex));
  updateGlobalControls();
}

videoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const step = Number(button.getAttribute("data-video-step")) || 0;
    setGlobalVideo(globalVideoIndex + step);
  });
});

Promise.all(Array.from(document.querySelectorAll(".eval-card")).map(async (card) => {
  const video = card.querySelector("video");
  const source = card.querySelector("source");
  if (!video || !source) {
    return;
  }

  const basePath = source.getAttribute("src").replace(/\/[^/]+$/, "");
  const videos = await findSceneVideos(basePath);
  if (!videos.length) {
    return;
  }

  card.classList.add("has-video");
  video.addEventListener("loadeddata", () => card.classList.add("is-loaded"));
  video.addEventListener("canplay", () => card.classList.add("is-loaded"));

  sceneStates.push({ card, video, source, videos });
  maxVideos = Math.max(maxVideos, videos.length);
})).then(() => {
  setGlobalVideo(0);
  updateGlobalControls();
});
