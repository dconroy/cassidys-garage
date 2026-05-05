const SALE_DURATION_SECONDS = 60;
const CUSTOMER_MIN_DELAY = 2000;
const CUSTOMER_MAX_DELAY = 4000;
const CASSIDY_SPEED = 125;
const PLAY_AREA = {
  minX: 36,
  maxX: 604,
  minY: 126,
  maxY: 334
};

// Edit this list to change the sale items, starting stock, fair prices, and canvas positions.
const itemTemplates = [
  { id: "guitar", name: "Guitar", icon: "🎸", quantity: 3, suggestedPrice: 25, x: 236, y: 270, slotLabel: "Front Spot", viewBonus: 1.35 },
  { id: "computer", name: "Computer", icon: "💻", quantity: 2, suggestedPrice: 75, x: 292, y: 270, slotLabel: "Front Spot", viewBonus: 1.35 },
  { id: "clothes", name: "Old Clothes", icon: "👕", quantity: 8, suggestedPrice: 8, x: 348, y: 270, slotLabel: "Middle Spot", viewBonus: 1.1 },
  { id: "toys", name: "Toys", icon: "🧸", quantity: 6, suggestedPrice: 12, x: 404, y: 270, slotLabel: "Middle Spot", viewBonus: 1.1 },
  { id: "books", name: "Books", icon: "📚", quantity: 10, suggestedPrice: 5, x: 460, y: 270, slotLabel: "Side Spot", viewBonus: 0.85 }
];

const clutterSpotTemplates = [
  { itemId: "toys", x: 112, y: 176, label: "toy bin" },
  { itemId: "books", x: 520, y: 190, label: "book box" },
  { itemId: "clothes", x: 118, y: 314, label: "laundry basket" },
  { itemId: "guitar", x: 520, y: 124, label: "attic guitar" },
  { itemId: "computer", x: 520, y: 272, label: "garage computer" }
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
        <span class="item-meta">Fair: $${item.suggestedPrice} | Views: ${getViewLabel(item)} | Left: <span id="${item.id}-inventory">${item.inventory}</span> | Sold: <span id="${item.id}-sold">${item.sold}</span> | <span id="${item.id}-status" class="${statusClass}">${statusText}</span></span>
      </div>
      <div class="price-row">
        <span>Price tag</span>
        <div class="price-controls">
          <button class="price-button" data-action="decrease" data-id="${item.id}" aria-label="Lower ${item.name} price">-</button>
          <span class="current-price" id="${item.id}-price">$${item.price}</span>
          <button class="price-button" data-action="increase" data-id="${item.id}" aria-label="Raise ${item.name} price">+</button>
        </div>
      </div>
    `;
    elements.itemsPanel.appendChild(card);
  });

  elements.itemsPanel.querySelectorAll(".price-button").forEach((button) => {
    button.addEventListener("click", handlePriceClick);
  });

  setPriceButtonsEnabled(gameState === "setup");
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

function setPriceButtonsEnabled(enabled) {
  elements.itemsPanel.querySelectorAll(".price-button").forEach((button) => {
    const item = items.find((candidate) => candidate.id === button.dataset.id);
    button.disabled = !enabled || !item.ready;
  });
}

function startSale() {
  if (!allItemsReady()) {
    addLog("Find and tag every clutter pile before opening the sale.");
    updatePrepControls();
    return;
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
    elements.goalDetails.textContent = "Adjust prices on the right, then press Start Garage Sale.";
    elements.statusText.textContent = "Everything is tagged and downstairs. Set prices, then start the sale!";
  } else if (nearbySpot) {
    elements.actionButton.textContent = `Tag ${getClutterTemplateItem(nearbySpot).name}`;
    elements.goalTitle.textContent = `Tag the ${nearbySpot.label}`;
    elements.goalDetails.textContent = "Press Space or the green button.";
    elements.statusText.textContent = `You're close! Tag the ${nearbySpot.label}.`;
  } else if (activeSpot) {
    elements.actionButton.textContent = `Follow Arrow to ${getClutterTemplateItem(activeSpot).name}`;
    elements.goalTitle.textContent = `Go to the ${activeSpot.label}`;
    elements.goalDetails.textContent = `Follow the big arrow. Treasures tagged: ${readyCount}/${items.length}.`;
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
    addLog(`Follow the yellow arrow to the ${activeSpot.label}, then tag it.`);
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
  addLog(`Cassidy found the ${spot.label}, added cute price tags, and carried it downstairs.`);
  updatePrepControls();

  if (allItemsReady()) {
    addLog("All treasures are on the table! Pick prices and open the garage sale.");
  }
}

function getNearbyClutterSpot() {
  const activeSpot = getActiveClutterSpot();

  if (!activeSpot || distance(cassidy.x, cassidy.y, activeSpot.x, activeSpot.y) >= 58) {
    return null;
  }

  return activeSpot;
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

  const length = Math.hypot(dx, dy) || 1;
  const step = (CASSIDY_SPEED * delta) / 1000;
  cassidy.x = clamp(cassidy.x + (dx / length) * step, PLAY_AREA.minX, PLAY_AREA.maxX);
  cassidy.y = clamp(cassidy.y + (dy / length) * step, PLAY_AREA.minY, PLAY_AREA.maxY);
  cassidy.walkTime += delta;
  cassidy.direction = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? "right" : "left")
    : (dy > 0 ? "down" : "up");

  if (gameState === "running") {
    cheerNearbyCustomer(timestamp);
  } else if (gameState === "setup") {
    updatePrepControls();
  }
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
  const y = randomBetween(94, 350);
  const target = { x: randomBetween(278, 380), y: randomBetween(182, 246) };

  customers.push({
    x: -24,
    y,
    targetX: target.x,
    targetY: target.y,
    exitX: canvas.width + 30,
    exitY: randomBetween(80, 350),
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
  drawSkyBits(timestamp);
  drawGrass();
  drawHouseAndGarage();
  drawYardDetails(timestamp);
  drawSaleTable();
  drawItems();
  drawClutterSpots(timestamp);
  drawTargetArrow();
  drawCharacters(timestamp);
  drawSign();
}

function drawCharacters(timestamp) {
  const sprites = [
    { y: cassidy.y, draw: () => drawCassidy(timestamp) },
    ...customers.map((customer) => ({
      y: customer.y,
      draw: () => drawCustomer(customer, timestamp)
    }))
  ];

  sprites.sort((a, b) => a.y - b.y).forEach((sprite) => sprite.draw());
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
  ctx.fillRect(0, 344, canvas.width, 54);
  ctx.fillStyle = "#bf9d5a";
  ctx.fillRect(0, 366, canvas.width, 6);

  ctx.fillStyle = "#c8aa66";
  for (let x = 10; x < canvas.width; x += 44) {
    ctx.fillRect(x, 356, 18, 4);
  }
}

function drawHouseAndGarage() {
  ctx.fillStyle = "#8b613d";
  for (let x = 0; x < canvas.width; x += 54) {
    ctx.fillRect(x, 78, 24, 46);
  }
  ctx.fillRect(0, 92, canvas.width, 7);

  ctx.fillStyle = "#d9a06d";
  ctx.fillRect(382, 104, 230, 86);
  ctx.fillStyle = "#ffcc7a";
  ctx.fillRect(410, 52, 178, 122);
  ctx.fillStyle = "#c45b52";
  pixelTriangle(390, 56, 608, 56, 500, 0);
  ctx.fillStyle = "#6f4d3c";
  ctx.fillRect(436, 108, 60, 66);
  ctx.fillStyle = "#4f8cff";
  ctx.fillRect(508, 92, 42, 34);
  ctx.fillStyle = "#d8f7ff";
  ctx.fillRect(516, 100, 26, 18);
  ctx.fillStyle = "#f7e6a0";
  ctx.fillRect(512, 146, 72, 44);
  ctx.fillStyle = "#f1d679";
  ctx.fillRect(520, 156, 56, 7);
  ctx.fillRect(520, 174, 56, 7);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 5;
  ctx.strokeRect(410, 52, 178, 122);
  ctx.strokeRect(436, 108, 60, 66);
  ctx.strokeRect(508, 92, 42, 34);
  ctx.strokeRect(512, 146, 72, 44);
  ctx.fillStyle = "#2b1d26";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("HOUSE", 498, 76);
  ctx.fillText("GARAGE", 548, 170);
}

function drawYardDetails(timestamp) {
  drawTree(64, 142, timestamp);
  drawFlowerPatch(544, 310);
}

function drawSaleTable() {
  ctx.fillStyle = "#f2d49b";
  ctx.fillRect(188, 218, 330, 92);
  ctx.fillStyle = "#e1bd82";
  ctx.fillRect(204, 232, 298, 14);

  ctx.fillStyle = "#a65335";
  ctx.fillRect(226, 252, 250, 22);
  ctx.fillStyle = "#f2a65e";
  ctx.fillRect(208, 226, 286, 32);
  ctx.fillStyle = "#fff3d6";
  ctx.fillRect(220, 234, 262, 8);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 4;
  ctx.strokeRect(208, 226, 286, 32);
  ctx.fillStyle = "#6f3d35";
  ctx.fillRect(238, 274, 18, 36);
  ctx.fillRect(452, 274, 18, 36);

  drawDisplaySlots();

  ctx.fillStyle = "#7bdff2";
  ctx.fillRect(486, 264, 24, 28);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(492, 270, 12, 16);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 3;
  ctx.strokeRect(486, 264, 24, 28);

  if (!items.some((item) => item.ready)) {
    ctx.fillStyle = "#2b1d26";
    ctx.font = "bold 18px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("Find treasures first!", 352, 294);
  }
}

function drawDisplaySlots() {
  itemTemplates.forEach((item) => {
    const isHighView = item.viewBonus > 1.2;
    const isLowView = item.viewBonus < 1;

    ctx.fillStyle = isHighView ? "#ffd765" : isLowView ? "#d8f7ff" : "#fff8e8";
    ctx.fillRect(item.x - 24, item.y - 24, 48, 48);
    ctx.strokeStyle = isHighView ? "#ff8cc6" : "#2b1d26";
    ctx.lineWidth = isHighView ? 4 : 2;
    ctx.strokeRect(item.x - 24, item.y - 24, 48, 48);
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

  if (!spot) {
    return;
  }

  const item = getClutterTemplateItem(spot);
  const pulse = Math.sin(timestamp / 150) * 4;
  const isNearby = distance(cassidy.x, cassidy.y, spot.x, spot.y) < 58;
  const boxSize = isNearby ? 64 : 56;

  ctx.fillStyle = isNearby ? "#fff3a3" : "#f7e6a0";
  ctx.fillRect(spot.x - boxSize / 2, spot.y - boxSize / 2, boxSize, boxSize);
  ctx.strokeStyle = isNearby ? "#ff8cc6" : "#ffd765";
  ctx.lineWidth = isNearby ? 6 : 5;
  ctx.strokeRect(spot.x - boxSize / 2, spot.y - boxSize / 2, boxSize, boxSize);

  ctx.fillStyle = "#6f3d35";
  ctx.fillRect(spot.x - 20, spot.y - 13, 40, 28);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "26px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(item.icon, spot.x, spot.y + 1);

  drawSparkle(spot.x - 36, spot.y - 36 + pulse);
  drawSparkle(spot.x + 38, spot.y - 34 - pulse);
  drawSparkle(spot.x, spot.y - 47 + pulse);

  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(spot.x - 74, spot.y + 42, 148, 28);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 3;
  ctx.strokeRect(spot.x - 74, spot.y + 42, 148, 28);
  ctx.fillStyle = "#2b1d26";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.fillText(isNearby ? "Press Space!" : `Find: ${item.name}`, spot.x, spot.y + 60);
}

function drawTargetArrow() {
  if (gameState !== "setup") {
    return;
  }

  const spot = getActiveClutterSpot();

  if (!spot || distance(cassidy.x, cassidy.y, spot.x, spot.y) < 58) {
    return;
  }

  const angle = Math.atan2(spot.y - cassidy.y, spot.x - cassidy.x);
  const arrowX = cassidy.x + Math.cos(angle) * 48;
  const arrowY = cassidy.y + Math.sin(angle) * 48 - 34;

  ctx.save();
  ctx.translate(arrowX, arrowY);
  ctx.rotate(angle);
  ctx.fillStyle = "#ffd765";
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -14);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, 14);
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

    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(item.x - 28, item.y - 26, 56, 52);
    ctx.strokeStyle = "#2b1d26";
    ctx.lineWidth = 3;
    ctx.strokeRect(item.x - 28, item.y - 26, 56, 52);
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

  drawPixelPerson(x, y, "#ff8cc6", "#5b332d", "#ffd1a8", walkPhase, true, cassidy.direction);

  if (cassidy.cheerUntil > timestamp) {
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(x - 38, y - 82, 76, 24);
    ctx.strokeStyle = "#2b1d26";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 38, y - 82, 76, 24);
    ctx.fillStyle = "#2b1d26";
    ctx.font = "bold 12px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("Got it!", x, y - 66);
  }
}

function drawCustomer(customer, timestamp) {
  const walkPhase = customer.state === "thinking"
    ? 0
    : Math.sin(timestamp / 95 + customer.stepOffset);
  const bob = customer.state === "thinking" ? 0 : Math.abs(walkPhase) * 2;

  drawPixelPerson(customer.x, customer.y - bob, customer.color, customer.hairColor, "#ffd6b6", walkPhase, false, "right");

  if (customer.message) {
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(customer.x - 34, customer.y - 58, 68, 22);
    ctx.strokeStyle = "#2b1d26";
    ctx.lineWidth = 2;
    ctx.strokeRect(customer.x - 34, customer.y - 58, 68, 22);
    ctx.fillStyle = "#2b1d26";
    ctx.font = "bold 11px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(customer.message, customer.x, customer.y - 44);
  }
}

function drawPixelPerson(x, y, shirtColor, hairColor, skinColor, walkPhase = 0, isCassidy = false, direction = "down") {
  const armSwing = Math.round(walkPhase * 4);
  const legSwing = Math.round(walkPhase * 5);

  ctx.fillStyle = "#2b1d26";
  ctx.fillRect(x - 16, y + 43, 32, 5);
  ctx.fillStyle = hairColor;
  ctx.fillRect(x - 12, y - 34, 24, 12);
  if (isCassidy) {
    ctx.fillRect(x + 10, y - 28, 10, 18);
  }
  ctx.fillStyle = skinColor;
  ctx.fillRect(x - 10, y - 26, 20, 18);
  ctx.fillStyle = shirtColor;
  ctx.fillRect(x - 14, y - 8, 28, 28);
  ctx.fillStyle = isCassidy ? "#6ee7f2" : "#fff8e8";
  ctx.fillRect(x - 8, y - 2, 16, 8);
  if (isCassidy) {
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(x - 8, y + 2, 16, 18);
    ctx.fillStyle = "#ffcc7a";
    ctx.fillRect(x - 5, y + 8, 10, 4);
  }
  ctx.fillStyle = "#2b1d26";
  if (direction === "up") {
    ctx.fillRect(x - 8, y - 28, 16, 4);
  } else if (direction === "left") {
    ctx.fillRect(x - 9, y - 23, 4, 4);
    ctx.fillRect(x - 8, y - 16, 8, 3);
  } else if (direction === "right") {
    ctx.fillRect(x + 5, y - 23, 4, 4);
    ctx.fillRect(x, y - 16, 8, 3);
  } else {
    ctx.fillRect(x - 8, y - 23, 4, 4);
    ctx.fillRect(x + 4, y - 23, 4, 4);
    ctx.fillRect(x - 4, y - 16, 8, 3);
  }
  ctx.fillStyle = skinColor;
  ctx.fillRect(x - 20, y - 4 + armSwing, 8, 22);
  ctx.fillRect(x + 12, y - 4 - armSwing, 8, 22);
  ctx.fillStyle = "#354b8c";
  ctx.fillRect(x - 13, y + 20, 10, 20 + legSwing);
  ctx.fillRect(x + 3, y + 20, 10, 20 - legSwing);
  ctx.fillStyle = "#2b1d26";
  ctx.fillRect(x - 15, y + 40 + legSwing, 14, 5);
  ctx.fillRect(x + 1, y + 40 - legSwing, 14, 5);
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
