// ==========================================
// CONFIG & BACKEND API URL
// ==========================================
const CONFIG_BACKEND_URL = "https://carservicegorlovka.de1.netrun.io";

function getBackendUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramUrl = urlParams.get("backend");
  if (paramUrl) return paramUrl.replace(/\/$/, "");

  if (CONFIG_BACKEND_URL && CONFIG_BACKEND_URL.trim() !== "") {
    return CONFIG_BACKEND_URL.trim().replace(/\/$/, "");
  }

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

  const tgUser = tg?.initDataUnsafe?.user || {
    id: 123456789,
    first_name: "Посетитель",
    username: "guest"
  };

  const userId = tgUser.id;
  const userName = tgUser.first_name + (tgUser.last_name ? " " + tgUser.last_name : "");

  const greetingEl = document.getElementById("user-greeting");
  if (greetingEl) {
    greetingEl.textContent = userName.toUpperCase();
  }
  const profileNameEl = document.getElementById("profile-name");
  if (profileNameEl) {
    profileNameEl.textContent = userName.toUpperCase();
  }

  let isAdmin = false;
  let currentAdminFilter = "all";
  let pendingAdminAction = null;
  let activeRescheduleBookingId = null;

  // Onboarding Screen Handler
  const onboardingOverlay = document.getElementById("triton-onboarding-screen");
  const onboardingNextBtn = document.getElementById("onboarding-next-btn");
  const onboardingCancelBtn = document.getElementById("onboarding-cancel-btn");

  const isOnboarded = localStorage.getItem("cyber_onboarded");
  if (!isOnboarded && onboardingOverlay) {
    onboardingOverlay.classList.add("visible");
  }

  function closeOnboarding() {
    if (onboardingOverlay) {
      onboardingOverlay.classList.add("closing");
      setTimeout(() => {
        onboardingOverlay.classList.remove("visible", "closing");
        onboardingOverlay.classList.add("hidden");
      }, 250);
    }
    localStorage.setItem("cyber_onboarded", "true");
  }

  if (onboardingNextBtn) {
    onboardingNextBtn.addEventListener("click", () => {
      if (tg?.requestContact) {
        tg.requestContact((sent, response) => {
          if (sent && response?.responseUnsafe?.contact?.phone_number) {
            const rawPhone = response.responseUnsafe.contact.phone_number;
            const formatted = "+" + rawPhone.replace(/\D/g, "");
            localStorage.setItem("user_phone_saved", formatted);
            const phoneInputEl = document.getElementById("phone-number");
            if (phoneInputEl) phoneInputEl.value = formatted;
            showToast("✅ Номер телефона сохранен!");
          }
        });
      }
      closeOnboarding();
    });
  }

  if (onboardingCancelBtn) {
    onboardingCancelBtn.addEventListener("click", closeOnboarding);
  }

  function initAutoPhoneRequest() {
    const savedPhone = localStorage.getItem("user_phone_saved");
    const tgPhone = tg?.initDataUnsafe?.user?.phone_number || "";
    const phoneInputEl = document.getElementById("phone-number");

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

    if (tg && typeof tg.requestContact === "function" && !localStorage.getItem("tg_contact_requested")) {
      localStorage.setItem("tg_contact_requested", "true");
      tg.requestContact((sent, event) => {
        if (sent && event && event.responseUnsafe && event.responseUnsafe.contact) {
          const num = "+" + event.responseUnsafe.contact.phone_number.replace(/\D/g, "");
          localStorage.setItem("user_phone_saved", num);
          if (phoneInputEl) phoneInputEl.value = num;
          showToast("✅ Номер телефона получен!");
        }
      });
    }
  }

  initAutoPhoneRequest();

  const phoneInputEl = document.getElementById("phone-number");
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

  // Navigation Tab Switching
  const navItems = document.querySelectorAll(".cyber-nav-item");
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
      if (item.dataset.tab === "booking" && item.dataset.step) {
        goToStep(parseInt(item.dataset.step, 10));
      }
    });
  });

  // Home CTA Handlers
  const homeStartBookingBtn = document.getElementById("home-start-booking-btn");
  if (homeStartBookingBtn) {
    homeStartBookingBtn.addEventListener("click", (e) => {
      if (!e.target.closest('#hero-play-btn')) {
        switchTab("booking");
        goToStep(1);
      }
    });
  }

  const heroPlayBtn = document.getElementById("hero-play-btn");
  if (heroPlayBtn) {
    heroPlayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      switchTab("booking");
      goToStep(1);
    });
  }

  const quickBookingBanner = document.getElementById("triton-quick-booking-banner");
  if (quickBookingBanner) {
    quickBookingBanner.addEventListener("click", () => {
      switchTab("booking");
      goToStep(2);
    });
  }

  document.querySelectorAll("[data-tab]").forEach(card => {
    card.addEventListener("click", (e) => {
      // Avoid double trigger if it's nav item
      if (card.classList.contains("cyber-nav-item")) return;
      const tab = card.dataset.tab;
      const step = card.dataset.step ? parseInt(card.dataset.step, 10) : null;
      if (tab) switchTab(tab);
      if (step) goToStep(step);
    });
  });

  // Privacy Checkbox Handler
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
      items: [
        { title: "Диагностика и заправка кондиционера", price: "от 2 000 ₽" },
        { title: "Антибактериальная чистка кондиционера", price: "от 1 500 ₽" },
        { title: "Замена радиатора печки / кондиционера", price: "от 4 000 ₽" }
      ]
    }
  ];

  const selectedProblemsSet = new Set();
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
      <div class="cyber-card" style="margin-top:8px;">
        <div style="font-size:11px;font-weight:700;color:var(--green-neon);text-transform:uppercase;margin-bottom:4px;">✅ ВЫБРАННЫЕ УСЛУГИ:</div>
        <ul style="font-size:12px;color:var(--text-1);padding-left:16px;">
          ${items.map(i => `<li>${i}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  const wizardSearchInput = document.getElementById("wizard-search-input");

  function renderCategoryAccordion(filterQuery = "") {
    const container = document.getElementById("category-pills");
    if (!container) return;
    const query = filterQuery.toLowerCase().trim();

    if (query) {
      const matched = [];
      SERVICE_CATEGORIES.forEach(cat => {
        cat.items.forEach(item => {
          if (item.title.toLowerCase().includes(query) || cat.title.toLowerCase().includes(query)) {
            matched.push({ ...item, catTitle: cat.title });
          }
        });
      });

      if (matched.length === 0) {
        container.innerHTML = `<div class="cyber-card"><p style="text-align:center;color:var(--text-2);">По запросу «${filterQuery}» ничего не найдено.</p></div>`;
        renderSelectedSummary();
        return;
      }

      container.innerHTML = matched.map(m => {
        const isChecked = selectedProblemsSet.has(m.title);
        return `
          <div class="cyber-checkbox-row ${isChecked ? 'selected' : ''}" data-title="${m.title}">
            <span class="cyber-box-icon"><span class="cyber-box-inner"></span></span>
            <span class="cyber-checkbox-label-text">${m.title}</span>
            <span class="cyber-checkbox-price-tag">${m.price}</span>
          </div>
        `;
      }).join("");
    } else {
      container.innerHTML = SERVICE_CATEGORIES.map(cat => {
        const customVal = customCategoryInputs[cat.id] || "";
        return `
          <div class="cyber-accordion-group" data-cat-id="${cat.id}">
            <div class="cyber-accordion-header">
              <span>${cat.title}</span>
              <span class="cyber-accordion-arrow">▼</span>
            </div>
            <div class="cyber-accordion-body">
              ${cat.items.map(item => {
                const isChecked = selectedProblemsSet.has(item.title);
                return `
                  <div class="cyber-checkbox-row ${isChecked ? 'selected' : ''}" data-title="${item.title}">
                    <span class="cyber-box-icon"><span class="cyber-box-inner"></span></span>
                    <span class="cyber-checkbox-label-text">${item.title}</span>
                    <span class="cyber-checkbox-price-tag">${item.price}</span>
                  </div>
                `;
              }).join('')}
              <div onclick="event.stopPropagation();" style="margin-top:4px;">
                <input
                  type="text"
                  class="cyber-cat-custom-input custom-cat-input"
                  data-cat-id="${cat.id}"
                  placeholder="Другая проблема в категории..."
                  value="${customVal}"
                />
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    container.querySelectorAll(".cyber-accordion-header").forEach(header => {
      header.addEventListener("click", (e) => {
        e.stopPropagation();
        const parent = header.parentElement;
        parent.classList.toggle("open");
      });
    });

    // Bind Cyber Tech Checkbox Rows [ ■ ]
    container.querySelectorAll(".cyber-checkbox-row").forEach(rowEl => {
      rowEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const title = rowEl.dataset.title;
        if (!title) return;

        if (selectedProblemsSet.has(title)) {
          selectedProblemsSet.delete(title);
          rowEl.classList.remove("selected");
        } else {
          selectedProblemsSet.add(title);
          rowEl.classList.add("selected");
        }

        updateEstimatedTotalPrice();
        renderSelectedSummary();
      });
    });

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

  const carNumberInput = document.getElementById("car-number");
  if (carNumberInput) {
    carNumberInput.addEventListener("input", () => {
      carNumberInput.value = carNumberInput.value.toUpperCase();
    });
  }

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
      badge: "⚡ БЫСТРЫЙ ВЫБОР"
    },
    {
      id: "master_alexey",
      name: "Алексей Смирнов",
      role: "Старший механик (Двигатель и ТО)",
      avatar: "👨‍🔧",
      badge: "ОПЫТ 12 ЛЕТ"
    },
    {
      id: "master_dmitry",
      name: "Дмитрий Ковалев",
      role: "Диагност-автоэлектрик",
      avatar: "⚡",
      badge: "ОПЫТ 9 ЛЕТ"
    },
    {
      id: "master_igor",
      name: "Игорь Соколов",
      role: "Мастер по ходовой части",
      avatar: "🛞",
      badge: "ОПЫТ 8 ЛЕТ"
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
        <div class="cyber-master-card ${isSelected ? 'selected' : ''}" data-master-id="${m.id}">
          <div class="cyber-master-avatar">${m.avatar}</div>
          <div>
            <div class="cyber-master-name">${m.name}</div>
            <div class="cyber-master-role">${m.role}</div>
          </div>
          <div class="cyber-master-badge">${m.badge}</div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".cyber-master-card").forEach(card => {
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

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const isPrevDisabled = (calendarYear < todayObj.getFullYear()) ||
                           (calendarYear === todayObj.getFullYear() && calendarMonth <= todayObj.getMonth());

    let daysHtml = "";
    for (let i = 0; i < startDayOfWeek; i++) {
      daysHtml += `<div class="cyber-cal-day empty"></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
      const cellDate = new Date(calendarYear, calendarMonth, day);
      const isToday = (cellDate.toDateString() === todayObj.toDateString());
      const isPast = (cellDate < new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate()));
      const isSelected = (cellDate.toDateString() === selectedDateObj.toDateString());

      let classes = "cyber-cal-day";
      if (isPast) classes += " past";
      if (isToday) classes += " today";
      if (isSelected) classes += " selected";

      daysHtml += `
        <div class="${classes}" data-year="${calendarYear}" data-month="${calendarMonth}" data-day="${day}">
          ${day}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="cyber-cal-header">
        <button type="button" class="cyber-cal-btn" id="cal-prev-month" ${isPrevDisabled ? 'disabled' : ''}>‹</button>
        <span class="cyber-cal-title">${MONTH_NAMES_RU[calendarMonth]} ${calendarYear}</span>
        <button type="button" class="cyber-cal-btn" id="cal-next-month">›</button>
      </div>
      <div class="cyber-cal-weekdays">
        <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
      </div>
      <div class="cyber-cal-grid">
        ${daysHtml}
      </div>
    `;

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

    container.querySelectorAll(".cyber-cal-day:not(.past):not(.empty)").forEach(cell => {
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
      dateBadge.textContent = `📅 ${selectedDateLabel.toUpperCase()}`;
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

  const changeDateBtn = document.getElementById("change-date-btn");
  if (changeDateBtn) {
    changeDateBtn.addEventListener("click", showCalendarView);
  }

  function renderSlotsForMasterAndDate() {
    const container = document.getElementById("slots-container");
    const label = document.getElementById("slots-header-label");
    if (!container) return;

    if (label) {
      label.textContent = `ВРЕМЯ ЗАПИСИ НА ${selectedDateLabel.toUpperCase()} (${selectedMasterName.toUpperCase()}):`;
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

      if (isBusy) {
        return `
          <div class="cyber-slot-item booked">
            ${time}
          </div>
        `;
      }

      return `
        <div class="cyber-slot-item ${isSelected ? 'active' : ''}" data-time="${time}">
          ${time}
        </div>
      `;
    }).join("");

    container.querySelectorAll(".cyber-slot-item:not(.booked)").forEach(item => {
      item.addEventListener("click", () => {
        container.querySelectorAll(".cyber-slot-item").forEach(i => i.classList.remove("active"));
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

  async function loadUserProfile() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/info?user_id=${userId}`);
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();

      document.getElementById("stat-active").textContent = data.stats.active || 0;
      document.getElementById("stat-total").textContent = data.stats.total || 0;
      document.getElementById("stat-cancelled").textContent = data.stats.cancelled || 0;
      document.getElementById("profile-phone").textContent = `Телефон: ${data.stats.phone || 'Не указан'}`;

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
      container.innerHTML = `<div class="cyber-card"><p style="text-align: center; color: var(--text-2);">У вас пока нет оформленных записей.</p></div>`;
      return;
    }

    container.innerHTML = bookings.map(b => {
      let isUnavailable = b.status.includes("недоступен") || b.status.includes("Перенос");
      let statusColor = "var(--yellow)";
      if (b.status === "Одобрена" || b.status === "Активна") statusColor = "var(--green-neon)";
      if (b.status.includes("Отменен") || b.status.includes("Отклонен")) statusColor = "var(--red)";

      const isCancelable = ["На рассмотрении", "Одобрена", "Активна"].includes(b.status) || isUnavailable;

      return `
        <div class="cyber-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:700;">ЗАПИСЬ №${b.id}</span>
            <span style="font-size:11px;font-weight:700;color:${statusColor};text-transform:uppercase;">[ ${b.status} ]</span>
          </div>
          <div style="font-size:12px;color:var(--text-2);line-height:1.4;">
            <div><strong>Услуга:</strong> ${b.problem}</div>
            <div><strong>Автомобиль:</strong> ${b.car_model} ${b.car_number ? `(${b.car_number})` : ''}</div>
            <div><strong>Время:</strong> ${b.slot}</div>
            ${b.comment ? `<div style="margin-top:4px;padding:6px;background:rgba(255,42,95,0.08);border-radius:4px;"><strong style="color:var(--pink);">Сообщение:</strong> <em>${b.comment}</em></div>` : ''}
          </div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            ${isUnavailable ? `<button class="cyber-btn-primary reschedule-btn" data-id="${b.id}" style="padding:6px 10px;font-size:11px;">🔄 ВЫБРАТЬ ДРУГОЕ ВРЕМЯ</button>` : ''}
            ${isCancelable ? `<button class="cyber-btn-secondary cancel-btn" data-id="${b.id}" style="padding:6px 10px;font-size:11px;color:var(--red);">ОТМЕНИТЬ</button>` : ''}
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".reschedule-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeRescheduleBookingId = parseInt(btn.dataset.id);
        switchTab("booking");
        goToStep(2);
        showToast(`🔄 ПЕРЕНОС ЗАПИСИ №${activeRescheduleBookingId}`);
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
        showToast("✅ Запись отменена");
        loadUserProfile();
      } else {
        showToast("⚠️ " + (data.error || "Ошибка"));
      }
    } catch (e) {
      showToast("⚠️ Ошибка соединения");
    }
  }

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
      <div class="cyber-summary-row">
        <span class="cyber-summary-lbl">🛠 РАБОТЫ:</span>
        <span class="cyber-summary-val">${problemText}</span>
      </div>
      <div class="cyber-summary-row">
        <span class="cyber-summary-lbl">👨‍🔧 МАСТЕР:</span>
        <span class="cyber-summary-val" style="color:var(--pink);">${selectedMasterName}</span>
      </div>
      <div class="cyber-summary-row">
        <span class="cyber-summary-lbl">📅 ДАТА И ВРЕМЯ:</span>
        <span class="cyber-summary-val" style="color:var(--pink);">${selectedSlot || "Не выбрано"}</span>
      </div>
      <div class="cyber-summary-row">
        <span class="cyber-summary-lbl">🚗 АВТОМОБИЛЬ:</span>
        <span class="cyber-summary-val">${carModel || "Не указан"} ${carNumber ? `(${carNumber})` : ""}</span>
      </div>
    `;
  }

  const editPhoneBtn = document.getElementById("edit-phone-btn");
  const phoneInput = document.getElementById("phone-number");

  if (editPhoneBtn && phoneInput) {
    editPhoneBtn.addEventListener("click", () => {
      phoneInput.removeAttribute("readonly");
      phoneInput.focus();
      phoneInput.select();
      showToast("✏️ Введите нужный номер");
    });
  }

  if (toStep2Btn) {
    toStep2Btn.addEventListener("click", () => {
      const checkedProblems = Array.from(selectedProblemsSet);
      const customProblems = Object.values(customCategoryInputs).map(v => v.trim()).filter(v => v.length > 0);
      const allProblems = [...checkedProblems, ...customProblems];

      let problem = "";
      if (allProblems.length > 0) {
        problem = allProblems.join(", ");
      } else if (document.getElementById("custom-problem")) {
        problem = document.getElementById("custom-problem").value.trim();
      }

      if (!problem) {
        showToast("⚠️ Выберите или опишите проблему!");
        return;
      }
      goToStep(2);
    });
  }

  if (toStep3Btn) {
    toStep3Btn.addEventListener("click", () => {
      if (!selectedSlot) {
        showToast("⚠️ Выберите время записи!");
        return;
      }
      goToStep(3);
      setTimeout(() => {
        const carInput = document.getElementById("car-model");
        if (carInput) carInput.focus();
      }, 100);
    });
  }

  if (toStep4Btn) {
    toStep4Btn.addEventListener("click", () => {
      const carModel = document.getElementById("car-model").value.trim();
      if (!carModel || carModel.length < 2) {
        showToast("⚠️ Укажите марку и модель авто!");
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

  const bookingForm = document.getElementById("booking-form");
  const submitBtn = document.getElementById("submit-booking-btn");

  bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const checkedProblems = Array.from(selectedProblemsSet);
    const customProblems = Object.values(customCategoryInputs).map(v => v.trim()).filter(v => v.length > 0);
    const allProblems = [...checkedProblems, ...customProblems];

    let problem = "";
    if (allProblems.length > 0) {
      problem = allProblems.join(", ");
    } else if (document.getElementById("custom-problem")) {
      problem = document.getElementById("custom-problem").value.trim();
    }

    const carModel = document.getElementById("car-model").value.trim();
    const carNumber = document.getElementById("car-number") ? document.getElementById("car-number").value.trim().toUpperCase() : "";
    const phone = document.getElementById("phone-number").value.trim();
    const privacyAgree = document.getElementById("privacy-agree");

    if (!problem) { showToast("⚠️ Опишите проблему!"); goToStep(1); return; }
    if (!carModel) { showToast("⚠️ Укажите марку и модель авто!"); goToStep(2); return; }
    if (!phone) { showToast("⚠️ Укажите телефон!"); return; }
    if (privacyAgree && !privacyAgree.checked) { showToast("⚠️ Примите Соглашение!"); return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳ ОТПРАВКА...</span>`;

    try {
      if (!BACKEND_URL) {
        showToast("⚠️ Ошибка адреса бэкенда!");
        return;
      }

      const targetSlot = `${selectedSlot} (Мастер: ${selectedMasterName})`;

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
          showToast(`🎉 ЗАПИСЬ №${activeRescheduleBookingId} ПЕРЕНЕСЕНА!`);
          activeRescheduleBookingId = null;
          switchTab("profile");
          return;
        } else {
          showToast("⚠️ " + (data.error || "Ошибка переноса"));
          submitBtn.disabled = false;
          submitBtn.innerHTML = `🚀 ПОДТВЕРДИТЬ ЗАПИСЬ`;
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
        showToast(`🎉 ЗАЯВКА №${data.booking_id} СОЗДАНА!`);
        bookingForm.reset();
        selectedProblemsSet.clear();
        Object.keys(customCategoryInputs).forEach(k => delete customCategoryInputs[k]);
        renderCategoryAccordion();
        goToStep(1);
        setTimeout(() => {
          switchTab("profile");
        }, 1000);
      } else {
        showToast("⚠️ " + (data.error || "Ошибка создания"));
      }
    } catch (err) {
      console.error("Submit error:", err);
      showToast("⚠️ Ошибка соединения с бэкендом");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `🚀 ПОДТВЕРДИТЬ ЗАПИСЬ`;
    }
  });

  function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 3200);
  }

  // ADMIN LOGIC
  const adminPills = document.querySelectorAll("#admin-status-pills button");
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
      container.innerHTML = `<div class="cyber-card"><p style="text-align: center; color: var(--text-2);">Ошибка модерации</p></div>`;
    }
  }

  function renderAdminBookings(bookings) {
    const container = document.getElementById("admin-bookings-list");
    if (!container) return;

    if (!bookings || bookings.length === 0) {
      container.innerHTML = `<div class="cyber-card"><p style="text-align: center; color: var(--text-2);">Заявок не найдено.</p></div>`;
      return;
    }

    container.innerHTML = bookings.map(b => {
      let isPending = b.status === "На рассмотрении";
      let actionsHtml = isPending ? `
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button class="cyber-btn-primary admin-btn-approve" data-id="${b.id}" style="padding:6px 10px;font-size:11px;">✅ ОДОБРИТЬ</button>
          <button class="cyber-btn-secondary admin-btn-reject" data-id="${b.id}" style="padding:6px 10px;font-size:11px;color:var(--red);">❌ ОТКЛОНИТЬ</button>
          <button class="cyber-btn-secondary admin-btn-delete" data-id="${b.id}" style="padding:6px 10px;font-size:11px;">🗑 УДАЛИТЬ</button>
        </div>
      ` : `
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button class="cyber-btn-secondary admin-btn-delete" data-id="${b.id}" style="padding:6px 10px;font-size:11px;">🗑 УДАЛИТЬ</button>
        </div>
      `;

      return `
        <div class="cyber-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:13px;font-weight:700;">ЗАПИСЬ №${b.id}</span>
            <span style="font-size:11px;font-weight:700;color:var(--pink);">[ ${b.status} ]</span>
          </div>
          <div style="font-size:11px;color:var(--text-2);">👤 <strong>${b.user_name}</strong> | 📞 ${b.phone}</div>
          <div style="font-size:12px;color:var(--text-2);margin-top:4px;">
            <div><strong>Услуга:</strong> ${b.problem}</div>
            <div><strong>Авто:</strong> ${b.car_model} ${b.car_number ? `(${b.car_number})` : ''}</div>
            <div><strong>Время:</strong> ${b.slot}</div>
            ${b.comment ? `<div><strong>Прим.:</strong> <em>${b.comment}</em></div>` : ''}
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

  const modal = document.getElementById("admin-modal");
  const modalComment = document.getElementById("modal-comment");
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");

  function openAdminModal(bookingId, action) {
    pendingAdminAction = { bookingId, action };
    const title = action === "approve" ? `ОДОБРИТЬ ЗАПИСЬ №${bookingId}` : `ОТКЛОНИТЬ ЗАПИСЬ №${bookingId}`;
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
    if (confirm(`Удалить запись №${bookingId}?`)) {
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
        showToast(`✅ Выполнено`);
        loadAdminBookings(currentAdminFilter);
      } else {
        showToast("⚠️ " + (data.error || "Ошибка"));
      }
    } catch (e) {
      showToast("⚠️ Ошибка соединения");
    }
  }

  let selectedAdmMaster = "Алексей Смирнов";

  const admMasterSelector = document.getElementById("adm-masters-selector");
  if (admMasterSelector) {
    admMasterSelector.querySelectorAll(".cyber-checkbox-row").forEach(chip => {
      chip.addEventListener("click", () => {
        admMasterSelector.querySelectorAll(".cyber-checkbox-row").forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
        selectedAdmMaster = chip.dataset.master;
      });
    });
  }

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

      if (!selectedAdmMaster) { showToast("⚠️ Выберите мастера!"); return; }
      if (!rawDate) { showToast("⚠️ Укажите дату!"); return; }

      if (!confirm(`Отменить смену мастера "${selectedAdmMaster}" на ${formattedDateTarget}?`)) {
        return;
      }

      admTriggerRescheduleBtn.disabled = true;
      admTriggerRescheduleBtn.innerHTML = "<span>⏳ ОТПРАВКА...</span>";

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
          showToast(`✅ Смена мастера отменена (${data.affected_count} затронуто)!`);
          loadAdminBookings(currentAdminFilter);
        } else {
          showToast("⚠️ " + (data.error || "Ошибка"));
        }
      } catch (e) {
        showToast("⚠️ Ошибка соединения");
      } finally {
        admTriggerRescheduleBtn.disabled = false;
        admTriggerRescheduleBtn.innerHTML = "⚠️ СНЯТЬ МАСТЕРА И УВЕДОМИТЬ КЛИЕНТОВ";
      }
    });
  }

});
