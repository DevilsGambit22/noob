(() => {
  "use strict";

  /* =========================================================
     CONFIGURATION
  ========================================================= */

  const CLUB_SLUG = "republic-of-noobistan";
  const MEMBER_LIMIT = 6;
  const PROFILE_REQUEST_DELAY = 250;

  const DEFAULT_AVATAR =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='80' fill='%230b2344'/%3E%3Ccircle cx='80' cy='58' r='28' fill='%2379bfee'/%3E%3Cpath d='M29 145c5-34 25-51 51-51s46 17 51 51' fill='%2379bfee'/%3E%3C/svg%3E";

  /* =========================================================
     ELEMENTS
  ========================================================= */

  const tabs = Array.from(document.querySelectorAll(".tab"));
  const pages = Array.from(document.querySelectorAll(".page"));

  const audioPlayer = document.getElementById("audioPlayer");
  const visualizer = document.getElementById("visualizer");

  const stars = document.getElementById("stars");
  const confetti = document.getElementById("confetti");

  const celebrateButton =
    document.getElementById("celebrateButton");

  const copyrightLogo =
    document.getElementById("copyrightLogo");

  const membersBoard =
    document.getElementById("membersBoard");

  const membersStatus =
    document.getElementById("membersStatus");

  const refreshMembers =
    document.getElementById("refreshMembers");

  let logoClickCount = 0;
  let logoClickTimer = null;
  let membersAreLoading = false;

  /* =========================================================
     PAGE NAVIGATION
  ========================================================= */

  function activatePage(pageId) {
    if (!pageId) {
      return;
    }

    tabs.forEach((tab) => {
      const isActive = tab.dataset.page === pageId;

      tab.classList.toggle("active", isActive);
      tab.setAttribute(
        "aria-selected",
        String(isActive)
      );
    });

    pages.forEach((page) => {
      const isActive = page.id === pageId;

      page.classList.toggle("active", isActive);
      page.setAttribute(
        "aria-hidden",
        String(!isActive)
      );
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

      tab.addEventListener("keydown", (event) => {
        if (
          event.key !== "ArrowLeft" &&
          event.key !== "ArrowRight"
        ) {
          return;
        }

        event.preventDefault();

        const currentIndex = tabs.indexOf(tab);

        const nextIndex =
          event.key === "ArrowRight"
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) %
              tabs.length;

        tabs[nextIndex].focus();
        activatePage(tabs[nextIndex].dataset.page);
      });
    });
  }

  /* =========================================================
     UTILITY FUNCTIONS
  ========================================================= */

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) => {
        const entities = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        };

        return entities[character];
      }
    );
  }

  function formatJoinedDate(timestamp) {
    const numericTimestamp = Number(timestamp);

    if (
      !numericTimestamp ||
      !Number.isFinite(numericTimestamp)
    ) {
      return "New member";
    }

    const joinedDate = new Date(
      numericTimestamp * 1000
    );

    if (Number.isNaN(joinedDate.getTime())) {
      return "New member";
    }

    return `Joined ${joinedDate.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    )}`;
  }

  async function requestJson(url) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `Chess.com API request failed: ${response.status}`
      );
    }

    return response.json();
  }

  /* =========================================================
     NEWEST MEMBER BOARD
  ========================================================= */

  function normalizeMember(member, index) {
    if (
      member &&
      typeof member === "object" &&
      typeof member.username === "string" &&
      member.username.trim()
    ) {
      return {
        username: member.username.trim(),
        joined: Number(member.joined) || 0,
        originalIndex: index
      };
    }

    if (
      typeof member === "string" &&
      member.trim()
    ) {
      return {
        username: member.trim(),
        joined: 0,
        originalIndex: index
      };
    }

    return null;
  }

  function createMemberCard(member, index) {
    const safeUsername = escapeHtml(
      member.username
    );

    const profileUrl =
      `https://www.chess.com/member/${encodeURIComponent(
        member.username
      )}`;

    return `
      <a
        class="member-card"
        data-member-card="${index}"
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
          ${escapeHtml(
            formatJoinedDate(member.joined)
          )}
        </span>
      </a>
    `;
  }

  function renderMemberSkeletons() {
    if (!membersBoard) {
      return;
    }

    membersBoard.innerHTML = Array.from(
      { length: MEMBER_LIMIT },
      () => `
        <div class="member-skeleton">
          <span></span>
          <span></span>
          <span></span>
        </div>
      `
    ).join("");
  }

  function renderMemberError(message) {
    if (membersBoard) {
      membersBoard.innerHTML = `
        <div class="members-error">
          ${escapeHtml(message)}
        </div>
      `;
    }

    if (membersStatus) {
      membersStatus.textContent =
        "Member board unavailable";
    }
  }

  async function loadMemberProfile(
    member,
    index
  ) {
    if (!membersBoard) {
      return;
    }

    const card = membersBoard.querySelector(
      `[data-member-card="${index}"]`
    );

    if (!card) {
      return;
    }

    try {
      const profile = await requestJson(
        `https://api.chess.com/pub/player/${encodeURIComponent(
          member.username.toLowerCase()
        )}`
      );

      const avatarElement =
        card.querySelector(".member-avatar");

      const nameElement =
        card.querySelector(".member-name");

      const metaElement =
        card.querySelector(".member-meta");

      const profileUsername =
        profile.username || member.username;

      if (profile.url) {
        card.href = profile.url;
      }

      if (avatarElement) {
        avatarElement.alt =
          `${profileUsername} avatar`;

        if (profile.avatar) {
          avatarElement.src = profile.avatar;
        }

        avatarElement.addEventListener(
          "error",
          () => {
            avatarElement.src = DEFAULT_AVATAR;
          },
          { once: true }
        );
      }

      if (nameElement) {
        nameElement.textContent =
          profileUsername;
      }

      if (metaElement) {
        const joinedText =
          formatJoinedDate(member.joined);

        metaElement.textContent =
          profile.title
            ? `${profile.title} · ${joinedText}`
            : joinedText;
      }
    } catch (error) {
      console.warn(
        `Profile details could not be loaded for ${member.username}.`,
        error
      );
    }
  }

  async function loadNewestMembers() {
    if (
      !membersBoard ||
      membersAreLoading
    ) {
      return;
    }

    membersAreLoading = true;

    if (refreshMembers) {
      refreshMembers.disabled = true;
      refreshMembers.setAttribute(
        "aria-busy",
        "true"
      );
    }

    if (membersStatus) {
      membersStatus.textContent =
        "Loading newest members…";
    }

    renderMemberSkeletons();

    try {
      const clubData = await requestJson(
        `https://api.chess.com/pub/club/${CLUB_SLUG}/members`
      );

      const rawMembers =
        Array.isArray(clubData.all_time)
          ? clubData.all_time
          : [];

      const uniqueMembers = new Map();

      rawMembers.forEach(
        (rawMember, index) => {
          const member = normalizeMember(
            rawMember,
            index
          );

          if (!member) {
            return;
          }

          uniqueMembers.set(
            member.username.toLowerCase(),
            member
          );
        }
      );

      const newestMembers = Array.from(
        uniqueMembers.values()
      )
        .sort((firstMember, secondMember) => {
          if (
            firstMember.joined &&
            secondMember.joined
          ) {
            return (
              secondMember.joined -
              firstMember.joined
            );
          }

          return (
            secondMember.originalIndex -
            firstMember.originalIndex
          );
        })
        .slice(0, MEMBER_LIMIT);

      if (!newestMembers.length) {
        throw new Error(
          "No club members were returned."
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
        await loadMemberProfile(
          newestMembers[index],
          index
        );

        await wait(
          PROFILE_REQUEST_DELAY
        );
      }
    } catch (error) {
      console.error(
        "Newest member board error:",
        error
      );

      renderMemberError(
        "Unable to load the newest members right now. Press Refresh to try again."
      );
    } finally {
      membersAreLoading = false;

      if (refreshMembers) {
        refreshMembers.disabled = false;
        refreshMembers.removeAttribute(
          "aria-busy"
        );
      }
    }
  }

  function initializeMemberBoard() {
    if (refreshMembers) {
      refreshMembers.addEventListener(
        "click",
        () => {
          loadNewestMembers();
        }
      );
    }

    loadNewestMembers();
  }

  /* =========================================================
     BACKGROUND STARS
  ========================================================= */

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
        `${2.5 + Math.random() * 4.5}s`
      );

      star.style.setProperty(
        "--delay",
        `${Math.random() * -6}s`
      );

      fragment.appendChild(star);
    }

    stars.appendChild(fragment);
  }

  /* =========================================================
     AUDIO VISUALIZER
  ========================================================= */

  function synchronizeVisualizer() {
    if (
      !audioPlayer ||
      !visualizer
    ) {
      return;
    }

    visualizer.classList.toggle(
      "playing",
      !audioPlayer.paused
    );
  }

  function initializeAudio() {
    if (!audioPlayer) {
      return;
    }

    audioPlayer.addEventListener(
      "play",
      synchronizeVisualizer
    );

    audioPlayer.addEventListener(
      "pause",
      synchronizeVisualizer
    );

    audioPlayer.addEventListener(
      "ended",
      synchronizeVisualizer
    );

    synchronizeVisualizer();
  }

  /* =========================================================
     CELEBRATION EFFECT
  ========================================================= */

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
        String(
          185 + Math.random() * 65
        )
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

  /* =========================================================
     PANEL LIGHTING EFFECT
  ========================================================= */

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
              ((event.clientX -
                rectangle.left) /
                rectangle.width) *
              100;

            const mouseY =
              ((event.clientY -
                rectangle.top) /
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
            panel.style.removeProperty(
              "--mx"
            );

            panel.style.removeProperty(
              "--my"
            );
          }
        );
      });
  }

  /* =========================================================
     HIDDEN LOGO INTERACTION
  ========================================================= */

  function initializeLogoInteraction() {
    if (!copyrightLogo) {
      return;
    }

    copyrightLogo.addEventListener(
      "click",
      (event) => {
        logoClickCount += 1;

        window.clearTimeout(
          logoClickTimer
        );

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

  /* =========================================================
     INITIALIZATION
  ========================================================= */

  function initializeDashboard() {
    initializeTabs();
    createStars();
    initializeAudio();
    initializeCelebration();
    initializePanelLighting();
    initializeLogoInteraction();
    initializeMemberBoard();
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initializeDashboard,
      { once: true }
    );
  } else {
    initializeDashboard();
  }
})();
