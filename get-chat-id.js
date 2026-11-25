require("dotenv").config();

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("Сначала укажите BOT_TOKEN в файле .env");
  process.exit(1);
}

(async () => {
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timeout: 0, allowed_updates: ["message"] })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || "Не удалось получить обновления Telegram");
  }

  const chats = new Map();
  for (const update of data.result || []) {
    const message = update.message;
    if (!message || !message.chat) continue;
    const chat = message.chat;
    chats.set(String(chat.id), {
      id: String(chat.id),
      type: chat.type,
      first_name: chat.first_name || "",
      username: chat.username || ""
    });
  }

  if (!chats.size) {
    console.log("Пока нет сообщений боту. Попросите получателя открыть бота в Telegram и нажать Start, затем повторите команду.");
    return;
  }

  console.log("Найденные чаты. Выберите личный чат человека, который должен получать заявки:");
  for (const chat of chats.values()) {
    console.log(`Chat ID: ${chat.id} | Тип: ${chat.type} | Имя: ${chat.first_name} | Username: ${chat.username ? "@" + chat.username : "не указан"}`);
  }
  console.log("Скопируйте нужный Chat ID в переменную ADMIN_CHAT_ID в настройках хостинга.");
})().catch(error => {
  console.error(error.message);
  process.exit(1);
});
