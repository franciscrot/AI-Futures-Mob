// Mobile/card text presentation overrides.
// Loaded after script.js so the core game mechanics remain unchanged.

(function () {
  const style = document.createElement("style");
  style.textContent = `
    .card-desc-bullet {
      display: block;
      margin-bottom: 0.35em;
    }

    .card-prepared-note {
      display: block;
      margin-top: 0;
      font-weight: 600;
    }

    #tooltipsToggle {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  function renderInlineCardDescription(desc, card) {
    const isChoice = Boolean(CHOICE_CARD_OPTIONS[card.id]);
    const isActionOrEvent = card.type === "action" || card.type === "event";

    if (isChoice || !isActionOrEvent) {
      desc.textContent = formatCardDescription(card);
      return;
    }

    desc.textContent = "";
    const lines = formatCardDescription(card).split("\n");

    lines.forEach((line) => {
      if (!line.trim()) return;
      const lineElement = document.createElement("span");
      lineElement.textContent = line;
      if (line.trimStart().startsWith("•")) {
        lineElement.className = "card-desc-bullet";
      } else {
        lineElement.style.display = "block";
      }
      desc.appendChild(lineElement);
    });

    if (card.type === "event") {
      const preparedText = getEventActionTooltip(card);
      if (preparedText) {
        const preparedNote = document.createElement("span");
        preparedNote.className = "card-prepared-note";
        preparedNote.textContent = preparedText;
        desc.appendChild(preparedNote);
      }
    }
  }

  renderPlayerHand = function () {
    const handDiv = el("playerHand");
    if (!handDiv) return;
    handDiv.innerHTML = "";
    clearEventHighlights();
    hideEventActionTooltip();

    normaliseActiveHandIndex();
    renderHandNavigation();
    const card = player.hand[activeHandIndex];
    if (!card) return scheduleScoreRailPosition();
    const index = activeHandIndex;
    const cardDiv = document.createElement("div");
    cardDiv.className = "card";
    cardDiv.style.background = card.type === "action" ? "steelblue" : "#E97132";
    cardDiv.tabIndex = 0;
    cardDiv.setAttribute("role", "button");
    cardDiv.setAttribute("aria-label", `${card.name.replace(/^\\d+:\\s*/, "")}. Card ${index + 1} of ${player.hand.length}. Swipe left for the next card, swipe right to play, or double-tap to skip.`);

    const headerRow = document.createElement("div");
    headerRow.className = "card-header-row";
    const idBadge = document.createElement("div");
    idBadge.className = "card-id";
    idBadge.textContent = card.displayId ?? card.id;
    headerRow.appendChild(idBadge);
    const typeText = document.createElement("span");
    typeText.className = "card-type";
    typeText.textContent = CHOICE_CARD_OPTIONS[card.id] ? "choice" : card.type;
    headerRow.appendChild(typeText);
    cardDiv.appendChild(headerRow);

    const header = document.createElement("h4");
    header.className = "card-name";
    header.textContent = card.name.replace(/^\\d+:\\s*/, "");
    cardDiv.appendChild(header);

    const desc = document.createElement("div");
    desc.className = "card-desc";
    renderInlineCardDescription(desc, card);
    cardDiv.appendChild(desc);

    attachCardGestureControls(cardDiv, index);
    cardDiv.addEventListener("click", (event) => {
      if (
        Date.now() < suppressCardClickUntil ||
        !window.matchMedia("(hover: hover) and (pointer: fine)").matches
      ) return;
      event.preventDefault();
      playActiveCard(index);
    });
    cardDiv.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showNextHandCard();
      } else if (["ArrowRight", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        playActiveCard(index);
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        requestSkipConfirmation(index);
      }
    });

    if (card.type === "event") {
      cardDiv.addEventListener("mouseenter", () => {
        setEventHighlights(card);
      });
      cardDiv.addEventListener("mouseleave", () => {
        clearEventHighlights();
      });
    }

    handDiv.appendChild(cardDiv);
    scheduleScoreRailPosition();
  };

  // Remove any tooltip left over from the original renderer, then refresh
  // the current card so the inline preparation note is immediately visible.
  hideEventActionTooltip();
  renderPlayerHand();
})();
