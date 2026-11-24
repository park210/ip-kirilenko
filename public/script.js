const cart = new Map();

const cartCount = document.getElementById("cart-count");
const cartOverlay = document.getElementById("cart-overlay");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const copyStatus = document.getElementById("copy-status");
const orderForm = document.getElementById("order-form");
const submitOrderButton = document.getElementById("submit-order");

function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

function updateCart() {
  let count = 0;
  let total = 0;
  cartItems.innerHTML = "";

  if (cart.size === 0) {
    cartItems.innerHTML = '<p class="cart-empty">Пока ничего не добавлено.</p>';
  }

  cart.forEach((item, name) => {
    count += item.quantity;
    total += item.price * item.quantity;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div><strong></strong><small></small></div>
      <div class="quantity">
        <button type="button" data-action="minus" aria-label="Уменьшить">−</button>
        <span>${item.quantity}</span>
        <button type="button" data-action="plus" aria-label="Увеличить">+</button>
      </div>`;
    row.querySelector("strong").textContent = name;
    row.querySelector("small").textContent = `${formatPrice(item.price)} / м³`;
    row.querySelector('[data-action="minus"]').addEventListener("click", () => changeQuantity(name, -1));
    row.querySelector('[data-action="plus"]').addEventListener("click", () => changeQuantity(name, 1));
    cartItems.appendChild(row);
  });

  cartCount.textContent = count;
  cartTotal.textContent = formatPrice(total);
  submitOrderButton.disabled = cart.size === 0;
}

function changeQuantity(name, amount) {
  const item = cart.get(name);
  if (!item) return;
  item.quantity += amount;
  if (item.quantity <= 0) cart.delete(name);
  updateCart();
}

document.querySelectorAll(".add-button").forEach(button => {
  button.addEventListener("click", () => {
    const name = button.dataset.product;
    const price = Number(button.dataset.price);
    const existing = cart.get(name);
    if (existing) existing.quantity += 1;
    else cart.set(name, { price, quantity: 1 });
    updateCart();
    button.classList.add("added");
    button.innerHTML = 'Добавлено <span>✓</span>';
    setTimeout(() => {
      button.innerHTML = 'Добавить в заявку <span>+</span>';
      button.classList.remove("added");
    }, 900);
  });
});

document.getElementById("cart-open").addEventListener("click", () => {
  cartOverlay.hidden = false;
  copyStatus.textContent = "";
});
document.getElementById("cart-close").addEventListener("click", () => cartOverlay.hidden = true);
cartOverlay.addEventListener("click", event => {
  if (event.target === cartOverlay) cartOverlay.hidden = true;
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") cartOverlay.hidden = true;
});

orderForm.addEventListener("submit", async event => {
  event.preventDefault();
  copyStatus.textContent = "";

  if (cart.size === 0) {
    copyStatus.textContent = "Сначала добавьте материалы в заявку.";
    return;
  }

  const formData = new FormData(orderForm);
  const payload = {
    customer: {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      comment: String(formData.get("comment") || "").trim()
    },
    items: [...cart.entries()].map(([name, item]) => ({
      name,
      quantity: item.quantity
    }))
  };

  submitOrderButton.disabled = true;
  submitOrderButton.textContent = "Отправляем…";

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Не удалось отправить заявку. Попробуйте позже.");
    }

    copyStatus.textContent = "Заявка отправлена! Менеджер свяжется с вами.";
    cart.clear();
    updateCart();
    orderForm.reset();
  } catch (error) {
    copyStatus.textContent = error.message || "Ошибка отправки. Позвоните нам, пожалуйста.";
  } finally {
    submitOrderButton.textContent = "Отправить заявку в Telegram";
    submitOrderButton.disabled = cart.size === 0;
  }
});

const search = document.getElementById("catalog-search");
const productCards = [...document.querySelectorAll(".product-card")];
const countLabel = document.getElementById("catalog-count");
const noResults = document.getElementById("no-results");
const filterButtons = [...document.querySelectorAll(".filter-chip")];
let activeFilter = "all";

function updateCatalog() {
  const query = search.value.trim().toLocaleLowerCase("ru");
  let visible = 0;

  productCards.forEach(card => {
    const matchesSearch = card.dataset.name.toLocaleLowerCase("ru").includes(query);
    const matchesFilter = activeFilter === "all" || card.dataset.category === activeFilter;
    const isVisible = matchesSearch && matchesFilter;
    card.hidden = !isVisible;
    if (isVisible) visible++;
  });

  const word = visible === 1 ? "материал" : visible < 5 ? "материала" : "материалов";
  countLabel.textContent = `${visible} ${word}`;
  noResults.hidden = visible !== 0;
}

search.addEventListener("input", updateCatalog);
filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach(item => item.classList.toggle("active", item === button));
    updateCatalog();
  });
});

const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
menuToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.textContent = isOpen ? "×" : "☰";
});
nav.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.textContent = "☰";
  });
});

updateCart();
