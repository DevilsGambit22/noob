(() => {
  "use strict";

  const CLUB_SLUG = "republic-of-noobistan";
  const MEMBER_LIMIT = 6;
  const PROFILE_DELAY = 200;

  const tabs = Array.from(document.querySelectorAll(".tab"));
  const pages = Array.from(document.querySelectorAll(".page"));

  const membersBoard = document.getElementById("membersBoard");
  const membersStatus = document.getElementById("membersStatus");
  const refreshMembers = document.getElementById("refreshMembers");

  const audioPlayer = document.getElementById("audioPlayer");
  const visualizer = document.getElementById("visualizer");
  const stars = document.getElementById("stars");
  const confetti = document.getElementById("confetti");
  const celebrateButton = document.getElementById("celebrateButton");
  const copyrightLogo = document.getElementById("copyrightLogo");

  const DEFAULT_AVATAR =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='80' fill='%230b2344'/%3E%3Ccircle cx='80' cy='58' r='28' fill='%2379bfee'/%3E%3Cpath d='M29 145c5-34 25-51 51-51s46 17 51 51' fill='%2379bfee'/%3E%3C/svg%3E";

  let memberBoardLoading = false;
  let callbackCounter = 0;
  let logoClicks = 0;
  let logoTimer = null;

  /* =====================================================
     PAGE BUTTONS
  ===================================================== */

  function activatePage(pageId) {
    tabs.forEach((tab) => {
      const active = tab.dataset.page === pageId;

      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    pages.forEach((page) => {
      const active = page.id === pageId;

      page.classList.toggle("active", active);
      page.setAttribute("aria-hidden", String(!active));
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activatePage(tab.dataset.page);
    });
  });

  /* =====================================================
     UTILITIES
  ===================================================== */

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return entities[character];
    });
  }

  function formatJoinedDate(timestamp) {
    const value = Number(timestamp);

    if (!Number.isFinite(value) || value <= 0) {
      return "New member";
    }

    const date = new Date(value * 1000);

    if (Number.isNaN(date.getTime())) {
      return "New member";
    }

    return `Joined ${date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })}`;
  }

  /* =====================================================
     CHESS.COM JSONP

     Chess.com supports:
     ?callback=functionName
  ===================================================== */

  function chessJsonp(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
      callbackCounter += 1;

      const callbackName =
        `chessComCallback_${Date.now()}_${callbackCounter}`;

      const script = document.createElement("script");

      const separator = url.includes("?") ? "&" : "?";

      let finished = false;

      function cleanup() {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }

        try {
          delete window[callbackName];
        } catch (error) {
          window[callbackName] = undefined;
        }
      }

      const timer = window.setTimeout(() => {
        if (finished) {
          return;
        }

        finished = true;
        cleanup();

        reject(new Error(`Chess.com JSONP request timed out: ${url}`));
      }, timeout);

      window[callbackName] = (data) => {
        if (finished) {
          return;
        }

        finished = true;
        window.clearTimeout(timer);
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        if (finished) {
          return;
        }

        finished = true;
        window.clearTimeout(timer);
        cleanup();

        reject(new Error(`Chess.com JSONP request failed: ${url}`));
      };

      script.src =
        `${url}${separator}callback=${encodeURIComponent(callbackName)}`;

      script.async = true;

      document.head.appendChild(script);
    });
  }

  /* =====================================================
     NEWEST MEMBERS
  ===================================================== */

  function renderSkeletons() {
    if (!membersBoard) {
      return;
    }

    membersBoard.innerHTML = Array.from(
      { length: MEMBER_LIMIT },
      () => '<div class="member-skeleton"></div>'
    ).join("");
  }

  function createMemberCard(member, index) {
    const safeUsername = escapeHtml(member.username);

    const profileUrl =
      `https://www.chess.com/member/${encodeURIComponent(member.username)}`;

    return `
      <a
        class="member-card"
        data-member-index="${index}"
        href="${profileUrl}"
        target="_blank"
        rel="noopener noreferrer"
        style="--member-delay:${index * 70}ms"
      >
        <span class="member-avatar-wrap">
          <img
            class="member-avatar"
            src="${DEFAULT_AVATAR}"
            alt="${safeUsername} avatar"
            loading="lazy"
          >
        </span>

        <span class="member-name">
          ${safeUsername}
        </span>

        <span class="member-meta">
          ${escapeHtml(formatJoinedDate(member.joined))}
        </span>
      </a>
    `;
  }

  function normalizeMembers(allTimeMembers) {
    const uniqueMembers = new Map();

    allTimeMembers.forEach((entry, index) => {
      let username = "";
      let joined = 0;

      if (
        entry &&
        typeof entry === "object" &&
        typeof entry.username === "string"
      ) {
        username = entry.username.trim();
        joined = Number(entry.joined) || 0;
      } else if (typeof entry === "string") {
        username = entry.trim();
      }

      if (!username) {
        return;
      }

      uniqueMembers.set(username.toLowerCase(), {
        username,
        joined,
        sourceIndex: index
      });
    });

    return Array.from(uniqueMembers.values());
  }

  function sortNewestMembers(members) {
    return members
      .sort((first, second) => {
        if (first.joined !== second.joined) {
          return second.joined - first.joined;
        }

        return second.sourceIndex - first.sourceIndex;
      })
      .slice(0, MEMBER_LIMIT);
  }

  async function loadProfile(member, index) {
    const card = membersBoard?.querySelector(
      `[data-member-index="${index}"]`
    );

    if (!card) {
      return;
    }

    try {
      const profile = await chessJsonp(
        `https://api.chess.com/pub/player/${encodeURIComponent(
          member.username.toLowerCase()
        )}`
      );

      const avatarElement = card.querySelector(".member-avatar");
      const nameElement = card.querySelector(".member-name");
      const metaElement = card.querySelector(".member-meta");

      const displayedUsername =
        profile?.username || member.username;

      if (profile?.url) {
        card.href = profile.url;
      }

      if (avatarElement) {
        avatarElement.alt = `${displayedUsername} avatar`;

        if (profile?.avatar) {
          avatarElement.src = profile.avatar;
        }

        avatarElement.onerror = () => {
          avatarElement.onerror = null;
          avatarElement.src = DEFAULT_AVATAR;
        };
      }

      if (nameElement) {
        nameElement.textContent = displayedUsername;
      }

      if (metaElement) {
        const joinedText = formatJoinedDate(member.joined);

        metaElement.textContent = profile?.title
          ? `${profile.title} · ${joinedText}`
          : joinedText;
      }
    } catch (error) {
      console.warn(
        `Could not load profile details for ${member.username}:`,
        error
      );
    }
  }

  async function loadNewestMembers() {
    if (!membersBoard || memberBoardLoading) {
      return;
    }

    memberBoardLoading = true;

    if (refreshMembers) {
      refreshMembers.disabled = true;
    }

    if (membersStatus) {
      membersStatus.textContent = "Loading newest members…";
    }

    renderSkeletons();

    try {
      const clubData = await chessJsonp(
        `https://api.chess.com/pub/club/${CLUB_SLUG}/members`
      );

      const allTimeMembers = Array.isArray(clubData?.all_time)
        ? clubData.all_time
        : [];

      const newestMembers = sortNewestMembers(
        normalizeMembers(allTimeMembers)
      );

      if (!newestMembers.length) {
        throw new Error("No members were returned by Chess.com.");
      }

      membersBoard.innerHTML = newestMembers
        .map(createMemberCard)
        .join("");

      if (membersStatus) {
        membersStatus.textContent =
          `Showing ${newestMembers.length} newest members`;
      }

      /*
       * Load profile information serially.
       * A failed avatar request will not remove the member card.
       */
      for (let index = 0; index < newestMembers.length; index += 1) {
        await loadProfile(newestMembers[index], index);
        await wait(PROFILE_DELAY);
      }
    } catch (error) {
      console.error("Newest member board failed:", error);

      membersBoard.innerHTML = `
        <div class="members-error">
          Unable to load the newest members right now.
          Press Refresh to try again.
        </div>
      `;

      if (membersStatus) {
        membersStatus.textContent = "Member board unavailable";
      }
    } finally {
      memberBoardLoading = false;

      if (refreshMembers) {
        refreshMembers.disabled = false;
      }
    }
  }

  if (refreshMembers) {
    refreshMembers.addEventListener("click", loadNewestMembers);
  }

  /* =====================================================
     BACKGROUND STARS
  ===================================================== */

  function createStars(count = 72) {
    if (!stars) {
      return;
    }

    stars.innerHTML = "";

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < count; index += 1) {
      const star = document.createElement("span");

      star.className = "star";
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;

      star.style.setProperty(
        "--duration",
        `${2.4 + Math.random() * 4}s`
      );

      star.style.setProperty(
        "--delay",
        `${Math.random() * -6}s`
      );

      fragment.appendChild(star);
    }

    stars.appendChild(fragment);
  }

  /* =====================================================
     RADIO VISUALIZER
  ===================================================== */

  function synchronizeVisualizer() {
    if (!audioPlayer || !visualizer) {
      return;
    }

    visualizer.classList.toggle(
      "playing",
      !audioPlayer.paused
    );
  }

  if (audioPlayer) {
    audioPlayer.addEventListener("play", synchronizeVisualizer);
    audioPlayer.addEventListener("pause", synchronizeVisualizer);
    audioPlayer.addEventListener("ended", synchronizeVisualizer);
  }

  /* =====================================================
     CELEBRATION
  ===================================================== */

  function celebrate() {
    if (!confetti) {
      return;
    }

    confetti.innerHTML = "";

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < 72; index += 1) {
      const piece = document.createElement("span");

      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;

      piece.style.setProperty(
        "--hue",
        String(185 + Math.random() * 65)
      );

      piece.style.setProperty(
        "--fall-duration",
        `${2.2 + Math.random() * 2.5}s`
      );

      piece.style.setProperty(
        "--drift",
        `${-100 + Math.random() * 200}px`
      );

      piece.style.animationDelay = `${Math.random() * 0.5}s`;

      fragment.appendChild(piece);
    }

    confetti.appendChild(fragment);

    window.setTimeout(() => {
      confetti.innerHTML = "";
    }, 5500);
  }

  if (celebrateButton) {
    celebrateButton.addEventListener("click", celebrate);
  }

  /* =====================================================
     PANEL LIGHTING
  ===================================================== */

  document.querySelectorAll(".panel").forEach((panel) => {
    panel.addEventListener("pointermove", (event) => {
      const rectangle = panel.getBoundingClientRect();

      const mouseX =
        ((event.clientX - rectangle.left) / rectangle.width) * 100;

      const mouseY =
        ((event.clientY - rectangle.top) / rectangle.height) * 100;

      panel.style.setProperty("--mx", `${mouseX}%`);
      panel.style.setProperty("--my", `${mouseY}%`);
    });

    panel.addEventListener("pointerleave", () => {
      panel.style.removeProperty("--mx");
      panel.style.removeProperty("--my");
    });
  });

  /* =====================================================
     HIDDEN LOGO INTERACTION
  ===================================================== */

  if (copyrightLogo) {
    copyrightLogo.addEventListener("click", (event) => {
      logoClicks += 1;

      window.clearTimeout(logoTimer);

      logoTimer = window.setTimeout(() => {
        logoClicks = 0;
      }, 1800);

      if (logoClicks >= 7) {
        event.preventDefault();

        logoClicks = 0;

        document.body.classList.toggle("secret-awake");
        celebrate();
      }
    });
  }

  /* =====================================================
     START
  ===================================================== */

  function initializeDashboard() {
    createStars();
    synchronizeVisualizer();
    loadNewestMembers();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeDashboard,
      { once: true }
    );
  } else {
    initializeDashboard();
  }
})();
