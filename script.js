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

  const DEFAULT_AVATAR =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='80' fill='%230b2344'/%3E%3Ccircle cx='80' cy='59' r='28' fill='%2379bfee'/%3E%3Cpath d='M29 145c5-34 25-51 51-51s46 17 51 51' fill='%2379bfee'/%3E%3C/svg%3E";

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

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activatePage(tab.dataset.page);
    });
  });

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => {
      const characters = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      };

      return characters[character];
    });
  }

  function joinedLabel(timestamp) {
    if (!timestamp) {
      return "New member";
    }

    const joinedDate = new Date(timestamp * 1000);

    if (Number.isNaN(joinedDate.getTime())) {
      return "New member";
    }

    return `Joined ${joinedDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    })}`;
  }

  async function fetchChessApi(url) {
    const separator = url.includes("?") ? "&" : "?";

    const response = await fetch(
      `${url}${separator}cache=${Date.now()}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Chess.com API returned ${response.status}`);
    }

    return response.json();
  }

  function normalizeMember(entry, sourceIndex) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof entry.username === "string"
    ) {
      return {
        username: entry.username.trim(),
        joined: Number(entry.joined) || 0,
        sourceIndex
      };
    }

    if (typeof entry === "string" && entry.trim()) {
      return {
        username: entry.trim(),
        joined: 0,
        sourceIndex
      };
    }

    return null;
  }

  function createMemberCard(member, index) {
    const username = member.username;
    const profileUrl =
      `https://www.chess.com/member/${encodeURIComponent(username)}`;

    return `
      <a
        class="member-card"
        data-member-index="${index}"
        style="--member-delay:${index * 65}ms"
        href="${profileUrl}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="member-avatar-wrap">
          <img
            class="member-avatar"
            src="${DEFAULT_AVATAR}"
            alt="${escapeHtml(username)} avatar"
            loading="lazy"
          >
        </span>

        <span class="member-name">
          ${escapeHtml(username)}
        </span>

        <span class="member-meta">
          ${escapeHtml(joinedLabel(member.joined))}
        </span>
      </a>
    `;
  }

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  async function loadMemberProfiles(members) {
    for (let index = 0; index < members.length; index += 1) {
      const member = members[index];

      const card = membersBoard.querySelector(
        `[data-member-index="${index}"]`
      );

      if (!card) {
        continue;
      }

      try {
        const profile = await fetchChessApi(
          `https://api.chess.com/pub/player/${encodeURIComponent(
            member.username.toLowerCase()
          )}`
        );

        const username = profile.username || member.username;
        const avatar = profile.avatar || DEFAULT_AVATAR;
        const profileUrl =
          profile.url ||
          `https://www.chess.com/member/${encodeURIComponent(username)}`;

        card.href = profileUrl;

        const image = card.querySelector(".member-avatar");
        const name = card.querySelector(".member-name");
        const meta = card.querySelector(".member-meta");

        if (image) {
          image.src = avatar;
          image.alt = `${username} avatar`;

          image.addEventListener(
            "error",
            () => {
              image.src = DEFAULT_AVATAR;
            },
            { once: true }
          );
        }

        if (name) {
          name.textContent = username;
        }

        if (meta) {
          const titleText = profile.title
            ? `${escapeHtml(profile.title)} · `
            : "";

          meta.innerHTML =
            `${titleText}${escapeHtml(joinedLabel(member.joined))}`;
        }
      } catch (error) {
        console.warn(
          `Could not load profile for ${member.username}:`,
          error
        );
      }

      await wait(250);
    }
  }

  async function loadNewestMembers() {
    if (!membersBoard) {
      return;
    }

    if (refreshMembers) {
      refreshMembers.disabled = true;
    }

    if (membersStatus) {
      membersStatus.textContent = "Loading newest members…";
    }

    membersBoard.innerHTML = Array.from(
      { length: 6 },
      () => '<div class="member-skeleton"></div>'
    ).join("");

    try {
      const clubData = await fetchChessApi(
        `https://api.chess.com/pub/club/${CLUB_SLUG}/members`
      );

      const rawMembers = Array.isArray(clubData.all_time)
        ? clubData.all_time
        : [];

      const uniqueMembers = new Map();

      rawMembers
        .map((entry, sourceIndex) =>
          normalizeMember(entry, sourceIndex)
        )
        .filter(Boolean)
        .forEach((member) => {
          uniqueMembers.set(
            member.username.toLowerCase(),
            member
          );
        });

      const newestMembers = [...uniqueMembers.values()]
        .sort((memberA, memberB) => {
          if (memberA.joined && memberB.joined) {
            return memberB.joined - memberA.joined;
          }

          return memberB.sourceIndex - memberA.sourceIndex;
        })
        .slice(0, 6);

      if (!newestMembers.length) {
        throw new Error(
          "Chess.com returned no members for this club."
        );
      }

      membersBoard.innerHTML = newestMembers
        .map(createMemberCard)
        .join("");

      if (membersStatus) {
        membersStatus.textContent =
          `Showing ${newestMembers.length} newest members`;
      }

      await loadMemberProfiles(newestMembers);
    } catch (error) {
      console.error("Unable to load newest members:", error);

      membersBoard.innerHTML = `
        <div class="members-error">
          The newest members could not be loaded.
          Press Refresh to try again.
        </div>
      `;

      if (membersStatus) {
        membersStatus.textContent =
          "Unable to load newest members";
      }
    } finally {
      if (refreshMembers) {
        refreshMembers.disabled = false;
      }
    }
  }

  if (refreshMembers) {
    refreshMembers.addEventListener(
      "click",
      loadNewestMembers
    );
  }

  function createStars(count = 72) {
    if (!stars) {
      return;
    }

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
        `${Math.random() * -5}s`
      );

      fragment.appendChild(star);
    }

    stars.appendChild(fragment);
  }

  function syncVisualizer() {
    if (!audio || !visualizer) {
      return;
    }

    visualizer.classList.toggle(
      "playing",
      !audio.paused
    );
  }

  if (audio) {
    audio.addEventListener("play", syncVisualizer);
    audio.addEventListener("pause", syncVisualizer);
    audio.addEventListener("ended", syncVisualizer);
  }

  function celebrate() {
    if (!confetti) {
      return;
    }

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < 72; index += 1) {
      const piece = document.createElement("span");

      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;

      piece.style.setProperty(
        "--hue",
        String(190 + Math.random() * 55)
      );

      piece.style.setProperty(
        "--fall-duration",
        `${2.2 + Math.random() * 2.2}s`
      );

      piece.style.setProperty(
        "--drift",
        `${-90 + Math.random() * 180}px`
      );

      piece.style.animationDelay =
        `${Math.random() * 0.5}s`;

      fragment.appendChild(piece);
    }

    confetti.appendChild(fragment);

    window.setTimeout(() => {
      confetti.innerHTML = "";
    }, 5200);
  }

  if (celebrateButton) {
    celebrateButton.addEventListener(
      "click",
      celebrate
    );
  }

  document.querySelectorAll(".panel").forEach((panel) => {
    panel.addEventListener("pointermove", (event) => {
      const rectangle = panel.getBoundingClientRect();

      const mouseX =
        ((event.clientX - rectangle.left) /
          rectangle.width) *
        100;

      const mouseY =
        ((event.clientY - rectangle.top) /
          rectangle.height) *
        100;

      panel.style.setProperty("--mx", `${mouseX}%`);
      panel.style.setProperty("--my", `${mouseY}%`);
    });
  });

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

  createStars();
  loadNewestMembers();
})();
