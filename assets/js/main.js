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

const MAX_NUMBERED_ROLLOUTS = 8;

function makeRolloutNames() {
  const names = ["rollout.mp4"];
  for (let index = 1; index <= MAX_NUMBERED_ROLLOUTS; index += 1) {
    names.push(`rollout_${index}.mp4`);
  }
  return names;
}

async function readRolloutManifest(basePath) {
  if (window.location.protocol === "file:") {
    return [];
  }

  try {
    const response = await fetch(`${basePath}/rollouts.json`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const videos = Array.isArray(data) ? data : data.videos;
    if (!Array.isArray(videos)) {
      return [];
    }

    return videos
      .filter((name) => typeof name === "string" && name && !name.includes("/") && !name.includes("\\"))
      .map((name) => `${basePath}/${name}`);
  } catch (error) {
    return [];
  }
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

async function findRollouts(basePath) {
  const manifestRollouts = await readRolloutManifest(basePath);
  if (manifestRollouts.length) {
    return manifestRollouts;
  }

  const candidates = makeRolloutNames().map((name) => `${basePath}/${name}`);
  const availability = await Promise.all(candidates.map((url) => videoExists(url)));
  return candidates.filter((url, index) => availability[index]);
}

const rolloutButtons = Array.from(document.querySelectorAll("[data-rollout-step]"));
const sceneStates = [];
let globalRolloutIndex = 0;
let maxRollouts = 0;

function updateGlobalControls() {
  const hasMultipleRollouts = maxRollouts > 1;
  rolloutButtons.forEach((button) => {
    button.disabled = !hasMultipleRollouts;
  });

}

function playVideo(video) {
  const playPromise = video.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function setSceneRollout(state, rolloutIndex) {
  if (!state.rollouts.length) {
    return;
  }

  const sceneIndex = ((rolloutIndex % state.rollouts.length) + state.rollouts.length) % state.rollouts.length;
  state.card.classList.remove("is-loaded");
  state.source.setAttribute("src", state.rollouts[sceneIndex]);
  state.video.load();
  playVideo(state.video);
}

function setGlobalRollout(nextIndex) {
  if (!maxRollouts) {
    return;
  }

  globalRolloutIndex = ((nextIndex % maxRollouts) + maxRollouts) % maxRollouts;
  sceneStates.forEach((state) => setSceneRollout(state, globalRolloutIndex));
  updateGlobalControls();
}

rolloutButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const step = Number(button.getAttribute("data-rollout-step")) || 0;
    setGlobalRollout(globalRolloutIndex + step);
  });
});

Promise.all(Array.from(document.querySelectorAll(".eval-card")).map(async (card) => {
  const video = card.querySelector("video");
  const source = card.querySelector("source");
  if (!video || !source) {
    return;
  }

  const basePath = source.getAttribute("src").replace(/\/[^/]+$/, "");
  const rollouts = await findRollouts(basePath);
  if (!rollouts.length) {
    return;
  }

  card.classList.add("has-video");
  video.addEventListener("loadeddata", () => card.classList.add("is-loaded"));
  video.addEventListener("canplay", () => card.classList.add("is-loaded"));

  sceneStates.push({ card, video, source, rollouts });
  maxRollouts = Math.max(maxRollouts, rollouts.length);
})).then(() => {
  setGlobalRollout(0);
  updateGlobalControls();
});
