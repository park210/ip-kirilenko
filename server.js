require("dotenv").config();

const express = require("express");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use("/api/", rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Слишком много запросов. Попробуйте через несколько минут." }
}));

const CATALOG = {
  "Песок — Вознесеновка": 2000,
  "Песок мытый": 4000,
  "Граншлак": 2000,
  "Щебень 5–20": 3000,
  "Щебень 20–40": 3000,
  "Щебень 40–70": 3000,
  "Щебень доломитовый 5–30": 2500,
  "Отсев гранитный": 1800,
  "Шлак 0–20": 1500
};

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const description = data.description || `Telegram API error (${response.status})`;
    throw new Error(description);
  }
  return data.result;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kirilenko-stroy-orders" });
});

app.post("/api/orders", async (req, res) => {
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    return res.status(503).json({ error: "Приём заявок ещё не настроен. Позвоните по указанному номеру." });
  }

  const customer = req.body && req.body.customer;
  const incomingItems = req.body && req.body.items;

  const name = cleanText(customer && customer.name, 60);
  const phone = cleanText(customer && customer.phone, 25);
  const address = cleanText(customer && customer.address, 180);
  const comment = cleanText(customer && customer.comment, 500);
  const normalizedPhone = phone.replace(/[^\d+]/g, "");

  if (name.length < 2 || !/^[\p{L}\p{M} .'-]+$/u.test(name)) {
    return res.status(400).json({ error: "Проверьте имя: укажите не менее двух букв." });
  }
  if (!/^\+?\d{10,15}$/.test(normalizedPhone)) {
    return res.status(400).json({ error: "Проверьте номер телефона." });
  }
  if (address.length < 5) {
    return res.status(400).json({ error: "Укажите адрес доставки." });
  }
  if (!Array.isArray(incomingItems) || incomingItems.length < 1 || incomingItems.length > 10) {
    return res.status(400).json({ error: "Добавьте материалы в заявку." });
  }

  const items = [];
  const seen = new Set();
  for (const raw of incomingItems) {
    const productName = cleanText(raw && raw.name, 100);
    const quantity = Number(raw && raw.quantity);
    if (!Object.prototype.hasOwnProperty.call(CATALOG, productName) ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 1000 ||
        seen.has(productName)) {
      return res.status(400).json({ error: "В заявке обнаружены некорректные позиции. Обновите страницу и попробуйте снова." });
    }
    seen.add(productName);
    items.push({ name: productName, quantity, price: CATALOG[productName] });
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderLines = items.map(item =>
    `• ${escapeHtml(item.name)} — ${item.quantity} м³ × ${item.price.toLocaleString("ru-RU")} ₽ = ${(item.price * item.quantity).toLocaleString("ru-RU")} ₽`
  );

  const message = [
    "🆕 <b>НОВАЯ ЗАЯВКА С САЙТА</b>",
    "",
    `<b>Клиент:</b> ${escapeHtml(name)}`,
    `<b>Телефон:</b> ${escapeHtml(phone)}`,
    `<b>Адрес доставки:</b> ${escapeHtml(address)}`,
    "",
    "<b>Материалы:</b>",
    ...orderLines,
    "",
    `<b>Предварительная сумма:</b> ${total.toLocaleString("ru-RU")} ₽`,
    "<i>Без учёта доставки. Стоимость и наличие необходимо подтвердить.</i>",
    comment ? `\n<b>Комментарий:</b> ${escapeHtml(comment)}` : ""
  ].filter(Boolean).join("\n");

  try {
    await telegram("sendMessage", {
      chat_id: ADMIN_CHAT_ID,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Telegram sendMessage failed:", error.message);
    return res.status(502).json({ error: "Не получилось передать заявку менеджеру. Позвоните по указанному номеру." });
  }
});

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"]
}));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Website and order API listening on port ${PORT}`);
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.warn("Set BOT_TOKEN and ADMIN_CHAT_ID to enable Telegram order delivery.");
  }
});
