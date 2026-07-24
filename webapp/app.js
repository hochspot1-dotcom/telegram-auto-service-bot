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

  // Auto-fill phone from Telegram on load
  const tgPhone = tg?.initDataUnsafe?.user?.phone_number || "";
  const phoneInputEl = document.getElementById("phone-number");
  if (tgPhone && phoneInputEl) {
    phoneInputEl.value = "+" + tgPhone.replace(/\D/g, "");
  }

  async function checkAdminStatus() {
    if (!BACKEND_URL) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/check?user_id=${userId}`);
      const data = await res.json();
      if (data.is_admin) {
        isAdmin = true;
        // Show admin button ONLY inside Profile tab
        const adminProfileBtn = document.getElementById("admin-profile-btn");
        if (adminProfileBtn) {
          adminProfileBtn.classList.remove("hidden");
          adminProfileBtn.addEventListener("click", () => {
            switchTab("admin");
          });
        }
      }
    } catch (e) {
      console.error("Admin check error:", e);
    }
  }
  checkAdminStatus();


  // Floating Navbar Tab switching
  const navItems = document.querySelectorAll(".nav-item");
  const tabContents = document.querySelectorAll(".tab-content");

  function switchTab(tabName) {
    navItems.forEach(item => {
      item.classList.toggle("active", item.dataset.tab === tabName);
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

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      switchTab(item.dataset.tab);
    });
  });

  // Home CTA Button Handler
  const homeStartBookingBtn = document.getElementById("home-start-booking-btn");
  if (homeStartBookingBtn) {
    homeStartBookingBtn.addEventListener("click", () => {
      switchTab("booking");
      goToStep(1);
    });
  }

  // Home Quick Categories Click Handlers
  document.querySelectorAll(".home-cat-card").forEach(card => {
    card.addEventListener("click", () => {
      const cat = card.dataset.cat;
      if (cat) {
        selectedCategory = cat;
        selectedProblemTitle = "";
        switchTab("booking");
        goToStep(1);
      }
    });
  });

  // Privacy Checkbox Enable/Disable Submit Button Handler
  const privacyAgreeCheckbox = document.getElementById("privacy-agree");
  const submitBookingBtn = document.getElementById("submit-booking-btn");

  if (privacyAgreeCheckbox && submitBookingBtn) {
    submitBookingBtn.disabled = !privacyAgreeCheckbox.checked;

    privacyAgreeCheckbox.addEventListener("change", () => {
      submitBookingBtn.disabled = !privacyAgreeCheckbox.checked;
    });
  }



  // Services Categories & Subservices Tree
  const SERVICE_CATEGORIES = [
    {
      id: "cat_engine",
      title: "🔧 Двигатель и выхлопная система",
      icon: "🔧",
      items: [
        { title: "Замена моторного масла и фильтра", price: "от 1 500 ₽" },
        { title: "Компьютерная диагностика двигателя", price: "от 1 000 ₽" },
        { title: "Замена ремня / цепи ГРМ", price: "от 4 500 ₽" },
        { title: "Замена свечей зажигания", price: "от 1 200 ₽" },
        { title: "Замена глушителя / катализатора", price: "от 2 500 ₽" },
        { title: "Промывка форсунок и инжектора", price: "от 3 000 ₽" }
      ]
    },
    {
      id: "cat_chassis",
      title: "🛞 Подвеска и тормозная система",
      icon: "🛞",
      items: [
        { title: "Замена тормозных колодок (пара)", price: "от 1 500 ₽" },
        { title: "Замена тормозных дисков", price: "от 2 500 ₽" },
        { title: "Комплексная диагностика ходовой", price: "от 1 000 ₽" },
        { title: "Замена амортизаторов / пружин", price: "от 3 000 ₽" },
        { title: "Замена шаровых опор и сайлентблоков", price: "от 2 000 ₽" },
        { title: "Шиномонтаж и балансировка (комплект)", price: "от 2 000 ₽" }
      ]
    },
    {
      id: "cat_electric",
      title: "⚡ Электрика и автоэлектроника",
      icon: "⚡",
      items: [
        { title: "Полная компьютерная диагностика", price: "от 1 000 ₽" },
        { title: "Замена генератора / стартера", price: "от 2 500 ₽" },
        { title: "Замена и зарядка аккумулятора", price: "от 800 ₽" },
        { title: "Поиск и устранение утечки тока", price: "от 2 000 ₽" },
        { title: "Установка автосигнализации", price: "от 4 000 ₽" }
      ]
    },
    {
      id: "cat_to",
      title: "🛢 Регулярное ТО и масляный сервис",
      icon: "🛢",
      items: [
        { title: "Комплексное ТО (масло + 3 фильтра)", price: "от 3 500 ₽" },
        { title: "Замена масла в АКПП / МКПП", price: "от 3 000 ₽" },
        { title: "Замена антифриза / охл. жидкости", price: "от 1 800 ₽" },
        { title: "Замена тормозной жидкости", price: "от 1 500 ₽" }
      ]
    },
    {
      id: "cat_climate",
      title: "❄️ Климат и кондиционер",
      icon: "❄️",
      items: [
        { title: "Диагностика и заправка кондиционера", price: "от 2 000 ₽" },
        { title: "Антибактериальная чистка кондиционера", price: "от 1 500 ₽" },
        { title: "Замена радиатора печки / кондиционера", price: "от 4 000 ₽" }
      ]
    }
  ];

  const selectedProblemsSet = new Set();
  // Map: catId -> custom problem text entered by user
  const customCategoryInputs = {};

  function updateEstimatedTotalPrice() {
    const priceValEl = document.getElementById("total-price-val");
    if (!priceValEl) return;

    let total = 0;
    selectedProblemsSet.forEach(title => {
      SERVICE_CATEGORIES.forEach(cat => {
        const found = cat.items.find(i => i.title === title);
        if (found) {
          const num = parseInt(found.price.replace(/[^\d]/g, ""), 10);
          if (!isNaN(num)) total += num;
        }
      });
    });

    if (total > 0) {
      priceValEl.textContent = `от ${total.toLocaleString("ru-RU")} ₽`;
    } else {
      priceValEl.textContent = "от 0 ₽";
    }
  }

  // Renders summary list of selected problems below the accordion
  function renderSelectedSummary() {
    const summaryEl = document.getElementById("selected-summary");
    if (!summaryEl) return;

    const items = [];
    selectedProblemsSet.forEach(t => items.push(t));
    Object.values(customCategoryInputs).forEach(v => { if (v.trim()) items.push(v.trim()); });

    if (items.length === 0) {
      summaryEl.innerHTML = "";
      return;
    }

    summaryEl.innerHTML = `
      <div class="selected-summary-box glass-card">
        <div class="selected-summary-title">✅ Выбранные услуги:</div>
        <ul class="selected-summary-list">
          ${items.map(i => `<li>${i}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function toggleProblemSelection(title) {
    if (selectedProblemsSet.has(title)) {
      selectedProblemsSet.delete(title);
    } else {
      selectedProblemsSet.add(title);
    }
    updateEstimatedTotalPrice();
    renderSelectedSummary();
  }


  function renderServicesAccordion(filterQuery = "") {
    const container = document.getElementById("category-pills");
    if (!container) return;

    const query = filterQuery.toLowerCase().trim();

    if (query) {
      // Search Results View
      const matched = [];
      SERVICE_CATEGORIES.forEach(cat => {
        cat.items.forEach(item => {
          if (item.title.toLowerCase().includes(query) || cat.title.toLowerCase().includes(query)) {
            matched.push({ ...item, catTitle: cat.title });
          }
        });
      });

      if (matched.length === 0) {
        container.innerHTML = `<div class="info-card glass-card"><p style="text-align: center; color: var(--text-muted);">По вашему запросу «${filterQuery}» ничего не найдено. Попробуйте сформулировать иначе.</p></div>`;
        return;
      }

      container.innerHTML = matched.map(m => {
        const isChecked = selectedProblemsSet.has(m.title);
        return `
          <div class="service-card glass-card ${isChecked ? 'selected' : ''}">
            <div class="service-info">
              <input type="checkbox" class="subservice-checkbox" ${isChecked ? 'checked' : ''} data-title="${m.title}" />
              <div>
                <div class="service-title">${m.title}</div>
                <div class="service-price">${m.price} (${m.catTitle})</div>
              </div>
            </div>
            <button class="service-action-btn select-subservice-btn" data-title="${m.title}">
              ${isChecked ? '✓ Выбрано' : '+ Выбрать'}
            </button>
          </div>
        `;
      }).join("");
    } else {
      // Accordion Categories View with Multi-Select Checkboxes
      container.innerHTML = SERVICE_CATEGORIES.map(cat => `
        <div class="accordion-category glass-card">
          <div class="accordion-header">
            <span>${cat.title}</span>
            <span class="accordion-arrow">▼</span>
          </div>
          <div class="accordion-body">
            ${cat.items.map(item => {
              const isChecked = selectedProblemsSet.has(item.title);
              return `
                <div class="subservice-item ${isChecked ? 'selected' : ''}" data-title="${item.title}">
                  <label class="subservice-checkbox-label" onclick="event.stopPropagation();">
                    <input type="checkbox" class="subservice-checkbox" ${isChecked ? 'checked' : ''} data-title="${item.title}" />
                    <span class="subservice-title">${item.title}</span>
                  </label>
                  <span class="subservice-price">${item.price}</span>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `).join("");
    }

    // Bind Accordion Header Click Handlers
    container.querySelectorAll(".accordion-header").forEach(header => {
      header.addEventListener("click", (e) => {
        e.stopPropagation();
        const parent = header.parentElement;
        parent.classList.toggle("open");
      });
    });

    // Bind Subservice Checkbox Handlers WITHOUT closing accordion!
    container.querySelectorAll(".subservice-item").forEach(itemEl => {
      itemEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const title = itemEl.dataset.title;
        if (title) {
          toggleProblemSelection(title);
          const checkbox = itemEl.querySelector(".subservice-checkbox");
          const isChecked = selectedProblemsSet.has(title);
          if (checkbox) checkbox.checked = isChecked;
          itemEl.classList.toggle("selected", isChecked);
        }
      });
    });

  renderCategoryAccordion();

  // Wizard Step 1 Accordion + Search Setup
  const wizardSearchInput = document.getElementById("wizard-search-input");
  const customProblemGroup = document.getElementById("custom-problem-group");
  let selectedCategory = "";

  function renderCategoryAccordion(filterQuery = "") {
    const container = document.getElementById("category-pills");
    if (!container) return;
    const query = filterQuery.toLowerCase().trim();

    if (query) {
      // Search results: flat list with checkboxes
      const matched = [];
      SERVICE_CATEGORIES.forEach(cat => {
        cat.items.forEach(item => {
          if (item.title.toLowerCase().includes(query) || cat.title.toLowerCase().includes(query)) {
            matched.push({ ...item, catTitle: cat.title });
          }
        });
      });

      if (matched.length === 0) {
        container.innerHTML = `<div class="info-card glass-card"><p style="text-align:center;color:var(--text-muted);">По запросу «${filterQuery}» ничего не найдено.</p></div>`;
        renderSelectedSummary();
        return;
      }

      container.innerHTML = matched.map(m => {
        const isChecked = selectedProblemsSet.has(m.title);
        return `
          <div class="subservice-item ${isChecked ? 'selected' : ''}" data-title="${m.title}">
            <label class="subservice-checkbox-label" onclick="event.stopPropagation();">
              <input type="checkbox" class="subservice-checkbox" ${isChecked ? 'checked' : ''} data-title="${m.title}" />
              <span class="subservice-title">${m.title}</span>
            </label>
            <span class="subservice-price">${m.price}</span>
          </div>
        `;
      }).join("");
    } else {
      // Accordion categories view — each has checkboxes + a text input at the bottom
      container.innerHTML = SERVICE_CATEGORIES.map(cat => {
        const customVal = customCategoryInputs[cat.id] || "";
        return `
          <div class="accordion-category glass-card" data-cat-id="${cat.id}">
            <div class="accordion-header">
              <span>${cat.title}</span>
              <span class="accordion-arrow">▼</span>
            </div>
            <div class="accordion-body">
              ${cat.items.map(item => {
                const isChecked = selectedProblemsSet.has(item.title);
                return `
                  <div class="subservice-item ${isChecked ? 'selected' : ''}" data-title="${item.title}">
                    <label class="subservice-checkbox-label" onclick="event.stopPropagation();">
                      <input type="checkbox" class="subservice-checkbox" ${isChecked ? 'checked' : ''} data-title="${item.title}" />
                      <span class="subservice-title">${item.title}</span>
                    </label>
                    <span class="subservice-price">${item.price}</span>
                  </div>
                `;
              }).join('')}
              <div class="custom-cat-input-row" onclick="event.stopPropagation();">
                <input
                  type="text"
                  class="form-input glass-input custom-cat-input"
                  data-cat-id="${cat.id}"
                  placeholder="Другая проблема..."
                  value="${customVal}"
                />
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    // Bind accordion header toggles
    container.querySelectorAll(".accordion-header").forEach(header => {
      header.addEventListener("click", (e) => {
        e.stopPropagation();
        const parent = header.parentElement;
        parent.classList.toggle("open");
        const arrow = header.querySelector(".accordion-arrow");
        if (arrow) arrow.textContent = parent.classList.contains("open") ? "▲" : "▼";
      });
    });

    // Bind subservice checkboxes
    container.querySelectorAll(".subservice-item").forEach(itemEl => {
      itemEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const title = itemEl.dataset.title;
        if (title) {
          toggleProblemSelection(title);
          const checkbox = itemEl.querySelector(".subservice-checkbox");
          const isChecked = selectedProblemsSet.has(title);
          if (checkbox) checkbox.checked = isChecked;
          itemEl.classList.toggle("selected", isChecked);
        }
      });
    });

    // Bind custom text inputs per category
    container.querySelectorAll(".custom-cat-input").forEach(input => {
      input.addEventListener("input", (e) => {
        e.stopPropagation();
        const catId = input.dataset.catId;
        customCategoryInputs[catId] = input.value;
        renderSelectedSummary();
      });
      input.addEventListener("click", (e) => e.stopPropagation());
    });

    renderSelectedSummary();
  }

  renderCategoryAccordion();

  if (wizardSearchInput) {
    wizardSearchInput.addEventListener("input", (e) => {
      renderCategoryAccordion(e.target.value);
    });
  }

  // Car Number Input Auto-Caps
  const carNumberInput = document.getElementById("car-number");
  if (carNumberInput) {
    carNumberInput.addEventListener("input", () => {
      carNumberInput.value = carNumberInput.value.toUpperCase();
    });
  }

  // Privacy Policy Modal Handlers
  const privacyLink = document.getElementById("privacy-link");
  const privacyModal = document.getElementById("privacy-modal");
  const closePrivacyBtn = document.getElementById("close-privacy-btn");

  if (privacyLink && privacyModal) {
    privacyLink.addEventListener("click", (e) => {
      e.preventDefault();
      privacyModal.classList.remove("hidden");
    });
  }

  if (closePrivacyBtn && privacyModal) {
    closePrivacyBtn.addEventListener("click", () => {
      privacyModal.classList.add("hidden");
    });
  }


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

      // Auto-fill phone from profile if not yet set
      if (data.stats.phone && data.stats.phone !== "Не указан") {
        const phoneInput = document.getElementById("phone-number");
        if (phoneInput && !phoneInput.value) {
          phoneInput.value = data.stats.phone;
        }
      }
      if (data.stats.car_number) {
        const carNumInput = document.getElementById("car-number");
        if (carNumInput && !carNumInput.value) {
          carNumInput.value = data.stats.car_number;
        }
      }

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
            ${b.car_number ? `<p><strong>Госномер:</strong> ${b.car_number}</p>` : ''}
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

  // Multi-Step Wizard Logic
  let currentStep = 1;
  const toStep2Btn = document.getElementById("to-step-2-btn");
  const toStep3Btn = document.getElementById("to-step-3-btn");
  const backToStep1Btn = document.getElementById("back-to-step-1-btn");
  const backToStep2Btn = document.getElementById("back-to-step-2-btn");

  function goToStep(stepNum) {
    currentStep = stepNum;

    for (let i = 1; i <= 3; i++) {
      const ind = document.getElementById(`wizard-step-ind-${i}`);
      const content = document.getElementById(`form-step-${i}`);

      if (ind) {
        ind.classList.toggle("active", i === stepNum);
        ind.classList.toggle("completed", i < stepNum);
      }
      if (content) {
        content.classList.toggle("active", i === stepNum);
        content.classList.toggle("hidden", i !== stepNum);
      }
    }
  }

  // Phone Edit Pencil Handler
  const editPhoneBtn = document.getElementById("edit-phone-btn");
  const phoneInput = document.getElementById("phone-number");
  const phoneHint = document.getElementById("phone-hint");

  if (editPhoneBtn && phoneInput) {
    editPhoneBtn.addEventListener("click", () => {
      phoneInput.removeAttribute("readonly");
      phoneInput.focus();
      phoneInput.select();
      if (phoneHint) {
        phoneHint.textContent = "✏️ Режим редактирования. Введите нужный номер.";
        phoneHint.style.color = "#38bdf8";
      }
      showToast("✏️ Вы можете изменить номер телефона");
    });
  }

  if (toStep2Btn) {
    toStep2Btn.addEventListener("click", () => {
      // Collect selected checkbox problems
      const checkedProblems = Array.from(selectedProblemsSet);
      // Collect custom text inputs per category
      const customProblems = Object.values(customCategoryInputs).map(v => v.trim()).filter(v => v.length > 0);
      const allProblems = [...checkedProblems, ...customProblems];

      let problem = "";
      if (allProblems.length > 0) {
        problem = allProblems.join(", ");
      } else if (selectedCategory === "cat_custom") {
        const customProblemInput = document.getElementById("custom-problem");
        problem = customProblemInput ? customProblemInput.value.trim() : "";
      }

      if (!problem) {
        showToast("⚠️ Пожалуйста, выберите или опишите вашу проблему!");
        return;
      }
      goToStep(2);
      setTimeout(() => {
        const carInput = document.getElementById("car-model");
        if (carInput) carInput.focus();
      }, 100);
    });
  }

  if (toStep3Btn) {
    toStep3Btn.addEventListener("click", () => {
      const carModel = document.getElementById("car-model").value.trim();
      if (!carModel || carModel.length < 2) {
        showToast("⚠️ Пожалуйста, укажите марку и модель авто!");
        const carInput = document.getElementById("car-model");
        if (carInput) carInput.focus();
        return;
      }
      goToStep(3);
    });
  }

  if (backToStep1Btn) {
    backToStep1Btn.addEventListener("click", () => goToStep(1));
  }

  if (backToStep2Btn) {
    backToStep2Btn.addEventListener("click", () => goToStep(2));
  }

  // Booking Form Submission
  const bookingForm = document.getElementById("booking-form");
  const submitBtn = document.getElementById("submit-booking-btn");

  bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Collect all problems (checkboxes + custom text inputs)
    const checkedProblems = Array.from(selectedProblemsSet);
    const customProblems = Object.values(customCategoryInputs).map(v => v.trim()).filter(v => v.length > 0);
    const allProblems = [...checkedProblems, ...customProblems];

    let problem = "";
    if (allProblems.length > 0) {
      problem = allProblems.join(", ");
    } else if (selectedCategory === "cat_custom") {
      const customProblemInput = document.getElementById("custom-problem");
      problem = customProblemInput ? customProblemInput.value.trim() : "";
    }


    const carModel = document.getElementById("car-model").value.trim();
    const carNumber = document.getElementById("car-number") ? document.getElementById("car-number").value.trim().toUpperCase() : "";
    const phone = document.getElementById("phone-number").value.trim();
    const privacyAgree = document.getElementById("privacy-agree");

    if (!problem) {
      showToast("⚠️ Опишите вашу проблему!");
      goToStep(1);
      return;
    }
    if (!carModel) {
      showToast("⚠️ Укажите марку и модель авто!");
      goToStep(2);
      return;
    }
    if (!phone) {
      showToast("⚠️ Укажите ваш телефон!");
      return;
    }
    if (privacyAgree && !privacyAgree.checked) {
      showToast("⚠️ Необходимо согласие с Политикой конфиденциальности!");
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
          car_number: carNumber,
          slot: selectedSlot,
          phone: phone
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`🎉 Заявка №${data.booking_id} успешно создана!`);
        bookingForm.reset();
        selectedProblemsSet.clear();
        // Clear custom inputs
        Object.keys(customCategoryInputs).forEach(k => delete customCategoryInputs[k]);
        renderCategoryAccordion();
        goToStep(1);
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

      const isPending = b.status === "На рассмотрении";
      const actionsHtml = isPending ? `
        <div class="admin-actions-grid">
          <button class="admin-btn admin-btn-approve" data-id="${b.id}">✅ Одобрить</button>
          <button class="admin-btn admin-btn-reject" data-id="${b.id}">❌ Отклонить</button>
          <button class="admin-btn admin-btn-delete" data-id="${b.id}">🗑 Удалить заявку</button>
        </div>
      ` : `
        <div class="admin-actions-grid">
          <button class="admin-btn admin-btn-delete" data-id="${b.id}">🗑 Удалить заявку</button>
        </div>
      `;

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
            ${b.car_number ? `<p><strong>Госномер:</strong> ${b.car_number}</p>` : ''}
            <p><strong>Время:</strong> ${b.slot}</p>
            ${b.comment ? `<p><strong>Прим. модератора:</strong> <em>${b.comment}</em></p>` : ''}
          </div>

          ${actionsHtml}
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
