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

const REAL_WORLD_VIDEO_ROOT = "assets/videos/real_world_evals";
const MAX_PLAYING_EVAL_VIDEOS = 6;
const SUPPORTS_HOVER = window.matchMedia ? window.matchMedia("(hover: hover)").matches : true;

const videoButtons = Array.from(document.querySelectorAll("[data-video-step]"));
const sceneStates = [];
const playingStates = [];
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

function getLoopedIndex(index, length) {
  return ((index % length) + length) % length;
}

function getSceneVideos(sceneNumber) {
  const manifest = window.REAL_WORLD_EVAL_VIDEOS || {};
  const videoNames = manifest[String(sceneNumber)];

  if (!Array.isArray(videoNames)) {
    return [];
  }

  return videoNames.map((name) => {
    if (name.includes("/")) {
      return name;
    }

    return `${REAL_WORLD_VIDEO_ROOT}/scene_${sceneNumber}/${name}`;
  });
}

function getStateVideoUrl(state) {
  if (!state.videos.length) {
    return "";
  }

  const videoIndex = typeof state.videoIndex === "number" ? state.videoIndex : globalVideoIndex;
  return state.videos[getLoopedIndex(videoIndex, state.videos.length)];
}

function getPosterUrl(videoUrl) {
  const slashIndex = videoUrl.lastIndexOf("/");
  const directory = slashIndex >= 0 ? videoUrl.slice(0, slashIndex + 1) : "";
  const filename = slashIndex >= 0 ? videoUrl.slice(slashIndex + 1) : videoUrl;
  return `${directory}posters/${filename.replace(/\.mp4$/i, ".webp")}`;
}

function getStatePosterUrl(state) {
  const videoUrl = getStateVideoUrl(state);
  return videoUrl ? getPosterUrl(videoUrl) : "";
}

function setPoster(state) {
  const posterUrl = getStatePosterUrl(state);
  if (posterUrl) {
    state.video.poster = posterUrl;
  } else {
    state.video.removeAttribute("poster");
  }
}

function setStateVideoIndex(state, nextIndex) {
  state.videoIndex = getLoopedIndex(nextIndex, state.videos.length);
}

function removePlayingState(state) {
  const index = playingStates.indexOf(state);
  if (index >= 0) {
    playingStates.splice(index, 1);
  }
}

function unloadVideo(state) {
  state.video.pause();
  state.video.removeAttribute("src");
  state.video.load();
  state.currentUrl = "";
  state.isPlaying = false;
  state.card.classList.remove("is-playing", "is-loaded", "is-switching");
  setPoster(state);
}

function stopStateVideo(state) {
  removePlayingState(state);
  unloadVideo(state);
}

function prepareVideoSwitch(state) {
  state.video.pause();
  state.video.removeAttribute("src");
  state.video.removeAttribute("poster");
  state.video.load();
  state.currentUrl = "";
  state.isPlaying = false;
  state.card.classList.remove("is-playing", "is-loaded");
  state.card.classList.add("is-switching");
}

function finishVideoLoad(state) {
  state.card.classList.add("is-loaded");
  state.card.classList.remove("is-switching");
}

function failVideoLoad(state) {
  removePlayingState(state);
  state.currentUrl = "";
  state.isPlaying = false;
  state.card.classList.remove("is-loaded", "is-switching");
  setPoster(state);
}

function isCardInViewport(card) {
  const rect = card.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  return rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
}

function playSelectedVideo(state) {
  if (!isCardInViewport(state.card)) {
    stopStateVideo(state);
    return;
  }

  const nextUrl = getStateVideoUrl(state);
  if (!nextUrl) {
    return;
  }

  removePlayingState(state);
  playingStates.unshift(state);
  while (playingStates.length > MAX_PLAYING_EVAL_VIDEOS) {
    unloadVideo(playingStates.pop());
  }

  if (state.currentUrl !== nextUrl) {
    state.card.classList.remove("is-loaded");
    state.video.src = nextUrl;
    state.currentUrl = nextUrl;
    state.video.load();
  }

  state.isPlaying = true;
  state.card.classList.add("is-playing");
  playVideo(state.video);
}

function changeSceneObject(state) {
  if (state.videos.length < 2) {
    return;
  }

  setStateVideoIndex(state, state.videoIndex + 1);

  if (state.isPlaying || isCardInViewport(state.card)) {
    prepareVideoSwitch(state);
    playSelectedVideo(state);
  } else {
    setPoster(state);
  }
}

function setGlobalVideo(nextIndex) {
  if (!maxVideos) {
    return;
  }

  globalVideoIndex = getLoopedIndex(nextIndex, maxVideos);
  sceneStates.forEach((state) => {
    setStateVideoIndex(state, globalVideoIndex);
    if (state.isPlaying) {
      prepareVideoSwitch(state);
      playSelectedVideo(state);
    } else {
      setPoster(state);
    }
  });
  updateGlobalControls();
}

videoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const step = Number(button.getAttribute("data-video-step")) || 0;
    setGlobalVideo(globalVideoIndex + step);
  });
});

const visibilityObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting && entry.target._evalState) {
        stopStateVideo(entry.target._evalState);
      }
    });
  }, { threshold: 0 })
  : null;

function addChangeObjectButton(state) {
  if (state.videos.length < 2) {
    return;
  }

  const media = state.card.querySelector(".eval-media");
  if (!media) {
    return;
  }

  const caption = state.card.querySelector(".eval-caption")?.textContent?.trim() || "this scene";
  const button = document.createElement("button");
  button.className = "eval-change-button";
  button.type = "button";
  button.textContent = "Change object";
  button.setAttribute("aria-label", `Change object for ${caption}`);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    changeSceneObject(state);
  });

  state.card.classList.add("has-multiple-videos");
  media.append(button);
}

Array.from(document.querySelectorAll(".eval-card")).forEach((card) => {
  const video = card.querySelector("video");
  if (!video) {
    return;
  }

  const sceneNumber = Number(video.getAttribute("data-scene"));
  const videos = getSceneVideos(sceneNumber);
  if (!videos.length) {
    return;
  }

  card.classList.add("has-video");
  card.tabIndex = 0;

  const state = { card, video, videos, currentUrl: "", isPlaying: false, videoIndex: 0 };
  setPoster(state);
  card._evalState = state;
  addChangeObjectButton(state);
  video.addEventListener("loadeddata", () => finishVideoLoad(state));
  video.addEventListener("canplay", () => finishVideoLoad(state));
  video.addEventListener("error", () => failVideoLoad(state));

  card.addEventListener("pointerenter", () => {
    if (SUPPORTS_HOVER) {
      playSelectedVideo(state);
    }
  });
  card.addEventListener("focusin", () => {
    if (SUPPORTS_HOVER) {
      playSelectedVideo(state);
    }
  });
  card.addEventListener("click", () => {
    if (SUPPORTS_HOVER) {
      return;
    }

    if (state.isPlaying) {
      stopStateVideo(state);
    } else {
      playSelectedVideo(state);
    }
  });

  sceneStates.push(state);
  maxVideos = Math.max(maxVideos, videos.length);
  if (visibilityObserver) {
    visibilityObserver.observe(card);
  }
});

updateGlobalControls();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    sceneStates.forEach(stopStateVideo);
  }
});
window.addEventListener("pagehide", () => sceneStates.forEach(stopStateVideo));
