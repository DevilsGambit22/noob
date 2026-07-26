(() => {
  "use strict";

  const CLUB_SLUG = "republic-of-noobistan";
  const MEMBER_LIMIT = 6;
  const REQUEST_DELAY = 200;

  const tabs = Array.from(document.querySelectorAll(".tab"));
  const pages = Array.from(document.querySelectorAll(".page"));

  const membersBoard = document.getElementById("membersBoard");
  const membersStatus = document.getElementById("membersStatus");
  const refreshMembers = document.getElementById("refreshMembers");

  const audioPlayer = document.getElementById("audioPlayer");
  const visualizer = document.getElementById("visualizer");
  const radioTitle = document.getElementById("radio-title");
  const radioArtist = document.getElementById("radioArtist");
  const previousTrack = document.getElementById("previousTrack");
  const nextTrack = document.getElementById("nextTrack");
  const trackCounter = document.getElementById("trackCounter");
  const playlist = document.getElementById("playlist");
  const stars = document.getElementById("stars");
  const confetti = document.getElementById("confetti");
  const celebrateButton = document.getElementById("celebrateButton");
  const copyrightLogo = document.getElementById("copyrightLogo");

  const DEFAULT_AVATAR =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='80' fill='%230b2344'/%3E%3Ccircle cx='80' cy='58' r='28' fill='%2379bfee'/%3E%3Cpath d='M29 145c5-34 25-51 51-51s46 17 51 51' fill='%2379bfee'/%3E%3C/svg%3E";

  let memberBoardLoading = false;
  let jsonpCounter = 0;
  let logoClickCount = 0;
  let logoClickTimer = null;
  let currentTrackIndex = 0;

  const RADIO_TRACKS = [
    {
      url: "https://od.lk/s/MzBfNDEwMTQxNzZf/Audio.mp3",
      title: "Apocalypse"
    },
    {
      file: "cry.mp3",
      title: "Cry"
    },
    {
      file: "nothing.mp3",
      title: "Nothing’s Gonna Hurt You Baby"
    }
  ];

  /* =====================================================
     PAGE NAVIGATION
  ===================================================== */

  function activatePage(pageId) {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.page === pageId;

      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    pages.forEach((page) => {
      const isActive = page.id === pageId;

      page.classList.toggle("active", isActive);
      page.setAttribute("aria-hidden", String(!isActive));
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function initializeTabs() {
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activatePage(tab.dataset.page);
      });
    });
  }

  /* =====================================================
     GENERAL UTILITIES
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

  /* =====================================================
     CHESS.COM JSONP REQUEST
  ===================================================== */

  function chessJsonp(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
      jsonpCounter += 1;

      const callbackName =
        `chessCallback_${Date.now()}_${jsonpCounter}`;

      const script = document.createElement("script");
      const separator = url.includes("?") ? "&" : "?";

      let completed = false;

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
        if (completed) {
          return;
        }

        completed = true;
        cleanup();

        reject(
          new Error(`Chess.com request timed out: ${url}`)
        );
      }, timeout);

      window[callbackName] = (data) => {
        if (completed) {
          return;
        }

        completed = true;

        window.clearTimeout(timer);
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        if (completed) {
          return;
        }

        completed = true;

        window.clearTimeout(timer);
        cleanup();

        reject(
          new Error(`Chess.com request failed: ${url}`)
        );
      };

      script.src =
        `${url}${separator}callback=${encodeURIComponent(callbackName)}`;

      script.async = true;

      document.head.appendChild(script);
    });
  }

  /* =====================================================
     MEMBER DATA
  ===================================================== */

  function normalizeMembers(rawMembers) {
    const uniqueMembers = new Map();

    rawMembers.forEach((entry, index) => {
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

  function getNewestMembers(rawMembers) {
    return normalizeMembers(rawMembers)
      .sort((firstMember, secondMember) => {
        if (firstMember.joined !== secondMember.joined) {
          return secondMember.joined - firstMember.joined;
        }

        return secondMember.sourceIndex - firstMember.sourceIndex;
      })
      .slice(0, MEMBER_LIMIT);
  }

  function selectRating(stats) {
    const ratings = [
      {
        label: "Rapid",
        value: stats?.chess_rapid?.last?.rating
      },
      {
        label: "Blitz",
        value: stats?.chess_blitz?.last?.rating
      },
      {
        label: "Bullet",
        value: stats?.chess_bullet?.last?.rating
      },
      {
        label: "Daily",
        value: stats?.chess_daily?.last?.rating
      },
      {
        label: "Chess960",
        value: stats?.chess960_daily?.last?.rating
      }
    ];

    return ratings.find((rating) => {
      const numericRating = Number(rating.value);

      return (
        Number.isFinite(numericRating) &&
        numericRating > 0
      );
    }) || null;
  }

  /* =====================================================
     MEMBER BOARD RENDERING
  ===================================================== */

  function renderMemberSkeletons() {
    if (!membersBoard) {
      return;
    }

    membersBoard.innerHTML = Array.from(
      { length: MEMBER_LIMIT },
      () => `
        <div class="member-skeleton">
          <span class="member-skeleton-avatar"></span>

          <span class="member-skeleton-lines">
            <span></span>
            <span></span>
          </span>
        </div>
      `
    ).join("");
  }

  function createMemberCard(member, index) {
    const safeUsername = escapeHtml(member.username);

    const profileUrl =
      `https://www.chess.com/member/${encodeURIComponent(
        member.username
      )}`;

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
            alt="${safeUsername} profile picture"
            loading="lazy"
          >
        </span>

        <span class="member-info">
          <span class="member-name">
            ${safeUsername}
          </span>

          <span class="member-rating-row">
            <strong class="member-rating">
              Loading…
            </strong>

            <small class="member-rating-type">
              Rating
            </small>
          </span>
        </span>
      </a>
    `;
  }

  function renderMemberError() {
    if (membersBoard) {
      membersBoard.innerHTML = `
        <div class="members-error">
          Unable to load the newest members right now.
          Press Refresh to try again.
        </div>
      `;
    }

    if (membersStatus) {
      membersStatus.textContent =
        "Member board unavailable";
    }
  }

  /* =====================================================
     LOAD PROFILE AND RATING
  ===================================================== */

  async function loadMemberDetails(member, index) {
    const card = membersBoard?.querySelector(
      `[data-member-index="${index}"]`
    );

    if (!card) {
      return;
    }

    const username = member.username.toLowerCase();

    const avatarElement =
      card.querySelector(".member-avatar");

    const nameElement =
      card.querySelector(".member-name");

    const ratingElement =
      card.querySelector(".member-rating");

    const ratingTypeElement =
      card.querySelector(".member-rating-type");

    try {
      const profile = await chessJsonp(
        `https://api.chess.com/pub/player/${encodeURIComponent(
          username
        )}`
      );

      const displayedUsername =
        profile?.username || member.username;

      if (profile?.url) {
        card.href = profile.url;
      }

      if (nameElement) {
        nameElement.textContent = displayedUsername;
      }

      if (avatarElement) {
        avatarElement.alt =
          `${displayedUsername} profile picture`;

        avatarElement.src =
          profile?.avatar || DEFAULT_AVATAR;

        avatarElement.onerror = () => {
          avatarElement.onerror = null;
          avatarElement.src = DEFAULT_AVATAR;
        };
      }
    } catch (error) {
      console.warn(
        `Profile request failed for ${member.username}:`,
        error
      );
    }

    await wait(REQUEST_DELAY);

    try {
      const stats = await chessJsonp(
        `https://api.chess.com/pub/player/${encodeURIComponent(
          username
        )}/stats`
      );

      const selectedRating = selectRating(stats);

      if (ratingElement) {
        ratingElement.textContent = selectedRating
          ? Number(selectedRating.value).toLocaleString("en-US")
          : "Unrated";
      }

      if (ratingTypeElement) {
        ratingTypeElement.textContent = selectedRating
          ? selectedRating.label
          : "No rating";
      }
    } catch (error) {
      console.warn(
        `Stats request failed for ${member.username}:`,
        error
      );

      if (ratingElement) {
        ratingElement.textContent = "Unrated";
      }

      if (ratingTypeElement) {
        ratingTypeElement.textContent =
          "Rating unavailable";
      }
    }
  }

  /* =====================================================
     LOAD NEWEST MEMBERS
  ===================================================== */

  async function loadNewestMembers() {
    if (!membersBoard || memberBoardLoading) {
      return;
    }

    memberBoardLoading = true;

    if (refreshMembers) {
      refreshMembers.disabled = true;
      refreshMembers.setAttribute("aria-busy", "true");
    }

    if (membersStatus) {
      membersStatus.textContent =
        "Loading newest members…";
    }

    renderMemberSkeletons();

    try {
      const clubData = await chessJsonp(
        `https://api.chess.com/pub/club/${CLUB_SLUG}/members`
      );

      const allTimeMembers =
        Array.isArray(clubData?.all_time)
          ? clubData.all_time
          : [];

      const newestMembers =
        getNewestMembers(allTimeMembers);

      if (!newestMembers.length) {
        throw new Error(
          "No members were returned by Chess.com."
        );
      }

      membersBoard.innerHTML =
        newestMembers
          .map(createMemberCard)
          .join("");

      if (membersStatus) {
        membersStatus.textContent =
          `Showing ${newestMembers.length} newest members`;
      }

      for (
        let index = 0;
        index < newestMembers.length;
        index += 1
      ) {
        await loadMemberDetails(
          newestMembers[index],
          index
        );

        await wait(REQUEST_DELAY);
      }
    } catch (error) {
      console.error(
        "Newest member board failed:",
        error
      );

      renderMemberError();
    } finally {
      memberBoardLoading = false;

      if (refreshMembers) {
        refreshMembers.disabled = false;
        refreshMembers.removeAttribute("aria-busy");
      }
    }
  }

  function initializeMemberBoard() {
    if (refreshMembers) {
      refreshMembers.addEventListener(
        "click",
        loadNewestMembers
      );
    }

    loadNewestMembers();
  }

  /* =====================================================
     BACKGROUND STARS
  ===================================================== */

  function createStars(count = 72) {
    if (!stars) {
      return;
    }

    stars.innerHTML = "";

    const fragment =
      document.createDocumentFragment();

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      const star =
        document.createElement("span");

      star.className = "star";

      star.style.left =
        `${Math.random() * 100}%`;

      star.style.top =
        `${Math.random() * 100}%`;

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
     RADIO PLAYLIST AND VISUALIZER
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

  function renderPlaylist() {
    if (!playlist) {
      return;
    }

    playlist.innerHTML = RADIO_TRACKS.map((track, index) => `
      <button
        class="playlist-track${index === currentTrackIndex ? " active" : ""}"
        type="button"
        data-track-index="${index}"
      >
        <span class="playlist-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="playlist-title">${escapeHtml(track.title)}</span>
        <span class="playlist-status">${index === currentTrackIndex ? "Now Playing" : "Play"}</span>
      </button>
    `).join("");

    playlist.querySelectorAll(".playlist-track").forEach((button) => {
      button.addEventListener("click", () => {
        loadTrack(Number(button.dataset.trackIndex), true);
      });
    });
  }

  function loadTrack(index, autoplay = false) {
    if (!audioPlayer || !RADIO_TRACKS.length) {
      return;
    }

    currentTrackIndex =
      (index + RADIO_TRACKS.length) % RADIO_TRACKS.length;

    const track = RADIO_TRACKS[currentTrackIndex];
    audioPlayer.src = track.url || `assets/music/${encodeURIComponent(track.file)}`;
    audioPlayer.load();

    if (radioTitle) {
      radioTitle.textContent = track.title;
    }

    if (radioArtist) {
      radioArtist.textContent = "Noobistan Radio Playlist";
    }

    if (trackCounter) {
      trackCounter.textContent =
        `Track ${currentTrackIndex + 1} of ${RADIO_TRACKS.length}`;
    }

    renderPlaylist();

    if (autoplay) {
      audioPlayer.play().catch(() => {
        synchronizeVisualizer();
      });
    }
  }

  function playNextTrack() {
    loadTrack(currentTrackIndex + 1, true);
  }

  function playPreviousTrack() {
    loadTrack(currentTrackIndex - 1, true);
  }

  function initializeAudio() {
    if (!audioPlayer || !RADIO_TRACKS.length) {
      return;
    }

    audioPlayer.addEventListener("play", synchronizeVisualizer);
    audioPlayer.addEventListener("pause", synchronizeVisualizer);
    audioPlayer.addEventListener("ended", playNextTrack);

    if (nextTrack) {
      nextTrack.addEventListener("click", playNextTrack);
    }

    if (previousTrack) {
      previousTrack.addEventListener("click", playPreviousTrack);
    }

    loadTrack(0, false);
    synchronizeVisualizer();
  }

  /* =====================================================
     CELEBRATION
  ===================================================== */

  function celebrate() {
    if (!confetti) {
      return;
    }

    confetti.innerHTML = "";

    const fragment =
      document.createDocumentFragment();

    for (
      let index = 0;
      index < 72;
      index += 1
    ) {
      const piece =
        document.createElement("span");

      piece.className =
        "confetti-piece";

      piece.style.left =
        `${Math.random() * 100}%`;

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

      piece.style.animationDelay =
        `${Math.random() * 0.5}s`;

      fragment.appendChild(piece);
    }

    confetti.appendChild(fragment);

    window.setTimeout(() => {
      confetti.innerHTML = "";
    }, 5500);
  }

  function initializeCelebration() {
    if (celebrateButton) {
      celebrateButton.addEventListener(
        "click",
        celebrate
      );
    }
  }

  /* =====================================================
     PANEL LIGHTING
  ===================================================== */

  function initializePanelLighting() {
    document
      .querySelectorAll(".panel")
      .forEach((panel) => {
        panel.addEventListener(
          "pointermove",
          (event) => {
            const rectangle =
              panel.getBoundingClientRect();

            const mouseX =
              ((event.clientX - rectangle.left) /
                rectangle.width) *
              100;

            const mouseY =
              ((event.clientY - rectangle.top) /
                rectangle.height) *
              100;

            panel.style.setProperty(
              "--mx",
              `${mouseX}%`
            );

            panel.style.setProperty(
              "--my",
              `${mouseY}%`
            );
          }
        );

        panel.addEventListener(
          "pointerleave",
          () => {
            panel.style.removeProperty("--mx");
            panel.style.removeProperty("--my");
          }
        );
      });
  }

  /* =====================================================
     HIDDEN LOGO INTERACTION
  ===================================================== */

  function initializeLogoInteraction() {
    if (!copyrightLogo) {
      return;
    }

    copyrightLogo.addEventListener(
      "click",
      (event) => {
        logoClickCount += 1;

        window.clearTimeout(logoClickTimer);

        logoClickTimer =
          window.setTimeout(() => {
            logoClickCount = 0;
          }, 1800);

        if (logoClickCount < 7) {
          return;
        }

        event.preventDefault();

        logoClickCount = 0;

        document.body.classList.toggle(
          "secret-awake"
        );

        celebrate();
      }
    );
  }

  /* =====================================================
     START DASHBOARD
  ===================================================== */

  function initializeDashboard() {
    initializeTabs();
    createStars();
    initializeAudio();
    initializeCelebration();
    initializePanelLighting();
    initializeLogoInteraction();
    initializeMemberBoard();
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
