const SALE_DURATION_SECONDS = 60;
const CUSTOMER_MIN_DELAY = 2000;
const CUSTOMER_MAX_DELAY = 4000;

// Edit this list to change the sale items, starting stock, fair prices, and canvas positions.
const itemTemplates = [
  { id: "guitar", name: "Guitar", icon: "🎸", quantity: 3, suggestedPrice: 25, x: 250, y: 214 },
  { id: "computer", name: "Computer", icon: "💻", quantity: 2, suggestedPrice: 75, x: 330, y: 214 },
  { id: "clothes", name: "Old Clothes", icon: "👕", quantity: 8, suggestedPrice: 8, x: 410, y: 214 },
  { id: "toys", name: "Toys", icon: "🧸", quantity: 6, suggestedPrice: 12, x: 290, y: 282 },
  { id: "books", name: "Books", icon: "📚", quantity: 10, suggestedPrice: 5, x: 380, y: 282 }
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
  itemsPanel: document.getElementById("itemsPanel"),
  eventLog: document.getElementById("eventLog"),
  startButton: document.getElementById("startButton"),
  restartButton: document.getElementById("restartButton"),
  summaryScreen: document.getElementById("summaryScreen"),
  summaryRestartButton: document.getElementById("summaryRestartButton"),
  ratingTitle: document.getElementById("ratingTitle"),
  finalMoney: document.getElementById("finalMoney"),
  finalSold: document.getElementById("finalSold"),
  finalHappy: document.getElementById("finalHappy"),
  finalWalkaways: document.getElementById("finalWalkaways"),
  strategyHint: document.getElementById("strategyHint")
};

const buyMessages = [
  "A customer grinned and bought the {item} for {price}.",
  "Cha-ching! The {item} found a new home for {price}.",
  "A neighbor said, \"Great deal!\" and picked up the {item}.",
  "Cassidy wrapped up the {item} with a proud little smile."
];

const tooExpensiveMessages = [
  "Someone checked the {item} tag, whistled, and kept browsing.",
  "A customer liked the {item}, but the price felt a bit steep.",
  "The {item} got a maybe-next-time shrug.",
  "A bargain hunter decided the {item} needed a smaller sticker."
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
  "The lemonade cup on the table looked very official."
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

function resetGame() {
  items = itemTemplates.map((item) => ({
    ...item,
    inventory: item.quantity,
    price: item.suggestedPrice,
    sold: 0
  }));

  customers = [];
  moneyEarned = 0;
  happyCustomers = 0;
  walkaways = 0;
  totalItemsSold = 0;
  gameState = "setup";
  startTime = 0;
  nextCustomerAt = 0;
  lastFrameTime = performance.now();

  elements.summaryScreen.classList.add("hidden");
  elements.restartButton.classList.add("hidden");
  elements.startButton.classList.remove("hidden");
  elements.startButton.disabled = false;
  elements.statusText.textContent = "Set your prices, then start the sale!";
  elements.strategyHint.textContent = "";
  elements.eventLog.innerHTML = "";

  renderItemsPanel();
  updateStats(SALE_DURATION_SECONDS);
  addLog("Cassidy put out colorful signs for the garage sale.");
}

function renderItemsPanel() {
  elements.itemsPanel.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-icon" aria-hidden="true">${item.icon}</div>
      <div>
        <div class="item-name">${item.name}</div>
        <span class="item-meta">Fair: $${item.suggestedPrice} | Left: <span id="${item.id}-inventory">${item.inventory}</span> | Sold: <span id="${item.id}-sold">${item.sold}</span></span>
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
    button.disabled = !enabled;
  });
}

function startSale() {
  gameState = "running";
  startTime = performance.now();
  nextCustomerAt = startTime + randomBetween(CUSTOMER_MIN_DELAY, CUSTOMER_MAX_DELAY);

  elements.startButton.disabled = true;
  setPriceButtonsEnabled(false);
  elements.statusText.textContent = "Customers are arriving. Good luck, Cassidy!";
  addLog("Cassidy flipped the sign to OPEN. The yard suddenly felt busy.");
}

function updateGame(timestamp) {
  const delta = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

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
  const item = items[Math.floor(Math.random() * items.length)];
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
  drawCassidy(timestamp);
  customers.forEach((customer) => drawCustomer(customer, timestamp));
  drawSign();
}

function drawSkyBits(timestamp) {
  ctx.fillStyle = "#9fe3ff";
  ctx.fillRect(0, 0, canvas.width, 86);

  const drift = (timestamp / 120) % 80;
  drawBlockCloud(72 + drift, 24);
  drawBlockCloud(300 - drift * 0.45, 42);

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
  for (let x = 0; x < canvas.width; x += 34) {
    ctx.fillRect(x, 78, 24, 46);
    ctx.fillRect(x - 5, 92, 34, 7);
  }

  ctx.fillStyle = "#ffcc7a";
  ctx.fillRect(430, 34, 150, 118);
  ctx.fillStyle = "#c45b52";
  pixelTriangle(414, 38, 596, 38, 505, -22);
  ctx.fillStyle = "#6f4d3c";
  ctx.fillRect(454, 88, 88, 64);
  ctx.fillStyle = "#4f8cff";
  ctx.fillRect(462, 96, 32, 24);
  ctx.fillRect(502, 96, 32, 24);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 5;
  ctx.strokeRect(430, 34, 150, 118);
  ctx.strokeRect(454, 88, 88, 64);
}

function drawYardDetails(timestamp) {
  drawTree(64, 142, timestamp);
  drawFlowerPatch(520, 238);
  drawFlowerPatch(570, 292);
  drawFlowerPatch(158, 324);

  ctx.fillStyle = "#f7e6a0";
  ctx.fillRect(490, 164, 84, 52);
  ctx.fillStyle = "#f1d679";
  ctx.fillRect(500, 174, 64, 8);
  ctx.fillRect(500, 194, 64, 8);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 3;
  ctx.strokeRect(490, 164, 84, 52);
}

function drawSaleTable() {
  ctx.fillStyle = "#f2d49b";
  ctx.fillRect(182, 142, 312, 142);
  ctx.fillStyle = "#e1bd82";
  ctx.fillRect(196, 154, 284, 16);

  ctx.fillStyle = "#a65335";
  ctx.fillRect(210, 178, 250, 24);
  ctx.fillStyle = "#f2a65e";
  ctx.fillRect(196, 154, 278, 32);
  ctx.fillStyle = "#fff3d6";
  ctx.fillRect(208, 162, 254, 8);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 4;
  ctx.strokeRect(196, 154, 278, 32);
  ctx.fillStyle = "#6f3d35";
  ctx.fillRect(224, 202, 18, 62);
  ctx.fillRect(430, 202, 18, 62);

  ctx.fillStyle = "#7bdff2";
  ctx.fillRect(472, 226, 28, 32);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(478, 232, 16, 18);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 3;
  ctx.strokeRect(472, 226, 28, 32);
}

function drawItems() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "28px Arial";

  items.forEach((item) => {
    ctx.fillStyle = item.inventory > 0 ? "#fff8e8" : "#c8bda8";
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
  const bob = Math.sin(timestamp / 220) * 2;
  const x = 152;
  const y = 230 + bob;

  drawPixelPerson(x, y, "#ff8cc6", "#5b332d", "#ffd1a8", 0, true);

  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(x - 48, y - 76, 96, 30);
  ctx.strokeStyle = "#2b1d26";
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 48, y - 76, 96, 30);
  ctx.fillStyle = "#2b1d26";
  ctx.font = "bold 13px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("Cassidy", x, y - 56);
}

function drawCustomer(customer, timestamp) {
  const walkPhase = customer.state === "thinking"
    ? 0
    : Math.sin(timestamp / 95 + customer.stepOffset);
  const bob = customer.state === "thinking" ? 0 : Math.abs(walkPhase) * 2;

  drawPixelPerson(customer.x, customer.y - bob, customer.color, customer.hairColor, "#ffd6b6", walkPhase, false);

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

function drawPixelPerson(x, y, shirtColor, hairColor, skinColor, walkPhase = 0, isCassidy = false) {
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
  if (isCassidy) {
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(x - 8, y + 2, 16, 18);
    ctx.fillStyle = "#ffcc7a";
    ctx.fillRect(x - 5, y + 8, 10, 4);
  }
  ctx.fillStyle = "#2b1d26";
  ctx.fillRect(x - 8, y - 23, 4, 4);
  ctx.fillRect(x + 4, y - 23, 4, 4);
  ctx.fillRect(x - 4, y - 16, 8, 3);
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

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function fillMessage(template, item, price) {
  return template
    .replace("{item}", item.name.toLowerCase())
    .replace("{price}", price);
}

function formatMoney(amount) {
  return `$${amount}`;
}

elements.startButton.addEventListener("click", startSale);
elements.restartButton.addEventListener("click", resetGame);
elements.summaryRestartButton.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(updateGame);
