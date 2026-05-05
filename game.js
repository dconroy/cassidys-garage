const SALE_DURATION_SECONDS = 60;
const CUSTOMER_MIN_DELAY = 2000;
const CUSTOMER_MAX_DELAY = 4000;
const CASSIDY_SPEED = 125;

// Each scene has its own play area and doors that warp Cassidy to other scenes.
const SCENES = {
  yard: {
    label: "Yard",
    play: { minX: 36, maxX: 724, minY: 126, maxY: 404 },
    doors: [
      { x: 516, y: 196, w: 60, h: 30, target: "house", spawnX: 380, spawnY: 360, label: "Enter House" },
      { x: 592, y: 206, w: 72, h: 30, target: "garage", spawnX: 380, spawnY: 360, label: "Enter Garage" }
    ]
  },
  house: {
    label: "Inside the House",
    play: { minX: 70, maxX: 690, minY: 130, maxY: 400 },
    doors: [
      { x: 340, y: 392, w: 100, h: 28, target: "yard", spawnX: 546, spawnY: 246, label: "Back to Yard" }
    ]
  },
  garage: {
    label: "Inside the Garage",
    play: { minX: 70, maxX: 690, minY: 130, maxY: 400 },
    doors: [
      { x: 340, y: 392, w: 100, h: 28, target: "yard", spawnX: 628, spawnY: 256, label: "Back to Yard" }
    ]
  }
};

// Edit this list to change the sale items, starting stock, fair prices, and canvas positions.
const itemTemplates = [
  { id: "guitar", name: "Guitar", icon: "🎸", quantity: 3, suggestedPrice: 25, x: 258, y: 288, slotLabel: "Front Spot", viewBonus: 1.35 },
  { id: "computer", name: "Computer", icon: "💻", quantity: 2, suggestedPrice: 75, x: 326, y: 288, slotLabel: "Front Spot", viewBonus: 1.35 },
  { id: "clothes", name: "Old Clothes", icon: "👕", quantity: 8, suggestedPrice: 8, x: 394, y: 288, slotLabel: "Middle Spot", viewBonus: 1.1 },
  { id: "toys", name: "Toys", icon: "🧸", quantity: 6, suggestedPrice: 12, x: 462, y: 288, slotLabel: "Middle Spot", viewBonus: 1.1 },
  { id: "books", name: "Books", icon: "📚", quantity: 10, suggestedPrice: 5, x: 530, y: 288, slotLabel: "Side Spot", viewBonus: 0.85 }
];

// Clutter spots live across all three scenes; players walk into doors to reach them.
const clutterSpotTemplates = [
  { itemId: "clothes", scene: "yard", x: 118, y: 314, label: "laundry basket" },
  { itemId: "toys", scene: "house", x: 250, y: 230, label: "toy bin" },
  { itemId: "guitar", scene: "house", x: 540, y: 200, label: "attic guitar" },
  { itemId: "books", scene: "garage", x: 220, y: 240, label: "book box" },
  { itemId: "computer", scene: "garage", x: 530, y: 220, label: "garage computer" }
];

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const elements = {
  timer: document.getElementById("timer"),
  money: document.getElementById("money"),
  itemsSold: document.getElementById("itemsSold"),
  happyCustomers: document.getElementById("happyCustomers"),
  walkaways: document.getElementById("walkaways"),
  statusText: document.getElementById("statusText"),
  goalTitle: document.getElementById("goalTitle"),
  goalDetails: document.getElementById("goalDetails"),
  itemsPanel: document.getElementById("itemsPanel"),
  eventLog: document.getElementById("eventLog"),
  actionButton: document.getElementById("actionButton"),
  startButton: document.getElementById("startButton"),
  restartButton: document.getElementById("restartButton"),
  summaryScreen: document.getElementById("summaryScreen"),
  summaryRestartButton: document.getElementById("summaryRestartButton"),
  ratingTitle: document.getElementById("ratingTitle"),
  finalMoney: document.getElementById("finalMoney"),
  finalSold: document.getElementById("finalSold"),
  finalHappy: document.getElementById("finalHappy"),
  finalWalkaways: document.getElementById("finalWalkaways"),
  strategyHint: document.getElementById("strategyHint"),
  moveButtons: document.querySelectorAll(".move-button")
};

const moveKeys = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right"
};

const buyMessages = [
  "A customer grinned and bought the {item} for {price}.",
  "Coin sparkle! The {item} found a new home for {price}.",
  "A neighbor said, \"Great deal!\" and picked up the {item}.",
  "Cassidy wrapped up the {item} with a proud little smile."
];

const tooExpensiveMessages = [
  "Someone checked the {item} tag and decided to save their coins.",
  "A customer liked the {item}, but the price felt a bit steep.",
  "The {item} got a maybe-next-time shrug.",
  "A little bargain hunter hoped the {item} would get a smaller sticker."
];

const soldOutMessages = [
  "Someone asked for {item}, but Cassidy had already sold them all.",
  "A late customer missed the last {item}. Popular table!",
  "The {item} spot was empty, which made Cassidy feel pretty fancy."
];

const bonusMessages = [
  "Cassidy waved at a happy customer.",
  "A tiny breeze made the sale sign wiggle.",
  "Someone complimented Cassidy's super neat price tags.",
  "The lemonade cup on the table looked very official.",
  "Cassidy did a tiny victory step by the table."
];

let items = [];
let customers = [];
let moneyEarned = 0;
let happyCustomers = 0;
let walkaways = 0;
let totalItemsSold = 0;
let gameState = "setup";
let startTime = 0;
let nextCustomerAt = 0;
let lastFrameTime = 0;
let clutterSpots = [];
let cassidy = createCassidy();
let activeMoves = new Set();
let currentScene = "yard";
let doorCooldownUntil = 0;

function createCassidy() {
  return {
    x: 152,
    y: 230,
    direction: "down",
    isMoving: false,
    walkTime: 0,
    cheerUntil: 0
  };
}

function resetGame() {
  items = itemTemplates.map((item) => ({
    ...item,
    inventory: 0,
    price: item.suggestedPrice,
    sold: 0,
    ready: false
  }));
  clutterSpots = clutterSpotTemplates.map((spot) => ({ ...spot, found: false }));

  customers = [];
  moneyEarned = 0;
  happyCustomers = 0;
  walkaways = 0;
  totalItemsSold = 0;
  gameState = "setup";
  startTime = 0;
  nextCustomerAt = 0;
  lastFrameTime = performance.now();
  cassidy = createCassidy();
  activeMoves.clear();
  currentScene = "yard";
  doorCooldownUntil = 0;

  elements.summaryScreen.classList.add("hidden");
  elements.restartButton.classList.add("hidden");
  elements.startButton.classList.remove("hidden");
  elements.actionButton.classList.remove("hidden");
  elements.startButton.disabled = true;
  elements.actionButton.disabled = false;
  elements.statusText.textContent = "Prep quest: find clutter, tag it, then start the sale!";
  elements.strategyHint.textContent = "";
  elements.eventLog.innerHTML = "";

  renderItemsPanel();
  updateStats(SALE_DURATION_SECONDS);
  updatePrepControls();
  addLog("Prep quest started! Walk Cassidy to sparkling clutter and press Space or Find / Tag.");
}

function renderItemsPanel() {
  elements.itemsPanel.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "item-card";
    const statusClass = item.ready ? "ready" : "not-ready";
    const statusText = item.ready ? "Tagged" : "Find clutter";
    card.innerHTML = `
      <div class="item-icon" aria-hidden="true">${item.icon}</div>
      <div>
        <div class="item-name">${item.name}</div>
        <span class="item-meta">Fair: $${item.suggestedPrice} | Views: <span id="${item.id}-views">${getViewLabel(item)}</span> | Left: <span id="${item.id}-inventory">${item.inventory}</span> | Sold: <span id="${item.id}-sold">${item.sold}</span> | <span id="${item.id}-status" class="${statusClass}">${statusText}</span></span>
      </div>
      <div class="price-row">
        <span>Price tag</span>
        <div class="price-controls">
          <button class="price-button" data-action="decrease" data-id="${item.id}" aria-label="Lower ${item.name} price">-</button>
          <span class="current-price" id="${item.id}-price">$${item.price}</span>
          <button class="price-button" data-action="increase" data-id="${item.id}" aria-label="Raise ${item.name} price">+</button>
        </div>
      </div>
      <div class="slot-row">
        <span>Table spot: <strong id="${item.id}-slot">${item.slotLabel}</strong></span>
        <div class="slot-controls">
          <button class="slot-button" data-direction="left" data-id="${item.id}" aria-label="Move ${item.name} toward higher traffic">◀ Better spot</button>
          <button class="slot-button" data-direction="right" data-id="${item.id}" aria-label="Move ${item.name} toward lower traffic">Worse spot ▶</button>
        </div>
      </div>
    `;
    elements.itemsPanel.appendChild(card);
  });

  elements.itemsPanel.querySelectorAll(".price-button").forEach((button) => {
    button.addEventListener("click", handlePriceClick);
  });
  elements.itemsPanel.querySelectorAll(".slot-button").forEach((button) => {
    button.addEventListener("click", handleSlotClick);
  });

  setPriceButtonsEnabled(gameState === "setup");
  updateSlotButtons();
}

function handlePriceClick(event) {
  const button = event.currentTarget;
  const item = items.find((candidate) => candidate.id === button.dataset.id);
  const change = button.dataset.action === "increase" ? 1 : -1;

  if (!item || gameState !== "setup") {
    return;
  }

  item.price = Math.max(1, item.price + change);
  document.getElementById(`${item.id}-price`).textContent = formatMoney(item.price);
}

function handleSlotClick(event) {
  const button = event.currentTarget;
  const item = items.find((candidate) => candidate.id === button.dataset.id);

  if (!item || !item.ready || gameState !== "setup") {
    return;
  }

  moveItemSlot(item, button.dataset.direction);
}

function moveItemSlot(item, direction) {
  const orderedItems = [...items].sort((a, b) => a.x - b.x);
  const currentIndex = orderedItems.findIndex((candidate) => candidate.id === item.id);
  const neighborIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
  const neighbor = orderedItems[neighborIndex];

  if (!neighbor) {
    return;
  }

  swapTableSlots(item, neighbor);
  renderItemsPanel();
  updatePrepControls();
  addLog(`${item.name} moved to a ${getViewLabel(item).toLowerCase()}-view table spot.`);
}

function swapTableSlots(firstItem, secondItem) {
  const firstSlot = {
    x: firstItem.x,
    y: firstItem.y,
    slotLabel: firstItem.slotLabel,
    viewBonus: firstItem.viewBonus
  };

  firstItem.x = secondItem.x;
  firstItem.y = secondItem.y;
  firstItem.slotLabel = secondItem.slotLabel;
  firstItem.viewBonus = secondItem.viewBonus;
  secondItem.x = firstSlot.x;
  secondItem.y = firstSlot.y;
  secondItem.slotLabel = firstSlot.slotLabel;
  secondItem.viewBonus = firstSlot.viewBonus;
}

function setPriceButtonsEnabled(enabled) {
  elements.itemsPanel.querySelectorAll(".price-button").forEach((button) => {
    const item = items.find((candidate) => candidate.id === button.dataset.id);
    button.disabled = !enabled || !item.ready;
  });
}

function updateSlotButtons() {
  const orderedItems = [...items].sort((a, b) => a.x - b.x);

  elements.itemsPanel.querySelectorAll(".slot-button").forEach((button) => {
    const item = items.find((candidate) => candidate.id === button.dataset.id);
    const itemIndex = orderedItems.findIndex((candidate) => candidate.id === item.id);
    const isLeftEdge = button.dataset.direction === "left" && itemIndex === 0;
    const isRightEdge = button.dataset.direction === "right" && itemIndex === orderedItems.length - 1;

    button.disabled = gameState !== "setup" || !item.ready || isLeftEdge || isRightEdge;
  });
}

function startSale() {
  if (!allItemsReady()) {
    addLog("Find and tag every clutter pile before opening the sale.");
    updatePrepControls();
    return;
  }

  if (currentScene !== "yard") {
    enterScene("yard", 152, 248);
  }

  gameState = "running";
  startTime = performance.now();
  nextCustomerAt = startTime + randomBetween(CUSTOMER_MIN_DELAY, CUSTOMER_MAX_DELAY);

  elements.startButton.disabled = true;
  elements.actionButton.classList.add("hidden");
  setPriceButtonsEnabled(false);
  elements.statusText.textContent = "Customers are arriving. Good luck, Cassidy!";
  updateSaleGoal();
  addLog("Cassidy flipped the sign to OPEN. The yard suddenly felt busy.");
}

function allItemsReady() {
  return items.every((item) => item.ready);
}

function updatePrepControls() {
  if (gameState !== "setup") {
    return;
  }

  const activeSpot = getActiveClutterSpot();
  const nearbySpot = getNearbyClutterSpot();
  const readyCount = items.filter((item) => item.ready).length;
  elements.startButton.disabled = !allItemsReady();
  elements.actionButton.disabled = false;

  if (allItemsReady()) {
    elements.actionButton.textContent = "All Treasures Tagged";
    elements.goalTitle.textContent = "Open the garage sale";
    elements.goalDetails.textContent = "Use Better/Worse spot buttons to arrange treasures, set prices, then start.";
    elements.statusText.textContent = "Everything is tagged. Put valuable treasures in High-view spots before opening!";
  } else if (nearbySpot) {
    elements.actionButton.textContent = `Tag ${getClutterTemplateItem(nearbySpot).name}`;
    elements.goalTitle.textContent = `Tag the ${nearbySpot.label}`;
    elements.goalDetails.textContent = "Press Space or the green button.";
    elements.statusText.textContent = `You're close! Tag the ${nearbySpot.label}.`;
  } else if (activeSpot && activeSpot.scene !== currentScene) {
    const sceneLabel = SCENES[activeSpot.scene].label;
    elements.actionButton.textContent = `Walk to the ${sceneLabel}`;
    elements.goalTitle.textContent = `Go to the ${sceneLabel}`;
    elements.goalDetails.textContent = `Follow the arrow to the ${sceneLabel}, the next ${activeSpot.label} is in there.`;
    elements.statusText.textContent = `Step on the door mat to enter the ${sceneLabel}.`;
  } else if (activeSpot) {
    elements.actionButton.textContent = `Follow Arrow to ${getClutterTemplateItem(activeSpot).name}`;
    elements.goalTitle.textContent = `Go to the ${activeSpot.label}`;
    elements.goalDetails.textContent = `Follow the arrow. Treasures tagged: ${readyCount}/${items.length}.`;
    elements.statusText.textContent = `Prep quest: walk to the glowing ${activeSpot.label}.`;
  } else {
    elements.actionButton.textContent = "Prep Complete";
    elements.goalTitle.textContent = "Prep complete";
    elements.goalDetails.textContent = "Set prices, then open the sale.";
    elements.statusText.textContent = "Everything is ready!";
  }
}

function updateSaleGoal() {
  if (gameState === "running") {
    elements.goalTitle.textContent = "Garage sale is open";
    elements.goalDetails.textContent = "Front table spots get more customer views, but price still decides the sale.";
  } else if (gameState === "ended") {
    elements.goalTitle.textContent = "Sale complete";
    elements.goalDetails.textContent = "Check your rating and price hint.";
  }
}

function handlePrepAction() {
  if (gameState !== "setup") {
    return;
  }

  if (allItemsReady()) {
    addLog("Everything is tagged. Set prices, then press Start Garage Sale.");
    return;
  }

  const spot = getNearbyClutterSpot();

  if (!spot) {
    const activeSpot = getActiveClutterSpot();
    if (activeSpot && activeSpot.scene !== currentScene) {
      addLog(`The ${activeSpot.label} is in the ${SCENES[activeSpot.scene].label}. Walk through the door!`);
    } else if (activeSpot) {
      addLog(`Follow the yellow arrow to the ${activeSpot.label}, then tag it.`);
    }
    updatePrepControls();
    return;
  }

  const item = getClutterItem(spot);

  spot.found = true;
  item.ready = true;
  item.inventory = item.quantity;
  cassidy.cheerUntil = performance.now() + 1100;
  updateItemStats(item);
  setPriceButtonsEnabled(true);
  updateSlotButtons();
  addLog(`Cassidy found the ${spot.label}, added cute price tags, and carried it downstairs.`);
  updatePrepControls();

  if (allItemsReady()) {
    addLog("All treasures are on the table! Pick prices and open the garage sale.");
  }
}

function getNearbyClutterSpot() {
  const activeSpot = getActiveClutterSpot();

  if (!activeSpot || activeSpot.scene !== currentScene) {
    return null;
  }

  if (distance(cassidy.x, cassidy.y, activeSpot.x, activeSpot.y) >= 58) {
    return null;
  }

  return activeSpot;
}

function getDoorToScene(targetScene) {
  return getCurrentScene().doors.find((door) => door.target === targetScene);
}

function getActiveClutterSpot() {
  return clutterSpots.find((spot) => !spot.found);
}

function getClutterItem(spot) {
  return items.find((candidate) => candidate.id === spot.itemId);
}

function getClutterTemplateItem(spot) {
  return itemTemplates.find((candidate) => candidate.id === spot.itemId);
}

function updateGame(timestamp) {
  const delta = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  updateCassidy(delta, timestamp);

  if (gameState === "running") {
    const elapsedSeconds = (timestamp - startTime) / 1000;
    const secondsLeft = Math.max(0, Math.ceil(SALE_DURATION_SECONDS - elapsedSeconds));
    updateStats(secondsLeft);

    if (timestamp >= nextCustomerAt && secondsLeft > 0) {
      spawnCustomer();
      nextCustomerAt = timestamp + randomBetween(CUSTOMER_MIN_DELAY, CUSTOMER_MAX_DELAY);
    }

    if (elapsedSeconds >= SALE_DURATION_SECONDS) {
      endSale();
    }
  }

  updateCustomers(delta);
  drawScene(timestamp);
  requestAnimationFrame(updateGame);
}

function updateCassidy(delta, timestamp) {
  let dx = 0;
  let dy = 0;

  if (activeMoves.has("up")) {
    dy -= 1;
  }
  if (activeMoves.has("down")) {
    dy += 1;
  }
  if (activeMoves.has("left")) {
    dx -= 1;
  }
  if (activeMoves.has("right")) {
    dx += 1;
  }

  cassidy.isMoving = dx !== 0 || dy !== 0;

  if (!cassidy.isMoving) {
    return;
  }

  const play = getCurrentScene().play;
  const length = Math.hypot(dx, dy) || 1;
  const step = (CASSIDY_SPEED * delta) / 1000;
  cassidy.x = clamp(cassidy.x + (dx / length) * step, play.minX, play.maxX);
  cassidy.y = clamp(cassidy.y + (dy / length) * step, play.minY, play.maxY);
  cassidy.walkTime += delta;
  cassidy.direction = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? "right" : "left")
    : (dy > 0 ? "down" : "up");

  if (gameState === "setup") {
    checkDoorTriggers(timestamp);
  }

  if (gameState === "running") {
    cheerNearbyCustomer(timestamp);
  } else if (gameState === "setup") {
    updatePrepControls();
  }
}

function getCurrentScene() {
  return SCENES[currentScene];
}

function checkDoorTriggers(timestamp) {
  if (timestamp < doorCooldownUntil) {
    return;
  }

  const door = getCurrentScene().doors.find((candidate) => {
    return cassidy.x >= candidate.x
      && cassidy.x <= candidate.x + candidate.w
      && cassidy.y >= candidate.y
      && cassidy.y <= candidate.y + candidate.h;
  });

  if (door) {
    enterScene(door.target, door.spawnX, door.spawnY);
  }
}

function enterScene(sceneId, x, y) {
  currentScene = sceneId;
  cassidy.x = x;
  cassidy.y = y;
  cassidy.isMoving = false;
  cassidy.direction = "down";
  doorCooldownUntil = performance.now() + 350;
  activeMoves.clear();
  addLog(`Cassidy walked into the ${SCENES[sceneId].label.toLowerCase()}.`);
  updatePrepControls();
}

function cheerNearbyCustomer(timestamp) {
  const nearbyCustomer = customers.find((customer) => {
    return customer.state === "thinking" && distance(cassidy.x, cassidy.y, customer.x, customer.y) < 58;
  });

  if (nearbyCustomer && cassidy.cheerUntil < timestamp) {
    cassidy.cheerUntil = timestamp + 900;
    nearbyCustomer.message = nearbyCustomer.bought ? "Thanks!" : "Hi!";

    if (Math.random() < 0.2) {
      addLog("Cassidy dashed over with a friendly hello.");
    }
  }
}

function spawnCustomer() {
  const shirtColors = ["#ff6b6b", "#4f8cff", "#b56cff", "#24b47e", "#ff9f43"];
  const y = randomBetween(128, 420);
  const target = { x: randomBetween(310, 486), y: randomBetween(248, 312) };

  customers.push({
    x: -24,
    y,
    targetX: target.x,
    targetY: target.y,
    exitX: canvas.width + 30,
    exitY: randomBetween(128, 420),
    speed: randomBetween(54, 76),
    state: "arriving",
    pauseTime: 0,
    color: shirtColors[Math.floor(Math.random() * shirtColors.length)],
    hairColor: ["#3a2a2a", "#70452f", "#d08a39", "#29324d"][Math.floor(Math.random() * 4)],
    item: null,
    message: "",
    bought: false,
    stepOffset: Math.random() * Math.PI * 2
  });
}

function updateCustomers(delta) {
  customers.forEach((customer) => {
    if (customer.state === "arriving") {
      moveToward(customer, customer.targetX, customer.targetY, delta);

      if (distance(customer.x, customer.y, customer.targetX, customer.targetY) < 3) {
        customer.state = "thinking";
        customer.pauseTime = randomBetween(650, 1100);
        evaluateCustomer(customer);
      }
    } else if (customer.state === "thinking") {
      customer.pauseTime -= delta;

      if (customer.pauseTime <= 0) {
        customer.state = "leaving";
      }
    } else if (customer.state === "leaving") {
      moveToward(customer, customer.exitX, customer.exitY, delta);
    }
  });

  customers = customers.filter((customer) => customer.x < canvas.width + 42);
}

function evaluateCustomer(customer) {
  const item = chooseCustomerItem();
  const chanceToBuy = getBuyChance(item.price, item.suggestedPrice);
  const didBuy = item.inventory > 0 && Math.random() < chanceToBuy;
  customer.item = item;
  customer.bought = didBuy;

  if (didBuy) {
    item.inventory -= 1;
    item.sold += 1;
    moneyEarned += item.price;
    happyCustomers += 1;
    totalItemsSold += 1;
    customer.message = "Yay!";

    addLog(fillMessage(randomFrom(buyMessages), item, formatMoney(item.price)));

    if (Math.random() < 0.35) {
      addLog(randomFrom(bonusMessages));
    }
  } else {
    walkaways += 1;
    customer.message = item.inventory <= 0 ? "Sold out!" : "Hmm...";

    if (item.inventory <= 0) {
      addLog(fillMessage(randomFrom(soldOutMessages), item, formatMoney(item.price)));
    } else {
      addLog(fillMessage(randomFrom(tooExpensiveMessages), item, formatMoney(item.price)));
    }
  }

  updateItemStats(item);
  updateStats(getSecondsLeft());
}

function chooseCustomerItem() {
  const availableItems = items.filter((item) => item.ready);
  const totalWeight = availableItems.reduce((total, item) => {
    return total + item.viewBonus;
  }, 0);
  let roll = Math.random() * totalWeight;

  for (const item of availableItems) {
    roll -= item.viewBonus;

    if (roll <= 0) {
      return item;
    }
  }

  return availableItems[availableItems.length - 1];
}

// Customer behavior lives here: higher prices mean lower buy odds.
function getBuyChance(price, suggestedPrice) {
  if (price <= suggestedPrice) {
    return 0.8;
  }

  if (price <= suggestedPrice * 1.25) {
    return 0.5;
  }

  if (price <= suggestedPrice * 1.5) {
    return 0.25;
  }

  return 0.1;
}

function endSale() {
  gameState = "ended";
  elements.restartButton.classList.remove("hidden");
  elements.startButton.classList.add("hidden");
  elements.statusText.textContent = "The sun is setting. Garage sale complete!";
  updateSaleGoal();
  addLog("The day ended, and Cassidy counted the cash box.");
  updateStats(0);
  showSummary();
}

function showSummary() {
  elements.ratingTitle.textContent = getRating();
  elements.finalMoney.textContent = formatMoney(moneyEarned);
  elements.finalSold.textContent = totalItemsSold;
  elements.finalHappy.textContent = happyCustomers;
  elements.finalWalkaways.textContent = walkaways;
  elements.strategyHint.textContent = getStrategyHint();
  elements.summaryScreen.classList.remove("hidden");
}

function getRating() {
  if (moneyEarned >= 260 || totalItemsSold >= 18) {
    return "Garage Sale Legend";
  }

  if (moneyEarned >= 160 || totalItemsSold >= 12) {
    return "Neighborhood Pro";
  }

  if (moneyEarned >= 80 || totalItemsSold >= 7) {
    return "Solid Seller";
  }

  return "Needs More Lemonade";
}

function getStrategyHint() {
  const averagePriceRatio = items.reduce((total, item) => {
    return total + item.price / item.suggestedPrice;
  }, 0) / items.length;
  const totalCustomers = happyCustomers + walkaways;
  const walkawayRate = totalCustomers === 0 ? 0 : walkaways / totalCustomers;
  const sellThroughRate = items.reduce((total, item) => total + item.sold, 0)
    / itemTemplates.reduce((total, item) => total + item.quantity, 0);

  if (averagePriceRatio > 1.25 && walkawayRate > 0.45) {
    return "Price strategy hint: Your prices leaned high, so lots of shoppers hesitated. Try lowering a few big-ticket items next round.";
  }

  if (averagePriceRatio < 0.9 && sellThroughRate > 0.55) {
    return "Price strategy hint: Your prices were friendly and items moved fast. You might earn more by nudging popular items up a dollar or two.";
  }

  if (averagePriceRatio > 1.1 && moneyEarned >= 160) {
    return "Price strategy hint: Bold pricing paid off pretty well. Watch the walkaways, but your premium tags found buyers.";
  }

  return "Price strategy hint: Your prices were nicely balanced. Keep fair deals on small items and experiment with one pricier treasure.";
}

function updateItemStats(item) {
  document.getElementById(`${item.id}-inventory`).textContent = item.inventory;
  document.getElementById(`${item.id}-sold`).textContent = item.sold;
  const status = document.getElementById(`${item.id}-status`);

  if (status) {
    status.textContent = item.ready ? "Tagged" : "Find clutter";
    status.className = item.ready ? "ready" : "not-ready";
  }

  const views = document.getElementById(`${item.id}-views`);
  const slot = document.getElementById(`${item.id}-slot`);

  if (views) {
    views.textContent = getViewLabel(item);
  }

  if (slot) {
    slot.textContent = item.slotLabel;
  }
}

function updateStats(secondsLeft) {
  elements.timer.textContent = secondsLeft;
  elements.money.textContent = formatMoney(moneyEarned);
  elements.itemsSold.textContent = totalItemsSold;
  elements.happyCustomers.textContent = happyCustomers;
  elements.walkaways.textContent = walkaways;
}

function getSecondsLeft() {
  if (gameState !== "running") {
    return SALE_DURATION_SECONDS;
  }

  return Math.max(0, Math.ceil(SALE_DURATION_SECONDS - (performance.now() - startTime) / 1000));
}

function addLog(message) {
  const entry = document.createElement("li");
  entry.textContent = message;
  elements.eventLog.prepend(entry);

  while (elements.eventLog.children.length > 18) {
    elements.eventLog.removeChild(elements.eventLog.lastChild);
  }
}

// Everything below draws original blocky pixel shapes on the canvas.
function drawScene(timestamp) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentScene === "yard") {
    drawSkyBits(timestamp);
    drawGrass();
    drawHouseAndGarage();
    drawYardDetails(timestamp);
    drawSaleTable();
    drawItems();
    drawDoorMats();
  } else if (currentScene === "house") {
    drawHouseInterior(timestamp);
    drawExitDoor("To Yard");
  } else if (currentScene === "garage") {
    drawGarageInterior(timestamp);
    drawExitDoor("To Yard");
  }

  drawClutterSpots(timestamp);
  drawTargetArrow();
  drawCharacters(timestamp);

  if (currentScene === "yard") {
    drawSign();
  }
}

function drawCharacters(timestamp) {
  const sprites = [{ y: cassidy.y, draw: () => drawCassidy(timestamp) }];

  if (currentScene === "yard") {
    customers.forEach((customer) => {
      sprites.push({ y: customer.y, draw: () => drawCustomer(customer, timestamp) });
    });
  }

  sprites.sort((a, b) => a.y - b.y).forEach((sprite) => sprite.draw());
}

function drawDoorMats() {
  if (gameState !== "setup") {
    return;
  }

  getCurrentScene().doors.forEach((door) => {
    const isHovered = cassidy.x >= door.x && cassidy.x <= door.x + door.w
      && Math.abs(cassidy.y - (door.y + door.h)) < 50;
    drawShadow(door.x + door.w / 2, door.y + door.h + 4, door.w * 0.8, 8, 0.18);
    ctx.fillStyle = isHovered ? "#ffd765" : "#fff8e8";
    ctx.fillRect(door.x, door.y, door.w, door.h);
    ctx.strokeStyle = "#2b1d26";
    ctx.lineWidth = 3;
    ctx.strokeRect(door.x, door.y, door.w, door.h);
    ctx.fillStyle = "#2b1d26";
    ctx.font = "bold 11px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(door.label, door.x + door.w / 2, door.y + door.h / 2);
  });
}

function drawExitDoor(label) {
  const door = getCurrentScene().doors[0];
  drawShadow(door.x + door.w / 2, door.y + door.h + 4, door.w * 0.8, 10, 0.22);
  drawBlock(door.x, door.y - 18, door.w, door.h + 22, "#7c5132", "#5a3823", 8);
  ctx.fillStyle = "#ffd765";
  ctx.fillRect(door.x + door.w - 12, door.y - 4, 4, 4);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, door.x + door.w / 2, door.y + door.h / 2);
}

function drawHouseInterior(timestamp) {
  ctx.fillStyle = "#7e5a44";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#9d7556";
  ctx.fillRect(0, 84, canvas.width, canvas.height - 84);

  ctx.fillStyle = "#c89b7a";
  for (let y = 90; y < canvas.height; y += 28) {
    ctx.fillRect(0, y, canvas.width, 4);
  }

  ctx.fillStyle = "#5a3823";
  ctx.fillRect(0, 60, canvas.width, 6);

  drawShadow(180, 360, 130, 14, 0.2);
  drawBlock(110, 290, 140, 78, "#c0825a", "#7e4f2f", 16);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(126, 304, 108, 36);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 2;
  ctx.strokeRect(126, 304, 108, 36);
  ctx.fillStyle = "#2b1d26";
  ctx.font = "bold 10px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("RUG", 180, 322);

  drawShadow(540, 290, 90, 12, 0.2);
  drawBlock(490, 220, 100, 70, "#3d8f3c", "#266926", 14);
  ctx.fillStyle = "#7bdff2";
  ctx.fillRect(498, 226, 84, 8);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "bold 11px Trebuchet MS";
  ctx.fillText("ATTIC STAIRS", 540, 252);

  ctx.fillStyle = "rgba(255, 247, 224, 0.18)";
  const flicker = (Math.sin(timestamp / 280) + 1) * 0.05;
  ctx.fillStyle = `rgba(255, 247, 224, ${0.12 + flicker})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#2b1d26";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("INSIDE THE HOUSE", canvas.width / 2, 30);
}

function drawGarageInterior(timestamp) {
  ctx.fillStyle = "#7d8086";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#a4a8ae";
  ctx.fillRect(0, 90, canvas.width, canvas.height - 90);

  ctx.fillStyle = "#5e6166";
  for (let x = 0; x < canvas.width; x += 60) {
    ctx.fillRect(x, 92, 4, canvas.height - 92);
  }
  ctx.fillStyle = "#5e6166";
  ctx.fillRect(0, 60, canvas.width, 6);

  drawShadow(canvas.width / 2, 124, 540, 24, 0.18);
  ctx.fillStyle = "#3a3d42";
  ctx.fillRect(40, 84, canvas.width - 80, 30);
  ctx.fillStyle = "#5e6166";
  for (let x = 60; x < canvas.width - 60; x += 28) {
    ctx.fillRect(x, 90, 16, 18);
  }

  drawShadow(180, 320, 180, 14, 0.22);
  drawBlock(110, 248, 200, 70, "#a35a3a", "#6c3520", 14);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "bold 11px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("WORKBENCH", 210, 282);

  drawShadow(560, 286, 80, 12, 0.18);
  drawBlock(530, 230, 60, 60, "#c98555", "#7e4f2f", 12);
  ctx.fillStyle = "#fff8e8";
  ctx.fillText("BOX", 560, 256);

  ctx.fillStyle = "#2b1d26";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText("INSIDE THE GARAGE", canvas.width / 2, 30);
}

function drawShadow(x, y, width, height, alpha = 0.22) {
  ctx.fillStyle = `rgba(43, 29, 38, ${alpha})`;
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
}

function drawBlock(x, y, width, height, topColor, frontColor, frontHeight = 8) {
  ctx.fillStyle = topColor;
  ctx.fillRect(x, y, width, height - frontHeight);
  ctx.fillStyle = frontColor;
  ctx.fillRect(x, y + height - frontHeight, width, frontHeight);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);
}

function getDepthScale(y) {
  const area = getCurrentScene().play;
  return clamp(0.94 + (y - area.minY) / (area.maxY - area.minY) * 0.1, 0.94, 1.04);
}

function drawSkyBits(timestamp) {
  ctx.fillStyle = "#9fe3ff";
  ctx.fillRect(0, 0, canvas.width, 86);

  const drift = (timestamp / 120) % 80;
  drawBlockCloud(72 + drift, 24);

  ctx.fillStyle = "#ffd765";
  ctx.fillRect(24, 22, 34, 34);
  ctx.fillStyle = "#fff3a3";
  ctx.fillRect(30, 28, 22, 22);
}

function drawGrass() {
  ctx.fillStyle = "#65b947";
  ctx.fillRect(0, 86, canvas.width, canvas.height - 86);

  ctx.fillStyle = "#3e8d38";
  for (let x = 0; x < canvas.width; x += 32) {
    for (let y = 96; y < canvas.height; y += 32) {
      if ((x + y) % 64 === 0) {
        ctx.fillRect(x + 8, y + 10, 8, 4);
        ctx.fillRect(x + 18, y + 20, 4, 8);
      }
    }
  }

  ctx.fillStyle = "#d8be79";
  ctx.fillRect(0, 414, canvas.width, 54);
  ctx.fillStyle = "#bf9d5a";
  ctx.fillRect(0, 436, canvas.width, 6);

  ctx.fillStyle = "#c8aa66";
  for (let x = 10; x < canvas.width; x += 44) {
    ctx.fillRect(x, 426, 18, 4);
  }
}

function drawHouseAndGarage() {
  ctx.fillStyle = "#8b613d";
  for (let x = 0; x < canvas.width; x += 56) {
    ctx.fillRect(x, 78, 24, 46);
  }
  ctx.fillRect(0, 92, canvas.width, 7);

  drawShadow(584, 220, 238, 22, 0.18);
  drawBlock(490, 52, 178, 142, "#ffcc7a", "#d99b5a", 14);
  ctx.fillStyle = "#c45b52";
  pixelTriangle(470, 56, 688, 56, 580, 0);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(470, 56);
  ctx.lineTo(580, 0);
  ctx.lineTo(688, 56);
  ctx.stroke();

  drawBlock(516, 122, 60, 72, "#7c5132", "#5a3823", 10);
  ctx.fillStyle = "#ffd765";
  ctx.fillRect(566, 156, 5, 5);

  drawBlock(588, 92, 42, 34, "#4f8cff", "#3266c4", 6);
  ctx.fillStyle = "#d8f7ff";
  ctx.fillRect(596, 100, 26, 14);

  drawBlock(592, 158, 72, 46, "#f7e6a0", "#d99b5a", 10);
  ctx.fillStyle = "#d99b5a";
  ctx.fillRect(600, 168, 56, 4);
  ctx.fillRect(600, 184, 56, 4);

  ctx.fillStyle = "#2b1d26";
  ctx.font = "bold 13px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("HOUSE", 580, 44);
  ctx.fillText("GARAGE", 628, 152);
}

function drawYardDetails(timestamp) {
  drawTree(64, 142, timestamp);
  drawFlowerPatch(544, 310);
}

function drawSaleTable() {
  drawShadow(412, 354, 420, 22, 0.22);
  drawBlock(206, 236, 398, 110, "#f2a65e", "#a65335", 22);
  ctx.fillStyle = "#fff3d6";
  ctx.fillRect(218, 248, 374, 8);

  ctx.fillStyle = "#6f3d35";
  ctx.fillRect(252, 332, 18, 36);
  ctx.fillRect(540, 332, 18, 36);

  drawDisplaySlots();

  drawShadow(580, 332, 28, 8, 0.18);
  drawBlock(566, 296, 28, 32, "#7bdff2", "#3aa8c9", 8);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(572, 302, 16, 14);

  if (!items.some((item) => item.ready)) {
    ctx.fillStyle = "#2b1d26";
    ctx.font = "bold 18px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("Find treasures first!", 404, 290);
  }
}

function drawDisplaySlots() {
  itemTemplates.forEach((item) => {
    const isHighView = item.viewBonus > 1.2;
    const isLowView = item.viewBonus < 1;
    const slotColor = isHighView ? "#ffd765" : isLowView ? "#d8f7ff" : "#fff8e8";
    const sideColor = isHighView ? "#d99b5a" : isLowView ? "#88bdd0" : "#d9b36c";

    drawBlock(item.x - 24, item.y - 24, 48, 48, slotColor, sideColor, 6);
    if (isHighView) {
      ctx.strokeStyle = "#ff8cc6";
      ctx.lineWidth = 3;
      ctx.strokeRect(item.x - 24, item.y - 24, 48, 48);
    }
    ctx.fillStyle = "#2b1d26";
    ctx.font = "bold 9px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(getViewLabel(item), item.x, item.y + 33);
  });
}

function drawClutterSpots(timestamp) {
  if (gameState !== "setup") {
    return;
  }

  const spot = getActiveClutterSpot();

  if (!spot || spot.scene !== currentScene) {
    return;
  }

  const item = getClutterTemplateItem(spot);
  const pulse = Math.sin(timestamp / 150) * 3;
  const isNearby = distance(cassidy.x, cassidy.y, spot.x, spot.y) < 58;
  const boxSize = isNearby ? 60 : 54;

  drawShadow(spot.x, spot.y + boxSize / 2 + 8, boxSize * 0.82, 12, 0.2);
  drawBlock(
    spot.x - boxSize / 2,
    spot.y - boxSize / 2,
    boxSize,
    boxSize,
    isNearby ? "#fff3a3" : "#f7e6a0",
    isNearby ? "#d99b5a" : "#c98555",
    10
  );
  if (isNearby) {
    ctx.strokeStyle = "#ff8cc6";
    ctx.lineWidth = 4;
    ctx.strokeRect(spot.x - boxSize / 2, spot.y - boxSize / 2, boxSize, boxSize);
  }

  ctx.fillStyle = "#fff8e8";
  ctx.font = "26px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(item.icon, spot.x, spot.y - 2);

  drawSparkle(spot.x - 32, spot.y - 32 + pulse);
  drawSparkle(spot.x + 32, spot.y - 28 - pulse);

  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(spot.x - 76, spot.y + 38, 152, 24);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 3;
  ctx.strokeRect(spot.x - 76, spot.y + 38, 152, 24);
  ctx.fillStyle = "#2b1d26";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.fillText(isNearby ? "Press Space!" : `Find: ${item.name}`, spot.x, spot.y + 54);
}

function drawTargetArrow() {
  if (gameState !== "setup") {
    return;
  }

  const spot = getActiveClutterSpot();
  if (!spot) {
    return;
  }

  let targetX;
  let targetY;

  if (spot.scene === currentScene) {
    if (distance(cassidy.x, cassidy.y, spot.x, spot.y) < 58) {
      return;
    }
    targetX = spot.x;
    targetY = spot.y;
  } else {
    const door = getCurrentScene().doors.find((candidate) => {
      if (currentScene === "yard") {
        return candidate.target === spot.scene;
      }
      return candidate.target === "yard";
    });
    if (!door) {
      return;
    }
    targetX = door.x + door.w / 2;
    targetY = door.y + door.h / 2;
  }

  const angle = Math.atan2(targetY - cassidy.y, targetX - cassidy.x);
  const arrowX = cassidy.x + Math.cos(angle) * 52;
  const arrowY = cassidy.y + Math.sin(angle) * 52 - 36;

  ctx.save();
  ctx.translate(arrowX, arrowY);
  ctx.rotate(angle);
  ctx.fillStyle = "#ffd765";
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-12, -16);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawItems() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "28px Arial";

  items.forEach((item) => {
    if (!item.ready) {
      return;
    }

    drawShadow(item.x, item.y + 28, 44, 10, 0.16);
    drawBlock(item.x - 26, item.y - 24, 52, 50, "#fff8e8", "#d9b36c", 8);
    ctx.fillText(item.icon, item.x, item.y - 4);
    ctx.fillStyle = "#2b1d26";
    ctx.font = "bold 13px Trebuchet MS";
    ctx.fillText(`$${item.price}`, item.x, item.y + 19);
    ctx.font = "28px Arial";
  });
}

function drawCassidy(timestamp) {
  const walkPhase = cassidy.isMoving ? Math.sin(cassidy.walkTime / 75) : 0;
  const bob = cassidy.isMoving ? Math.abs(walkPhase) * 2 : Math.sin(timestamp / 280) * 1.5;
  const x = cassidy.x;
  const y = cassidy.y - bob;

  ctx.save();
  ctx.translate(x, cassidy.y);
  ctx.scale(getDepthScale(cassidy.y), getDepthScale(cassidy.y));
  drawPixelPerson(0, -bob, "#ff8cc6", "#7a4a2a", "#ffd1a8", walkPhase, true, cassidy.direction);

  if (cassidy.cheerUntil > timestamp) {
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(-38, -bob - 82, 76, 24);
    ctx.strokeStyle = "#2b1d26";
    ctx.lineWidth = 2;
    ctx.strokeRect(-38, -bob - 82, 76, 24);
    ctx.fillStyle = "#2b1d26";
    ctx.font = "bold 12px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("Got it!", 0, -bob - 66);
  }
  ctx.restore();
}

function drawCustomer(customer, timestamp) {
  const walkPhase = customer.state === "thinking"
    ? 0
    : Math.sin(timestamp / 95 + customer.stepOffset);
  const bob = customer.state === "thinking" ? 0 : Math.abs(walkPhase) * 2;

  ctx.save();
  ctx.translate(customer.x, customer.y);
  ctx.scale(getDepthScale(customer.y), getDepthScale(customer.y));
  drawPixelPerson(0, -bob, customer.color, customer.hairColor, "#ffd6b6", walkPhase, false, "right");

  if (customer.message) {
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(-34, -58, 68, 22);
    ctx.strokeStyle = "#2b1d26";
    ctx.lineWidth = 2;
    ctx.strokeRect(-34, -58, 68, 22);
    ctx.fillStyle = "#2b1d26";
    ctx.font = "bold 11px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(customer.message, 0, -44);
  }
  ctx.restore();
}

function drawPixelPerson(x, y, shirtColor, hairColor, skinColor, walkPhase = 0, isCassidy = false, direction = "down") {
  const armSwing = Math.round(walkPhase * 4);
  const legSwing = Math.round(walkPhase * 5);
  const headBounce = Math.round(Math.abs(walkPhase) * 4);
  const headY = y - 40 - headBounce;

  drawShadow(x + 2, y + 42, 38, 9, 0.24);
  ctx.fillStyle = "#2b1d26";
  ctx.fillRect(x - 18, y + 38, 36, 5);
  ctx.fillStyle = "rgba(43, 29, 38, 0.14)";
  ctx.fillRect(x - 10, headY + 30, 24, 8);
  ctx.fillStyle = hairColor;
  ctx.fillRect(x - 17, headY - 6, 34, 12);
  if (isCassidy) {
    ctx.fillRect(x + 14, headY + 2, 10, 18);
  }
  ctx.fillStyle = skinColor;
  ctx.fillRect(x - 18, headY, 36, 30);
  ctx.fillStyle = "#ffd1a8";
  ctx.fillRect(x - 18, headY + 17, 36, 13);
  ctx.fillStyle = shirtColor;
  ctx.fillRect(x - 15, y - 9, 30, 26);
  ctx.fillStyle = isCassidy ? "#6ee7f2" : "#fff8e8";
  ctx.fillRect(x - 9, y - 3, 18, 8);
  if (isCassidy) {
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(x - 8, y + 2, 16, 16);
    ctx.fillStyle = "#ffcc7a";
    ctx.fillRect(x - 5, y + 8, 10, 4);
  }
  ctx.fillStyle = "#2b1d26";
  if (direction === "up") {
    ctx.fillRect(x - 10, headY + 5, 20, 4);
  } else if (direction === "left") {
    ctx.fillRect(x - 10, headY + 11, 4, 4);
    ctx.fillRect(x - 9, headY + 22, 10, 3);
  } else if (direction === "right") {
    ctx.fillRect(x + 6, headY + 11, 4, 4);
    ctx.fillRect(x - 1, headY + 22, 10, 3);
  } else {
    ctx.fillRect(x - 10, headY + 11, 5, 5);
    ctx.fillRect(x + 5, headY + 11, 5, 5);
    ctx.fillRect(x - 8, headY + 22, 16, 3);
  }
  ctx.fillStyle = skinColor;
  ctx.fillRect(x - 23, y - 7 + armSwing, 8, 22);
  ctx.fillRect(x + 15, y - 7 - armSwing, 8, 22);
  ctx.fillStyle = "#354b8c";
  ctx.fillRect(x - 13, y + 17, 10, 20 + legSwing);
  ctx.fillRect(x + 3, y + 17, 10, 20 - legSwing);
  ctx.fillStyle = "#2b1d26";
  ctx.fillRect(x - 15, y + 37 + legSwing, 14, 5);
  ctx.fillRect(x + 1, y + 37 - legSwing, 14, 5);
}

function drawSign() {
  ctx.fillStyle = "#6f3d35";
  ctx.fillRect(84, 300, 14, 72);
  ctx.fillStyle = "#ffd765";
  ctx.fillRect(34, 266, 114, 48);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 4;
  ctx.strokeRect(34, 266, 114, 48);
  ctx.fillStyle = "#2b1d26";
  ctx.font = "bold 15px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("BIG SALE", 91, 286);
  ctx.fillText("TODAY!", 91, 304);
}

function drawBlockCloud(x, y) {
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(x, y + 10, 64, 18);
  ctx.fillRect(x + 14, y, 28, 18);
  ctx.fillRect(x + 42, y + 6, 28, 18);
  ctx.fillStyle = "#dff5ff";
  ctx.fillRect(x + 8, y + 24, 52, 6);
}

function drawTree(x, y, timestamp) {
  const sway = Math.round(Math.sin(timestamp / 450) * 2);

  ctx.fillStyle = "#7a4a2a";
  ctx.fillRect(x - 10, y + 28, 20, 78);
  ctx.fillStyle = "#3d8f3c";
  ctx.fillRect(x - 38 + sway, y, 76, 42);
  ctx.fillRect(x - 28 - sway, y - 24, 56, 42);
  ctx.fillStyle = "#65b947";
  ctx.fillRect(x - 20 + sway, y - 12, 26, 18);
  ctx.fillStyle = "#ff6b6b";
  ctx.fillRect(x - 22, y + 10, 7, 7);
  ctx.fillRect(x + 18, y - 4, 7, 7);
}

function drawFlowerPatch(x, y) {
  const colors = ["#ff8cc6", "#ffd765", "#7bdff2", "#b56cff"];

  colors.forEach((color, index) => {
    const flowerX = x + index * 14;
    ctx.fillStyle = "#2d8a3f";
    ctx.fillRect(flowerX + 3, y + 8, 4, 12);
    ctx.fillStyle = color;
    ctx.fillRect(flowerX, y + 4, 10, 8);
    ctx.fillRect(flowerX + 3, y, 4, 16);
  });
}

function drawBlockySteppingStones() {
  const stones = [
    [102, 344],
    [138, 326],
    [178, 316],
    [224, 314],
    [268, 326],
    [314, 342]
  ];

  stones.forEach(([x, y], index) => {
    ctx.fillStyle = index % 2 === 0 ? "#cfd2d6" : "#bfc4c9";
    ctx.fillRect(x, y, 28, 18);
    ctx.strokeStyle = "#2b1d26";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 28, 18);
  });
}

function drawSparkle(x, y) {
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(x - 2, y - 8, 4, 16);
  ctx.fillRect(x - 8, y - 2, 16, 4);
  ctx.fillStyle = "#ffd765";
  ctx.fillRect(x - 3, y - 3, 6, 6);
}

function pixelTriangle(x1, y1, x2, y2, x3, y3) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function moveToward(sprite, targetX, targetY, delta) {
  const dx = targetX - sprite.x;
  const dy = targetY - sprite.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const step = (sprite.speed * delta) / 1000;

  sprite.x += (dx / length) * step;
  sprite.y += (dy / length) * step;
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function fillMessage(template, item, price) {
  return template
    .replace("{item}", item.name.toLowerCase())
    .replace("{price}", price);
}

function getViewLabel(item) {
  if (item.viewBonus > 1.2) {
    return "High";
  }

  if (item.viewBonus < 1) {
    return "Low";
  }

  return "Med";
}

function formatMoney(amount) {
  return `$${amount}`;
}

elements.actionButton.addEventListener("click", handlePrepAction);
elements.startButton.addEventListener("click", startSale);
elements.restartButton.addEventListener("click", resetGame);
elements.summaryRestartButton.addEventListener("click", resetGame);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    handlePrepAction();
    return;
  }

  const move = moveKeys[event.code];

  if (!move) {
    return;
  }

  event.preventDefault();
  activeMoves.add(move);
});

window.addEventListener("keyup", (event) => {
  const move = moveKeys[event.code];

  if (move) {
    activeMoves.delete(move);
  }
});

elements.moveButtons.forEach((button) => {
  const move = button.dataset.move;
  const startMove = (event) => {
    event.preventDefault();
    activeMoves.add(move);
  };
  const stopMove = (event) => {
    event.preventDefault();
    activeMoves.delete(move);
  };

  button.addEventListener("pointerdown", startMove);
  button.addEventListener("pointerup", stopMove);
  button.addEventListener("pointercancel", stopMove);
  button.addEventListener("pointerleave", stopMove);
});

resetGame();
requestAnimationFrame(updateGame);
