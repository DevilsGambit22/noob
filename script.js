const CLUB_SLUG = "republic-of-noobistan";
const MEMBER_LIMIT = 6;

const membersBoard = document.getElementById("membersBoard");
const membersStatus = document.getElementById("membersStatus");
const refreshMembers = document.getElementById("refreshMembers");

const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='80' fill='%230b2344'/%3E%3Ccircle cx='80' cy='59' r='28' fill='%2379bfee'/%3E%3Cpath d='M29 145c5-34 25-51 51-51s46 17 51 51' fill='%2379bfee'/%3E%3C/svg%3E";

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
  if (!timestamp) {
    return "New member";
  }

  const date = new Date(timestamp * 1000);

  if (Number.isNaN(date.getTime())) {
    return "New member";
  }

  return `Joined ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })}`;
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

function renderMemberCards(members) {
  membersBoard.innerHTML = members
    .map((member, index) => {
      const username = escapeHtml(member.username);
      const memberUrl =
        `https://www.chess.com/member/${encodeURIComponent(member.username)}`;

      return `
        <a
          class="member-card"
          data-member-card="${index}"
          href="${memberUrl}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="member-avatar-wrap">
            <img
              class="member-avatar"
              src="${DEFAULT_AVATAR}"
              alt="${username} avatar"
            >
          </span>

          <span class="member-name">${username}</span>

          <span class="member-meta">
            ${escapeHtml(formatJoinedDate(member.joined))}
          </span>
        </a>
      `;
    })
    .join("");
}

async function loadProfile(member, index) {
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

    const avatar = card.querySelector(".member-avatar");
    const name = card.querySelector(".member-name");
    const meta = card.querySelector(".member-meta");

    if (profile.url) {
      card.href = profile.url;
    }

    if (avatar && profile.avatar) {
      avatar.src = profile.avatar;

      avatar.onerror = () => {
        avatar.onerror = null;
        avatar.src = DEFAULT_AVATAR;
      };
    }

    if (name && profile.username) {
      name.textContent = profile.username;
    }

    if (meta) {
      const joinedText = formatJoinedDate(member.joined);

      meta.textContent = profile.title
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
  if (!membersBoard) {
    return;
  }

  if (refreshMembers) {
    refreshMembers.disabled = true;
  }

  if (membersStatus) {
    membersStatus.textContent = "Loading newest members…";
  }

  membersBoard.innerHTML = `
    <div class="member-skeleton"></div>
    <div class="member-skeleton"></div>
    <div class="member-skeleton"></div>
    <div class="member-skeleton"></div>
    <div class="member-skeleton"></div>
    <div class="member-skeleton"></div>
  `;

  try {
    const data = await requestJson(
      `https://api.chess.com/pub/club/${CLUB_SLUG}/members`
    );

    const allTimeMembers = Array.isArray(data.all_time)
      ? data.all_time
      : [];

    const newestMembers = allTimeMembers
      .filter((member) => {
        return (
          member &&
          typeof member.username === "string" &&
          member.username.trim()
        );
      })
      .sort((firstMember, secondMember) => {
        return (
          Number(secondMember.joined || 0) -
          Number(firstMember.joined || 0)
        );
      })
      .slice(0, MEMBER_LIMIT);

    if (!newestMembers.length) {
      throw new Error("No club members were returned.");
    }

    renderMemberCards(newestMembers);

    if (membersStatus) {
      membersStatus.textContent =
        `Showing ${newestMembers.length} newest members`;
    }

    for (let index = 0; index < newestMembers.length; index += 1) {
      await loadProfile(newestMembers[index], index);

      await new Promise((resolve) => {
        window.setTimeout(resolve, 200);
      });
    }
  } catch (error) {
    console.error("Newest member board error:", error);

    membersBoard.innerHTML = `
      <div class="members-error">
        Unable to load the newest members right now.
      </div>
    `;

    if (membersStatus) {
      membersStatus.textContent = "Member board unavailable";
    }
  } finally {
    if (refreshMembers) {
      refreshMembers.disabled = false;
    }
  }
}

if (refreshMembers) {
  refreshMembers.addEventListener("click", loadNewestMembers);
}

loadNewestMembers();
