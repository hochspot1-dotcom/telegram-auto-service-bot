// ==========================================
// НАСТРОЙКА АДРЕСА БЭКЕНДА (Bot API URL)
// ==========================================
// Если Mini App размещен на отдельном хостинге (например GitHub Pages, Vercel, Netlify):
// Укажите здесь HTTPS-адрес хостинга вашего бота (куда вы задеплоили main.py/web_server.py)!
// Пример: const CONFIG_BACKEND_URL = "https://my-bot-backend.onrender.com";
// Также можно передавать параметр в URL кнопки WebApp: https://your-miniapp.vercel.app?backend=https://my-bot-backend.onrender.com
const CONFIG_BACKEND_URL = "https://carservicegorlovka.de1.netrun.io";

function getBackendUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramUrl = urlParams.get("backend");
  if (paramUrl) return paramUrl.replace(/\/$/, "");

  if (CONFIG_BACKEND_URL && CONFIG_BACKEND_URL.trim() !== "") {
    return CONFIG_BACKEND_URL.trim().replace(/\/$/, "");
  }

  // Если открыто как локальный файл или через браузер без указывания порт/домена
  if (window.location.protocol === "file:" || window.location.hostname === "") {
    return "";
  }

  return window.location.origin;
}

const BACKEND_URL = getBackendUrl();

document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram?.WebApp;
  
  if (tg) {
    tg.ready();
    tg.expand();
  }

  // Current user info (from Telegram or test fallback)
  const tgUser = tg?.initDataUnsafe?.user || {
    id: 123456789,
    first_name: "Посетитель",
    username: "guest"
  };

  const userId = tgUser.id;
  const userName = tgUser.first_name + (tgUser.last_name ? " " + tgUser.last_name : "");

  // Update greeting
  const greetingEl = document.getElementById("user-greeting");
  if (greetingEl) {
    greetingEl.textContent = `Привет, ${userName}!`;
  }
  const profileNameEl = document.getElementById("profile-name");
  if (profileNameEl) {
    profileNameEl.textContent = userName;
  }

  let isAdmin = false;
  let currentAdminFilter = "all";
  let pendingAdminAction = null;

  async function checkAdminStatus() {
    if (!BACKEND_URL) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/check?user_id=${userId}`);
      const data = await res.json();
      if (data.is_admin) {
        isAdmin = true;
        const adminBtn = document.getElementById("admin-tab-btn");
        if (adminBtn) adminBtn.classList.remove("hidden");
      }
    } catch (e) {
      console.error("Admin check error:", e);
    }
  }
  checkAdminStatus();

  // Tab switching
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  function switchTab(tabName) {
    tabBtns.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    tabContents.forEach(content => {
      content.classList.toggle("active", content.id === `tab-${tabName}`);
    });

    if (tabName === "profile") {
      loadUserProfile();
    } else if (tabName === "booking") {
      loadSlots();
    } else if (tabName === "admin" && isAdmin) {
      loadAdminBookings(currentAdminFilter);
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });


  // Services list rendering
  const defaultServices = [
    { icon: "⚡", title: "Компьютерная диагностика", price: "от 1 000 ₽", cat: "cat_electric" },
    { icon: "🛢", title: "Замена масла и фильтров", price: "от 1 500 ₽", cat: "cat_to" },
    { icon: "🛞", title: "Ремонт тормозной системы", price: "от 2 000 ₽", cat: "cat_chassis" },
    { icon: "🔧", title: "Обслуживание подвески", price: "от 2 500 ₽", cat: "cat_chassis" },
    { icon: "❄️", title: "Заправка кондиционера", price: "от 2 000 ₽", cat: "cat_climate" },
    { icon: "🚗", title: "Шиномонтаж (комплект)", price: "от 2 000 ₽", cat: "cat_chassis" }
  ];

  function renderServices() {
    const container = document.getElementById("services-list");
    if (!container) return;

    container.innerHTML = defaultServices.map(s => `
      <div class="service-card glass-card">
        <div class="service-info">
          <span class="service-icon">${s.icon}</span>
          <div>
            <div class="service-title">${s.title}</div>
            <div class="service-price">${s.price}</div>
          </div>
        </div>
        <button class="service-action-btn" data-cat="${s.cat}" data-title="${s.title}">Записаться</button>
      </div>
    `).join("");

    container.querySelectorAll(".service-action-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const cat = e.target.dataset.cat;
        selectCategoryPill(cat);
        switchTab("booking");
      });
    });
  }

  renderServices();

  // Category Pills in Booking Form
  const categoryPills = document.querySelectorAll("#category-pills .pill");
  const customProblemGroup = document.getElementById("custom-problem-group");
  let selectedCategory = "cat_engine";

  function selectCategoryPill(value) {
    selectedCategory = value;
    categoryPills.forEach(p => {
      p.classList.toggle("active", p.dataset.value === value);
    });

    if (value === "cat_custom") {
      customProblemGroup.classList.remove("hidden");
    } else {
      customProblemGroup.classList.add("hidden");
    }
  }

  categoryPills.forEach(pill => {
    pill.addEventListener("click", () => {
      selectCategoryPill(pill.dataset.value);
    });
  });

  // Time Slots Loading
  let selectedSlot = "";

  async function loadSlots() {
    const slotsContainer = document.getElementById("slots-container");
    if (!slotsContainer) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/slots`);
      const data = await res.json();
      renderSlots(data.slots);
    } catch (e) {
      // Fallback local slot generation
      const fallbackSlots = generateFallbackSlots();
      renderSlots(fallbackSlots);
    }
  }

  function generateFallbackSlots() {
    const daysRu = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const slots = [];
    const today = new Date();
    for (let offset = 1; offset <= 3; offset++) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      const dateStr = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
      const dayName = daysRu[d.getDay() === 0 ? 6 : d.getDay() - 1];
      ["10:00", "14:00", "17:00"].forEach(t => {
        slots.push(`${dateStr} (${dayName}) в ${t}`);
      });
    }
    return slots;
  }

  function renderSlots(slots) {
    const slotsContainer = document.getElementById("slots-container");
    if (!slotsContainer) return;

    slotsContainer.innerHTML = slots.map((s, idx) => `
      <div class="slot-item ${idx === 0 ? 'active' : ''}" data-slot="${s}">
        📅 ${s}
      </div>
    `).join("");

    selectedSlot = slots[0] || "";

    slotsContainer.querySelectorAll(".slot-item").forEach(item => {
      item.addEventListener("click", () => {
        slotsContainer.querySelectorAll(".slot-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        selectedSlot = item.dataset.slot;
      });
    });
  }

  // User Profile loading
  async function loadUserProfile() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/info?user_id=${userId}`);
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();

      document.getElementById("stat-active").textContent = data.stats.active || 0;
      document.getElementById("stat-total").textContent = data.stats.total || 0;
      document.getElementById("stat-cancelled").textContent = data.stats.cancelled || 0;
      document.getElementById("profile-phone").textContent = `Телефон: ${data.stats.phone || 'Не указан'}`;

      renderUserBookings(data.bookings || []);
    } catch (e) {
      console.error(e);
    }
  }

  function renderUserBookings(bookings) {
    const container = document.getElementById("user-bookings-list");
    if (!container) return;

    if (!bookings || bookings.length === 0) {
      container.innerHTML = `<div class="info-card glass-card"><p style="text-align: center; color: var(--text-muted);">У вас пока нет оформленных записей.</p></div>`;
      return;
    }

    container.innerHTML = bookings.map(b => {
      let badgeClass = "badge-pending";
      let statusIcon = "⏳";
      if (b.status === "Одобрена" || b.status === "Активна") {
        badgeClass = "badge-approved";
        statusIcon = "✅";
      } else if (b.status.includes("Отменен") || b.status.includes("Отклонен")) {
        badgeClass = "badge-cancelled";
        statusIcon = "🔴";
      }

      const isCancelable = ["На рассмотрении", "Одобрена", "Активна"].includes(b.status);

      return `
        <div class="booking-card glass-card">
          <div class="booking-header">
            <span class="booking-id">Запись №${b.id}</span>
            <span class="badge ${badgeClass}">${statusIcon} ${b.status}</span>
          </div>
          <div class="booking-details">
            <p><strong>Услуга:</strong> ${b.problem}</p>
            <p><strong>Автомобиль:</strong> ${b.car_model}</p>
            <p><strong>Время:</strong> ${b.slot}</p>
            ${b.comment ? `<p><strong>Комментарий:</strong> <em>${b.comment}</em></p>` : ''}
          </div>
          ${isCancelable ? `<button class="cancel-btn" data-id="${b.id}">Отменить запись</button>` : ''}
        </div>
      `;
    }).join("");

    container.querySelectorAll(".cancel-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const bookingId = btn.dataset.id;
        if (confirm(`Отменить запись №${bookingId}?`)) {
          await cancelBooking(bookingId);
        }
      });
    });
  }

  async function cancelBooking(bookingId) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/booking/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: parseInt(bookingId), user_id: userId })
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ Запись успешно отменена");
        loadUserProfile();
      } else {
        showToast("⚠️ " + (data.error || "Не удалось отменить"));
      }
    } catch (e) {
      showToast("⚠️ Ошибка соединения");
    }
  }

  // Booking Form Submission
  const bookingForm = document.getElementById("booking-form");
  const submitBtn = document.getElementById("submit-booking-btn");

  bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    let problem = "";
    if (selectedCategory === "cat_custom") {
      problem = document.getElementById("custom-problem").value.trim();
    } else {
      const categoryLabels = {
        cat_engine: "🔧 Двигатель и выхлоп",
        cat_chassis: "🛞 Подвеска и тормоза",
        cat_electric: "⚡ Электрика и диагностика",
        cat_to: "🛢 Регулярное ТО",
        cat_climate: "❄️ Климат и кондиционер"
      };
      problem = categoryLabels[selectedCategory] || "Общий ремонт";
    }

    const carModel = document.getElementById("car-model").value.trim();
    const phone = document.getElementById("phone-number").value.trim();

    if (!problem) {
      showToast("⚠️ Опишите вашу проблему!");
      return;
    }
    if (!carModel) {
      showToast("⚠️ Укажите марку и модель авто!");
      return;
    }
    if (!phone) {
      showToast("⚠️ Укажите ваш телефон!");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳ Отправка...</span>`;

    try {
      if (!BACKEND_URL) {
        showToast("⚠️ Ошибка: не указан адрес бэкенда (CONFIG_BACKEND_URL в app.js)!");
        return;
      }

      const res = await fetch(`${BACKEND_URL}/api/booking/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          user_name: userName,
          problem: problem,
          car_model: carModel,
          slot: selectedSlot,
          phone: phone
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`🎉 Заявка №${data.booking_id} успешно создана!`);
        bookingForm.reset();
        selectCategoryPill("cat_engine");
        setTimeout(() => {
          switchTab("profile");
        }, 1200);
      } else {
        showToast("⚠️ " + (data.error || "Ошибка создания записи"));
      }
    } catch (err) {
      console.error("Ошибка при отправке формы:", err);
      showToast("⚠️ Бэкенд недоступен! Проверьте CONFIG_BACKEND_URL в app.js");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>🚀 Отправить заявку</span>`;
    }
  });

  // Toast Helper
  function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 3500);
  }

  // ==========================================
  // ADMIN / MODERATION PANEL LOGIC
  // ==========================================
  const adminPills = document.querySelectorAll("#admin-status-pills .pill");
  adminPills.forEach(pill => {
    pill.addEventListener("click", () => {
      adminPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentAdminFilter = pill.dataset.status;
      loadAdminBookings(currentAdminFilter);
    });
  });

  async function loadAdminBookings(statusFilter = "all") {
    const container = document.getElementById("admin-bookings-list");
    if (!container) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/bookings?user_id=${userId}&status=${statusFilter}`);
      if (!res.ok) throw new Error("Access denied");
      const data = await res.json();

      document.getElementById("adm-stat-pending").textContent = data.stats.pending || 0;
      document.getElementById("adm-stat-approved").textContent = data.stats.approved || 0;
      document.getElementById("adm-stat-rejected").textContent = data.stats.rejected || 0;

      renderAdminBookings(data.bookings || []);
    } catch (e) {
      container.innerHTML = `<div class="info-card glass-card"><p style="text-align: center; color: var(--text-muted);">Не удалось загрузить данные модерации</p></div>`;
    }
  }

  function renderAdminBookings(bookings) {
    const container = document.getElementById("admin-bookings-list");
    if (!container) return;

    if (!bookings || bookings.length === 0) {
      container.innerHTML = `<div class="info-card glass-card"><p style="text-align: center; color: var(--text-muted);">Заявок не найдено.</p></div>`;
      return;
    }

    container.innerHTML = bookings.map(b => {
      let badgeClass = "badge-pending";
      let statusIcon = "⏳";
      let cardClass = "pending";
      if (b.status === "Одобрена" || b.status === "Активна") {
        badgeClass = "badge-approved";
        statusIcon = "✅";
        cardClass = "approved";
      } else if (b.status.includes("Отменен") || b.status.includes("Отклонен")) {
        badgeClass = "badge-cancelled";
        statusIcon = "🔴";
        cardClass = "rejected";
      }

      return `
        <div class="booking-card glass-card admin-card ${cardClass}">
          <div class="booking-header">
            <span class="booking-id">Запись №${b.id}</span>
            <span class="badge ${badgeClass}">${statusIcon} ${b.status}</span>
          </div>
          <div class="admin-card-user">
            👤 <strong>${b.user_name}</strong> (ID: ${b.user_id}) | 📞 ${b.phone}
          </div>
          <div class="booking-details">
            <p><strong>Услуга:</strong> ${b.problem}</p>
            <p><strong>Автомобиль:</strong> ${b.car_model}</p>
            <p><strong>Время:</strong> ${b.slot}</p>
            ${b.comment ? `<p><strong>Прим. модератора:</strong> <em>${b.comment}</em></p>` : ''}
          </div>
          <div class="admin-actions-grid">
            <button class="admin-btn admin-btn-approve" data-id="${b.id}">✅ Одобрить</button>
            <button class="admin-btn admin-btn-reject" data-id="${b.id}">❌ Отклонить</button>
            <button class="admin-btn admin-btn-delete" data-id="${b.id}">🗑 Удалить заявку</button>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".admin-btn-approve").forEach(btn => {
      btn.addEventListener("click", () => openAdminModal(btn.dataset.id, "approve"));
    });
    container.querySelectorAll(".admin-btn-reject").forEach(btn => {
      btn.addEventListener("click", () => openAdminModal(btn.dataset.id, "reject"));
    });
    container.querySelectorAll(".admin-btn-delete").forEach(btn => {
      btn.addEventListener("click", () => confirmDeleteBooking(btn.dataset.id));
    });
  }

  // Admin Modal Handling
  const modal = document.getElementById("admin-modal");
  const modalComment = document.getElementById("modal-comment");
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");

  function openAdminModal(bookingId, action) {
    pendingAdminAction = { bookingId, action };
    const title = action === "approve" ? `Одобрить запись №${bookingId}` : `Отклонить запись №${bookingId}`;
    document.getElementById("modal-title").textContent = title;
    if (modalComment) modalComment.value = "";
    if (modal) modal.classList.remove("hidden");
  }

  if (modalCancelBtn) {
    modalCancelBtn.addEventListener("click", () => {
      if (modal) modal.classList.add("hidden");
      pendingAdminAction = null;
    });
  }

  if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener("click", async () => {
      if (!pendingAdminAction) return;
      const { bookingId, action } = pendingAdminAction;
      const comment = modalComment ? modalComment.value.trim() : "";
      if (modal) modal.classList.add("hidden");
      await executeAdminAction(bookingId, action, comment);
      pendingAdminAction = null;
    });
  }

  async function confirmDeleteBooking(bookingId) {
    if (confirm(`Вы действительно хотите НАВСЕГДА удалить запись №${bookingId}?`)) {
      await executeAdminAction(bookingId, "delete", "");
    }
  }

  async function executeAdminAction(bookingId, action, comment) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/booking/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_id: userId,
          booking_id: parseInt(bookingId),
          action: action,
          comment: comment
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`✅ Действие по записи №${bookingId} выполнено`);
        loadAdminBookings(currentAdminFilter);
      } else {
        showToast("⚠️ " + (data.error || "Ошибка выполнения"));
      }
    } catch (e) {
      showToast("⚠️ Ошибка соединения с сервером");
    }
  }

});
