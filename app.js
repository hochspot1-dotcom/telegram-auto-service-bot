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

  // Persistent Phone Autofill & Initial Telegram Contact Request
  const phoneInputEl = document.getElementById("phone-number");

  function initAutoPhoneRequest() {
    const savedPhone = localStorage.getItem("user_phone_saved");
    const tgPhone = tg?.initDataUnsafe?.user?.phone_number || "";

    if (savedPhone && phoneInputEl) {
      phoneInputEl.value = savedPhone;
      return;
    }

    if (tgPhone && phoneInputEl) {
      const formatted = "+" + tgPhone.replace(/\D/g, "");
      localStorage.setItem("user_phone_saved", formatted);
      phoneInputEl.value = formatted;
      return;
    }

    // First time launch: request phone via Telegram WebApp API if supported
    if (tg && typeof tg.requestContact === "function" && !localStorage.getItem("tg_contact_requested")) {
      localStorage.setItem("tg_contact_requested", "true");
      tg.requestContact((sent, event) => {
        if (sent && event && event.responseUnsafe && event.responseUnsafe.contact) {
          const num = "+" + event.responseUnsafe.contact.phone_number.replace(/\D/g, "");
          localStorage.setItem("user_phone_saved", num);
          if (phoneInputEl) phoneInputEl.value = num;
          showToast("✅ Номер телефона получен из Telegram!");
        }
      });
    }
  }

  initAutoPhoneRequest();

  if (phoneInputEl) {
    phoneInputEl.addEventListener("input", () => {
      if (phoneInputEl.value.trim()) {
        localStorage.setItem("user_phone_saved", phoneInputEl.value.trim());
      }
    });
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


  // Floating Navbar Tab switching & Liquid Blob animation
  const navItems = document.querySelectorAll(".nav-item");
  const tabContents = document.querySelectorAll(".tab-content");
  const navBlobPill = document.getElementById("nav-blob-pill");
  const mainNav = document.getElementById("main-nav");

  function updateNavBlobPosition() {
    if (!navBlobPill || !mainNav) return;
    const activeNav = mainNav.querySelector(".nav-item.active");
    if (!activeNav || activeNav.classList.contains("nav-item-main")) {
      navBlobPill.style.opacity = "0";
      return;
    }

    const navRect = mainNav.getBoundingClientRect();
    const activeRect = activeNav.getBoundingClientRect();

    // Compact width capsule centered over tab item
    const targetWidth = Math.min(activeRect.width - 20, 64);
    const left = activeRect.left - navRect.left + (activeRect.width - targetWidth) / 2;

    navBlobPill.style.opacity = "1";
    navBlobPill.style.transform = `translateX(${left}px)`;
    navBlobPill.style.width = `${targetWidth}px`;
  }

  function switchTab(tabName) {
    navItems.forEach(item => {
      item.classList.toggle("active", item.dataset.tab === tabName);
    });
    tabContents.forEach(content => {
      content.classList.toggle("active", content.id === `tab-${tabName}`);
    });

    updateNavBlobPosition();

    if (tabName === "profile") {
      loadUserProfile();
    } else if (tabName === "booking") {
      loadSlots();
    } else if (tabName === "admin" && isAdmin) {
      loadAdminBookings(currentAdminFilter);
    }
  }

  window.addEventListener("resize", updateNavBlobPosition);
  setTimeout(updateNavBlobPosition, 100);

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

  // Triton Hub & Action Widgets Handlers
  const quickBookingBanner = document.getElementById("triton-quick-booking-banner");
  if (quickBookingBanner) {
    quickBookingBanner.addEventListener("click", () => {
      switchTab("booking");
      goToStep(2);
    });
  }

  const widgetBookings = document.getElementById("triton-widget-bookings");
  if (widgetBookings) {
    widgetBookings.addEventListener("click", () => {
      switchTab("profile");
    });
  }

  const widgetMasters = document.getElementById("triton-widget-masters");
  if (widgetMasters) {
    widgetMasters.addEventListener("click", () => {
      switchTab("booking");
      goToStep(2);
    });
  }

  document.querySelectorAll(".triton-hub-card").forEach(card => {
    card.addEventListener("click", () => {
      switchTab("booking");
      goToStep(1);
    });
  });

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

  } // end renderServicesAccordion

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
            <label class="subservice-checkbox-label">
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
                    <label class="subservice-checkbox-label">
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

    // Bind subservice checkboxes — use change event on checkbox as source of truth
    container.querySelectorAll(".subservice-item").forEach(itemEl => {
      itemEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const title = itemEl.dataset.title;
        if (!title) return;

        const checkbox = itemEl.querySelector(".subservice-checkbox");
        if (!checkbox) return;

        // If click landed on checkbox or its label, the browser already toggled checkbox.checked.
        // If click was on price or row padding, we need to manually toggle.
        const throughLabel = !!e.target.closest('label');
        const onCheckbox   = e.target === checkbox;

        if (!throughLabel && !onCheckbox) {
          // Manual toggle for clicks on the price tag or row bg
          checkbox.checked = !checkbox.checked;
        }

        // Sync Set with current checkbox state (browser may have already toggled)
        if (checkbox.checked) {
          selectedProblemsSet.add(title);
        } else {
          selectedProblemsSet.delete(title);
        }

        itemEl.classList.toggle("selected", checkbox.checked);
        updateEstimatedTotalPrice();
        renderSelectedSummary();
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


  // Full Interactive Month Calendar & Time Slots
  const MONTH_NAMES_RU = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];
  const MONTH_NAMES_RU_GENITIVE = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  const todayObj = new Date();
  let calendarYear = todayObj.getFullYear();
  let calendarMonth = todayObj.getMonth();

  let selectedDateObj = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
  let selectedDateLabel = `${todayObj.getDate()} ${MONTH_NAMES_RU_GENITIVE[todayObj.getMonth()]} ${todayObj.getFullYear()}`;

  // Daily schedule slots (clean time display)
  const DAILY_TIME_SLOTS = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00"];

  const BUSY_SLOTS_MAP = {
    "master_alexey": { "09:00": true, "13:30": true },
    "master_dmitry": { "10:30": true, "16:30": true },
    "master_igor":   { "12:00": true, "18:00": true }
  };

  const MASTERS_DATA = [
    {
      id: "master_any",
      name: "🌟 Любой свободный мастер",
      role: "Ближайшее доступное время",
      avatar: "👨‍🔧",
      badge: "⚡ Быстрый выбор"
    },
    {
      id: "master_alexey",
      name: "Алексей Смирнов",
      role: "Старший механик (Двигатель и ТО)",
      avatar: "👨‍🔧",
      badge: "Опыт 12 лет"
    },
    {
      id: "master_dmitry",
      name: "Дмитрий Ковалев",
      role: "Диагност-автоэлектрик",
      avatar: "⚡",
      badge: "Опыт 9 лет"
    },
    {
      id: "master_igor",
      name: "Игорь Соколов",
      role: "Мастер по ходовой части",
      avatar: "🛞",
      badge: "Опыт 8 лет"
    }
  ];

  let selectedMasterId = "master_any";
  let selectedMasterName = "Любой свободный мастер";
  let selectedSlot = "";

  function renderMasters() {
    const container = document.getElementById("masters-container");
    if (!container) return;

    container.innerHTML = MASTERS_DATA.map(m => {
      const isSelected = m.id === selectedMasterId;
      return `
        <div class="master-card glass-card ${isSelected ? 'selected' : ''}" data-master-id="${m.id}">
          <div class="master-avatar">${m.avatar}</div>
          <div class="master-info">
            <div class="master-name">${m.name}</div>
            <div class="master-role">${m.role}</div>
          </div>
          <div class="master-badge">${m.badge}</div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".master-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.masterId;
        const master = MASTERS_DATA.find(m => m.id === id);
        if (master) {
          selectedMasterId = master.id;
          selectedMasterName = master.name;
          renderMasters();
          renderSlotsForMasterAndDate();
        }
      });
    });
  }

  function renderFullMonthCalendar() {
    const container = document.getElementById("full-calendar-widget");
    if (!container) return;

    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
    const lastDayOfMonth = new Date(calendarYear, calendarMonth + 1, 0);
    const totalDays = lastDayOfMonth.getDate();

    // Calculate day offset (Monday = 0, Sunday = 6)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const isPrevDisabled = (calendarYear < todayObj.getFullYear()) ||
                           (calendarYear === todayObj.getFullYear() && calendarMonth <= todayObj.getMonth());

    let daysHtml = "";
    // Empty padding cells for first week
    for (let i = 0; i < startDayOfWeek; i++) {
      daysHtml += `<div class="cal-day empty"></div>`;
    }

    // Days 1..totalDays
    for (let day = 1; day <= totalDays; day++) {
      const cellDate = new Date(calendarYear, calendarMonth, day);
      const isToday = (cellDate.toDateString() === todayObj.toDateString());
      const isPast = (cellDate < new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate()));
      const isSelected = (cellDate.toDateString() === selectedDateObj.toDateString());

      let classes = "cal-day";
      if (isPast) classes += " past disabled";
      if (isToday) classes += " today";
      if (isSelected) classes += " selected";

      daysHtml += `
        <div class="${classes}" data-year="${calendarYear}" data-month="${calendarMonth}" data-day="${day}">
          ${day}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="cal-header">
        <button type="button" class="cal-nav-btn" id="cal-prev-month" ${isPrevDisabled ? 'disabled' : ''}>‹</button>
        <span class="cal-month-title">${MONTH_NAMES_RU[calendarMonth]} ${calendarYear}</span>
        <button type="button" class="cal-nav-btn" id="cal-next-month">›</button>
      </div>
      <div class="cal-weekdays">
        <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
      </div>
      <div class="cal-days-grid">
        ${daysHtml}
      </div>
    `;

    // Month Navigation Handlers
    const prevBtn = document.getElementById("cal-prev-month");
    const nextBtn = document.getElementById("cal-next-month");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (calendarMonth === 0) {
          calendarMonth = 11;
          calendarYear--;
        } else {
          calendarMonth--;
        }
        renderFullMonthCalendar();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (calendarMonth === 11) {
          calendarMonth = 0;
          calendarYear++;
        } else {
          calendarMonth++;
        }
        renderFullMonthCalendar();
      });
    }

    // Day Selection Click Handlers — Swaps calendar view for time slots view!
    container.querySelectorAll(".cal-day:not(.past):not(.empty)").forEach(cell => {
      cell.addEventListener("click", () => {
        const y = parseInt(cell.dataset.year);
        const m = parseInt(cell.dataset.month);
        const d = parseInt(cell.dataset.day);

        selectedDateObj = new Date(y, m, d);
        selectedDateLabel = `${d} ${MONTH_NAMES_RU_GENITIVE[m]} ${y}`;

        renderFullMonthCalendar();
        openSlotsViewForDate();
      });
    });
  }

  function openSlotsViewForDate() {
    const calendarGroup = document.getElementById("calendar-step-group");
    const slotsGroup = document.getElementById("slots-step-group");
    const dateBadge = document.getElementById("slots-date-badge");

    if (dateBadge) {
      dateBadge.textContent = `📅 ${selectedDateLabel}`;
    }

    renderSlotsForMasterAndDate();

    if (calendarGroup) calendarGroup.classList.add("hidden");
    if (slotsGroup) slotsGroup.classList.remove("hidden");
  }

  function showCalendarView() {
    const calendarGroup = document.getElementById("calendar-step-group");
    const slotsGroup = document.getElementById("slots-step-group");

    if (calendarGroup) calendarGroup.classList.remove("hidden");
    if (slotsGroup) slotsGroup.classList.add("hidden");
  }

  // Bind "← Изменить дату" button
  const changeDateBtn = document.getElementById("change-date-btn");
  if (changeDateBtn) {
    changeDateBtn.addEventListener("click", showCalendarView);
  }

  function renderSlotsForMasterAndDate() {
    const container = document.getElementById("slots-container");
    const label = document.getElementById("slots-header-label");
    if (!container) return;

    if (label) {
      label.textContent = `Время записи на ${selectedDateLabel} (${selectedMasterName}):`;
    }

    const busyMap = BUSY_SLOTS_MAP[selectedMasterId] || {};
    let firstAvailableFound = false;

    container.innerHTML = DAILY_TIME_SLOTS.map((time) => {
      const isBusy = !!busyMap[time];
      let isSelected = false;

      if (!isBusy && !firstAvailableFound) {
        isSelected = true;
        firstAvailableFound = true;
        selectedSlot = `${selectedDateLabel} в ${time}`;
      }

      // Simple line-through grayed out style for occupied slots (no locks, no tags)
      if (isBusy) {
        return `
          <div class="slot-item busy disabled" title="Время занято">
            ${time}
          </div>
        `;
      }

      return `
        <div class="slot-item ${isSelected ? 'active' : ''}" data-time="${time}">
          ${time}
        </div>
      `;
    }).join("");

    container.querySelectorAll(".slot-item:not(.busy)").forEach(item => {
      item.addEventListener("click", () => {
        container.querySelectorAll(".slot-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        selectedSlot = `${selectedDateLabel} в ${item.dataset.time}`;
      });
    });
  }

  async function loadSlots() {
    renderMasters();
    renderFullMonthCalendar();
    showCalendarView();
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

    let activeRescheduleBookingId = null;

    container.innerHTML = bookings.map(b => {
      let badgeClass = "badge-pending";
      let statusIcon = "⏳";
      let isUnavailable = b.status.includes("недоступен") || b.status.includes("Перенос");

      if (isUnavailable) {
        badgeClass = "badge-warning";
        statusIcon = "⚠️";
      } else if (b.status === "Одобрена" || b.status === "Активна") {
        badgeClass = "badge-approved";
        statusIcon = "✅";
      } else if (b.status.includes("Отменен") || b.status.includes("Отклонен")) {
        badgeClass = "badge-cancelled";
        statusIcon = "🔴";
      }

      const isCancelable = ["На рассмотрении", "Одобрена", "Активна"].includes(b.status) || isUnavailable;

      return `
        <div class="booking-card glass-card ${isUnavailable ? 'warning-card' : ''}">
          <div class="booking-header">
            <span class="booking-id">Запись №${b.id}</span>
            <span class="badge ${badgeClass}">${statusIcon} ${b.status}</span>
          </div>
          <div class="booking-details">
            <p><strong>Услуга:</strong> ${b.problem}</p>
            <p><strong>Автомобиль:</strong> ${b.car_model}</p>
            ${b.car_number ? `<p><strong>Госномер:</strong> ${b.car_number}</p>` : ''}
            <p><strong>Время:</strong> ${b.slot}</p>
            ${b.comment ? `<p class="booking-comment-box"><strong>Сообщение автосервиса:</strong> <em>${b.comment}</em></p>` : ''}
          </div>

          <div class="booking-card-actions">
            ${isUnavailable ? `<button class="reschedule-btn glow-btn" data-id="${b.id}">🔄 Выбрать другого мастера / время</button>` : ''}
            ${isCancelable ? `<button class="cancel-btn" data-id="${b.id}">Отменить запись</button>` : ''}
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".reschedule-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeRescheduleBookingId = parseInt(btn.dataset.id);
        switchTab("booking");
        goToStep(2);
        showToast(`🔄 Перенос записи №${activeRescheduleBookingId}: выберите мастера и время`);
      });
    });

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

  // Multi-Step Wizard Logic (4 steps)
  let currentStep = 1;
  const toStep2Btn = document.getElementById("to-step-2-btn");
  const toStep3Btn = document.getElementById("to-step-3-btn");
  const toStep4Btn = document.getElementById("to-step-4-btn");
  const backToStep1Btn = document.getElementById("back-to-step-1-btn");
  const backToStep2Btn = document.getElementById("back-to-step-2-btn");
  const backToStep3Btn = document.getElementById("back-to-step-3-btn");

  function goToStep(stepNum) {
    currentStep = stepNum;

    for (let i = 1; i <= 4; i++) {
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

    if (stepNum === 4) {
      renderFinalBookingSummary();
    }
  }

  function renderFinalBookingSummary() {
    const summaryContainer = document.getElementById("final-booking-summary");
    if (!summaryContainer) return;

    const checkedProblems = Array.from(selectedProblemsSet);
    const customProblems = Object.values(customCategoryInputs).map(v => v.trim()).filter(v => v.length > 0);
    const allProblems = [...checkedProblems, ...customProblems];
    const problemText = allProblems.length > 0 ? allProblems.join(", ") : "Не указано";
    const carModel = document.getElementById("car-model") ? document.getElementById("car-model").value.trim() : "";
    const carNumber = document.getElementById("car-number") ? document.getElementById("car-number").value.trim().toUpperCase() : "";

    summaryContainer.innerHTML = `
      <div class="summary-item">
        <span class="summary-label">🛠 Выбранные работы:</span>
        <span class="summary-val">${problemText}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">👨‍🔧 Специалист:</span>
        <span class="summary-val highlight">${selectedMasterName}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">📅 Дата и время:</span>
        <span class="summary-val highlight">${selectedSlot || "Не выбрано"}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">🚗 Автомобиль:</span>
        <span class="summary-val">${carModel || "Не указан"} ${carNumber ? `(${carNumber})` : ""}</span>
      </div>
    `;
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

  // Step 1 -> Step 2
  if (toStep2Btn) {
    toStep2Btn.addEventListener("click", () => {
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

      if (!problem) {
        showToast("⚠️ Пожалуйста, выберите или опишите вашу проблему!");
        return;
      }
      goToStep(2);
    });
  }

  // Step 2 -> Step 3
  if (toStep3Btn) {
    toStep3Btn.addEventListener("click", () => {
      if (!selectedSlot) {
        showToast("⚠️ Пожалуйста, выберите удобное время записи!");
        return;
      }
      goToStep(3);
      setTimeout(() => {
        const carInput = document.getElementById("car-model");
        if (carInput) carInput.focus();
      }, 100);
    });
  }

  // Step 3 -> Step 4
  if (toStep4Btn) {
    toStep4Btn.addEventListener("click", () => {
      const carModel = document.getElementById("car-model").value.trim();
      if (!carModel || carModel.length < 2) {
        showToast("⚠️ Пожалуйста, укажите марку и модель авто!");
        const carInput = document.getElementById("car-model");
        if (carInput) carInput.focus();
        return;
      }
      goToStep(4);
    });
  }

  if (backToStep1Btn) backToStep1Btn.addEventListener("click", () => goToStep(1));
  if (backToStep2Btn) backToStep2Btn.addEventListener("click", () => goToStep(2));
  if (backToStep3Btn) backToStep3Btn.addEventListener("click", () => goToStep(3));

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

      const targetSlot = `${selectedSlot} (Мастер: ${selectedMasterName})`;

      // If client is rescheduling an existing affected booking
      if (activeRescheduleBookingId) {
        const res = await fetch(`${BACKEND_URL}/api/booking/reschedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: activeRescheduleBookingId,
            user_id: userId,
            new_slot: targetSlot
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`🎉 Запись №${activeRescheduleBookingId} успешно перенесена!`);
          activeRescheduleBookingId = null;
          switchTab("profile");
          return;
        } else {
          showToast("⚠️ " + (data.error || "Не удалось перенести запись"));
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>🚀 Подтвердить запись</span>`;
          return;
        }
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
          slot: targetSlot,
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

  // Admin Master & Date Selection Logic
  let selectedAdmMaster = "Алексей Смирнов";

  const admMasterSelector = document.getElementById("adm-masters-selector");
  if (admMasterSelector) {
    admMasterSelector.querySelectorAll(".adm-master-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        admMasterSelector.querySelectorAll(".adm-master-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        selectedAdmMaster = chip.dataset.master;
      });
    });
  }

  // Set default date picker value to today
  const admOffDateInput = document.getElementById("adm-off-date");
  if (admOffDateInput && !admOffDateInput.value) {
    const todayStr = new Date().toISOString().split("T")[0];
    admOffDateInput.value = todayStr;
  }

  const admTriggerRescheduleBtn = document.getElementById("adm-trigger-reschedule-btn");
  if (admTriggerRescheduleBtn) {
    admTriggerRescheduleBtn.addEventListener("click", async () => {
      const reasonInput = document.getElementById("adm-master-reason");
      const rawDate = admOffDateInput ? admOffDateInput.value : "";
      const reason = reasonInput ? reasonInput.value.trim() : "";

      let formattedDateTarget = "";
      if (rawDate) {
        const [year, monthStr, dayStr] = rawDate.split("-");
        const monthIdx = parseInt(monthStr, 10) - 1;
        const day = parseInt(dayStr, 10);
        if (MONTH_NAMES_RU_GENITIVE[monthIdx]) {
          formattedDateTarget = `${day} ${MONTH_NAMES_RU_GENITIVE[monthIdx]}`;
        }
      }

      if (!selectedAdmMaster) {
        showToast("⚠️ Выберите мастера!");
        return;
      }
      if (!rawDate) {
        showToast("⚠️ Укажите дату отсутствия мастера!");
        return;
      }

      const dateNotice = formattedDateTarget ? `на ${formattedDateTarget}` : "";
      if (!confirm(`Отменить смену мастера "${selectedAdmMaster}" ${dateNotice} и уведомить всех записанных клиентов?`)) {
        return;
      }

      admTriggerRescheduleBtn.disabled = true;
      admTriggerRescheduleBtn.innerHTML = "<span>⏳ Отправка...</span>";

      try {
        const res = await fetch(`${BACKEND_URL}/api/admin/master/reschedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            admin_id: userId,
            master_name: selectedAdmMaster,
            target_date: formattedDateTarget,
            reason: reason
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`✅ Записи к мастеру "${selectedAdmMaster}" ${dateNotice} отменены (затронуто ${data.affected_count} клиентов)!`);
          loadAdminBookings(currentAdminFilter);
        } else {
          showToast("⚠️ " + (data.error || "Ошибка смены мастера"));
        }
      } catch (e) {
        showToast("⚠️ Ошибка соединения с сервером");
      } finally {
        admTriggerRescheduleBtn.disabled = false;
        admTriggerRescheduleBtn.innerHTML = "<span>⚠️ Снять мастера на выбранную дату и уведомить клиентов</span>";
      }
    });
  }

});
