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
  const membersBoard = document.getElementById("membersBoard");
  const membersStatus = document.getElementById("membersStatus");
  const refreshMembers = document.getElementById("refreshMembers");
  const CLUB_SLUG = "republic-of-noobistan";
  const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='80' fill='%230b2344'/%3E%3Ccircle cx='80' cy='59' r='28' fill='%2379bfee'/%3E%3Cpath d='M29 145c5-34 25-51 51-51s46 17 51 51' fill='%2379bfee'/%3E%3C/svg%3E";
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

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function joinedLabel(timestamp) {
    if (!timestamp) return "New member";
    const joined = new Date(timestamp * 1000);
    if (Number.isNaN(joined.getTime())) return "New member";
    return `Joined ${joined.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Chess.com API returned ${response.status}`);
    return response.json();
  }

  async function loadNewestMembers() {
    if (!membersBoard) return;
    refreshMembers.disabled = true;
    membersStatus.textContent = "Contacting Chess.com…";
    membersBoard.innerHTML = Array.from({ length: 6 }, () => '<div class="member-skeleton"></div>').join("");

    try {
      const clubData = await fetchJson(`https://api.chess.com/pub/club/${CLUB_SLUG}/members`);
      const combined = [
        ...(Array.isArray(clubData.weekly) ? clubData.weekly : []),
        ...(Array.isArray(clubData.monthly) ? clubData.monthly : []),
        ...(Array.isArray(clubData.all_time) ? clubData.all_time : [])
      ];

      const unique = new Map();
      combined.forEach((member) => {
        if (member?.username) unique.set(member.username.toLowerCase(), member);
      });

      const newest = [...unique.values()]
        .sort((a, b) => (b.joined || 0) - (a.joined || 0))
        .slice(0, 6);

      if (!newest.length) {
        membersBoard.innerHTML = '<div class="members-empty">No member records are currently available.</div>';
        membersStatus.textContent = "No members returned";
        return;
      }

      const profiles = await Promise.allSettled(
        newest.map((member) => fetchJson(`https://api.chess.com/pub/player/${encodeURIComponent(member.username)}`))
      );

      membersBoard.innerHTML = newest.map((member, index) => {
        const result = profiles[index];
        const profile = result.status === "fulfilled" ? result.value : {};
        const username = profile.username || member.username;
        const avatar = profile.avatar || DEFAULT_AVATAR;
        const title = profile.title ? `<span class="member-title">${escapeHtml(profile.title)}</span> · ` : "";
        const profileUrl = profile.url || `https://www.chess.com/member/${encodeURIComponent(username)}`;

        return `<a class="member-card" style="--member-delay:${index * 65}ms" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">
          <span class="member-avatar-wrap"><img class="member-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(username)} avatar" loading="lazy"></span>
          <span class="member-name">${escapeHtml(username)}</span>
          <span class="member-meta">${title}${escapeHtml(joinedLabel(member.joined))}</span>
        </a>`;
      }).join("");

      membersStatus.textContent = `Showing ${newest.length} newest members`;
    } catch (error) {
      console.error("Unable to load club members:", error);
      membersBoard.innerHTML = '<div class="members-error">The Chess.com member feed could not be loaded. Use Refresh to try again.</div>';
      membersStatus.textContent = "API temporarily unavailable";
    } finally {
      refreshMembers.disabled = false;
    }
  }

  refreshMembers?.addEventListener("click", loadNewestMembers);

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
  loadNewestMembers();
})();
