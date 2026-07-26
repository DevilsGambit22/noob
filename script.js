(() => {
  "use strict";

  const tabs = [...document.querySelectorAll(".tab")];
  const pages = [...document.querySelectorAll(".page")];
  const audio = document.getElementById("audioPlayer");
  const visualizer = document.getElementById("visualizer");
  const stars = document.getElementById("stars");
  const celebrateButton = document.getElementById("celebrateButton");
  const confetti = document.getElementById("confetti");
  const copyrightLogo = document.getElementById("copyrightLogo");
  let logoClicks = 0;
  let logoTimer;

  function activatePage(pageId) {
    tabs.forEach((tab) => {
      const active = tab.dataset.page === pageId;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    pages.forEach((page) => {
      page.classList.toggle("active", page.id === pageId);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activatePage(tab.dataset.page));
  });

  function createStars(count = 48) {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i += 1) {
      const star = document.createElement("span");
      star.className = "star";
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.setProperty("--duration", `${2.4 + Math.random() * 4}s`);
      star.style.setProperty("--delay", `${Math.random() * -5}s`);
      fragment.appendChild(star);
    }

    stars.appendChild(fragment);
  }

  function syncVisualizer() {
    visualizer.classList.toggle("playing", !audio.paused);
  }

  audio.addEventListener("play", syncVisualizer);
  audio.addEventListener("pause", syncVisualizer);
  audio.addEventListener("ended", syncVisualizer);

  function celebrate() {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < 72; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.setProperty("--hue", String(190 + Math.random() * 55));
      piece.style.setProperty("--fall-duration", `${2.2 + Math.random() * 2.2}s`);
      piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
      piece.style.animationDelay = `${Math.random() * .5}s`;
      fragment.appendChild(piece);
    }

    confetti.appendChild(fragment);
    window.setTimeout(() => {
      confetti.innerHTML = "";
    }, 5200);
  }

  celebrateButton.addEventListener("click", celebrate);

  document.querySelectorAll(".panel").forEach((panel) => {
    panel.addEventListener("pointermove", (event) => {
      const rect = panel.getBoundingClientRect();
      panel.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
      panel.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
    });
  });

  copyrightLogo.addEventListener("click", (event) => {
    logoClicks += 1;
    clearTimeout(logoTimer);
    logoTimer = window.setTimeout(() => { logoClicks = 0; }, 1800);

    if (logoClicks >= 7) {
      event.preventDefault();
      logoClicks = 0;
      document.body.classList.toggle("secret-awake");
      celebrate();
    }
  });

  createStars(72);
})();
