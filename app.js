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
  if (greetingEl) greetingEl.textContent = userName;

  const profileNameEl = document.getElementById("profile-name");
  if (profileNameEl) profileNameEl.textContent = userName;

  let isAdmin = false;
  let currentAdminFilter = "all";
  let pendingAdminAction = null;

  // Active Rescheduling Booking ID state
  let activeRescheduleBookingId = null;

  // Auto-Sliding Carousel Controller
  const carouselTrack = document.getElementById("carousel-track");
  const dots = document.querySelectorAll(".af-dot");
  let currentSlide = 0;
  const totalSlides = 3;
  let autoSlideTimer = null;

  function updateCarousel(slideIndex) {
    currentSlide = (slideIndex + totalSlides) % totalSlides;
    if (carouselTrack) {
      carouselTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
    }
    dots.forEach((dot, idx) => {
      dot.classList.toggle("active", idx === currentSlide);
    });
  }

  function startAutoSlide() {
    stopAutoSlide();
    autoSlideTimer = setInterval(() => {
      updateCarousel(currentSlide + 1);
    }, 4000);
  }

  function stopAutoSlide() {
    if (autoSlideTimer) clearInterval(autoSlideTimer);
  }

  dots.forEach(dot => {
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(dot.dataset.index, 10);
      updateCarousel(idx);
      startAutoSlide();
    });
  });

  if (carouselTrack) {
    startAutoSlide();
    carouselTrack.addEventListener("mouseenter", stopAutoSlide);
    carouselTrack.addEventListener("mouseleave", startAutoSlide);
    carouselTrack.addEventListener("touchstart", stopAutoSlide);
    carouselTrack.addEventListener("touchend", startAutoSlide);
  }

  // ═══════════════════════════════════════════════════════════
  // WELCOME SCREEN HANDLER (Always shows on open)
  // Arrow button requests phone if new user, or proceeds to main menu
  // ═══════════════════════════════════════════════════════════
  const welcomeOverlay = document.getElementById("triton-onboarding-screen");
  const welcomeArrowBtn = document.getElementById("onboarding-next-btn");

  if (welcomeOverlay) {
    welcomeOverlay.classList.remove("hidden");
  }

  function closeWelcomeScreen() {
    if (welcomeOverlay) {
      welcomeOverlay.classList.add("hidden");
    }
  }

  if (welcomeArrowBtn) {
    welcomeArrowBtn.addEventListener("click", () => {
      const savedPhone = localStorage.getItem("user_phone_saved");

      if (!savedPhone && tg && typeof tg.requestContact === "function") {
        tg.requestContact((sent, event) => {
          if (sent && event && event.responseUnsafe && event.responseUnsafe.contact) {
            const raw = event.responseUnsafe.contact.phone_number;
            const formatted = "+" + raw.replace(/\D/g, "");
            localStorage.setItem("user_phone_saved", formatted);
            const phoneInputEl = document.getElementById("phone-number");
            if (phoneInputEl) phoneInputEl.value = formatted;
            showToast("✅ Номер телефона сохранен!");
          }
          closeWelcomeScreen();
        });
      } else {
        closeWelcomeScreen();
      }
    });
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
        const adminPanelSection = document.getElementById("admin-panel-section");
        if (adminProfileBtn) {
          adminProfileBtn.classList.remove("hidden");
          adminProfileBtn.addEventListener("click", () => {
            if (adminPanelSection) adminPanelSection.classList.toggle("hidden");
            loadAdminBookings(currentAdminFilter);
          });
        }
      }
    } catch (e) {
      console.error("Admin check error:", e);
    }
  }
  checkAdminStatus();

  // Navigation Tab Switching
  const navItems = document.querySelectorAll(".af-nav-item");
  const tabContents = document.querySelectorAll(".tab-content");

  function switchTab(tabName) {
    navItems.forEach(item => {
      item.classList.toggle("active", item.dataset.tab === tabName);
    });
    tabContents.forEach(content => {
      const targetId = content.id === `tab-${tabName}` || (tabName === "bookings-list" && content.id === "tab-bookings-list");
      content.classList.toggle("active", targetId);
    });

    if (tabName === "profile" || tabName === "home" || tabName === "bookings-list") {
      loadUserProfile();
    } else if (tabName === "booking") {
      loadSlots();
    }
  }

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      if (item.dataset.tab !== "booking" && activeRescheduleBookingId) {
        clearRescheduleMode();
      }
      switchTab(item.dataset.tab);
      if (item.dataset.tab === "booking" && item.dataset.step) {
        goToStep(parseInt(item.dataset.step, 10));
      }
    });
  });

  const topUserProfileBtn = document.getElementById("top-user-profile-btn");
  if (topUserProfileBtn) {
    topUserProfileBtn.addEventListener("click", () => {
      if (activeRescheduleBookingId) clearRescheduleMode();
      switchTab("profile");
    });
  }

  document.querySelectorAll("[data-tab]").forEach(card => {
    card.addEventListener("click", () => {
      if (card.classList.contains("af-nav-item")) return;
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

  // Services Categories Data
  const SERVICE_CATEGORIES = [
    {
      id: "cat_engine",
      icon: "🔧",
      title: "Двигатель и выхлопная система",
      sub: "Диагностика, ГРМ, масло, выхлоп",
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
      icon: "🛞",
      title: "Подвеска и тормозная система",
      sub: "Колодки, диски, амортизаторы, шиномонтаж",
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
      icon: "⚡",
      title: "Электрика и автоэлектроника",
      sub: "Диагностика, АКБ, стартер, сигнализация",
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
      icon: "🛢",
      title: "Регулярное ТО и масляный сервис",
      sub: "Комплексное ТО, замена жидкостей",
      items: [
        { title: "Комплексное ТО (масло + 3 фильтра)", price: "от 3 500 ₽" },
        { title: "Замена масла в АКПП / МКПП", price: "от 3 000 ₽" },
        { title: "Замена антифриза / охл. жидкости", price: "от 1 800 ₽" },
        { title: "Замена тормозной жидкости", price: "от 1 500 ₽" }
      ]
    },
    {
      id: "cat_climate",
      icon: "❄️",
      title: "Климат и кондиционер",
      sub: "Заправка, дезинфекция, радиаторы",
      items: [
        { title: "Диагностика и заправка кондиционера", price: "от 2 000 ₽" },
        { title: "Антибактериальная чистка кондиционера", price: "от 1 500 ₽" },
        { title: "Замена радиатора печки / кондиционера", price: "от 4 000 ₽" }
      ]
    }
  ];

  const selectedProblemsSet = new Set();
  const customCategoryInputs = {};

  let activeCategoryId = null;

  const catOverviewView = document.getElementById("cat-overview-view");
  const catSubservicesView = document.getElementById("cat-subservices-view");
  const categoriesCardsContainer = document.getElementById("categories-cards-container");
  const subservicesListContainer = document.getElementById("subservices-list-container");
  const selectedCatTitleBadge = document.getElementById("selected-cat-title-badge");
  const backToCategoriesBtn = document.getElementById("back-to-categories-btn");
  const wizardSearchInput = document.getElementById("wizard-search-input");

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
      <div class="af-card" style="margin-top:8px;">
        <div style="font-size:13px;font-weight:800;color:var(--green);">✅ Выбранные услуги (${items.length}):</div>
        <ul style="font-size:13px;color:var(--dark);padding-left:18px;margin-top:4px;">
          ${items.map(i => `<li style="margin-bottom:3px;">${i}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function renderCategoryCardsOverview(query = "") {
    if (!categoriesCardsContainer) return;
    const filterQuery = query.toLowerCase().trim();

    categoriesCardsContainer.innerHTML = SERVICE_CATEGORIES.map(cat => {
      const matchQuery = !filterQuery ||
        cat.title.toLowerCase().includes(filterQuery) ||
        cat.items.some(i => i.title.toLowerCase().includes(filterQuery));

      if (!matchQuery) return "";

      const countSelected = cat.items.filter(i => selectedProblemsSet.has(i.title)).length;
      const badgeText = countSelected > 0 ? ` · Выбрано: ${countSelected}` : "";

      return `
        <div class="af-cat-card" data-cat-id="${cat.id}">
          <div class="af-cat-card-left">
            <div class="af-cat-icon">${cat.icon}</div>
            <div class="af-cat-info">
              <div class="af-cat-title">${cat.title}</div>
              <div class="af-cat-count">${cat.items.length} услуг${badgeText}</div>
            </div>
          </div>
          <div class="af-cat-arrow">➔</div>
        </div>
      `;
    }).join("");

    categoriesCardsContainer.querySelectorAll(".af-cat-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.catId;
        openCategorySubservices(id);
      });
    });
  }

  function openCategorySubservices(catId) {
    const cat = SERVICE_CATEGORIES.find(c => c.id === catId);
    if (!cat) return;

    activeCategoryId = catId;

    if (selectedCatTitleBadge) {
      selectedCatTitleBadge.textContent = `${cat.icon} ${cat.title}`;
    }

    renderSubservicesList(cat);

    if (catOverviewView) catOverviewView.classList.add("hidden");
    if (catSubservicesView) catSubservicesView.classList.remove("hidden");
  }

  function renderSubservicesList(cat) {
    if (!subservicesListContainer) return;

    const customVal = customCategoryInputs[cat.id] || "";

    subservicesListContainer.innerHTML = `
      ${cat.items.map(item => {
        const isChecked = selectedProblemsSet.has(item.title);
        return `
          <div class="af-service-check-row ${isChecked ? 'selected' : ''}" data-title="${item.title}">
            <div class="af-service-check-left">
              <div class="af-checkbox-badge">${isChecked ? '✓' : ''}</div>
              <span class="af-service-name">${item.title}</span>
            </div>
            <span class="af-service-tag-price">${item.price}</span>
          </div>
        `;
      }).join("")}

      <div class="af-card" style="margin-top:4px;">
        <label class="af-label">Или опишите проблему своими словами:</label>
        <input
          type="text"
          id="custom-cat-input-field"
          class="af-input"
          placeholder="Например: Стук справа при повороте руля..."
          value="${customVal}"
        />
      </div>
    `;

    subservicesListContainer.querySelectorAll(".af-service-check-row").forEach(rowEl => {
      rowEl.addEventListener("click", () => {
        const title = rowEl.dataset.title;
        if (!title) return;

        if (selectedProblemsSet.has(title)) {
          selectedProblemsSet.delete(title);
          rowEl.classList.remove("selected");
          rowEl.querySelector(".af-checkbox-badge").textContent = "";
        } else {
          selectedProblemsSet.add(title);
          rowEl.classList.add("selected");
          rowEl.querySelector(".af-checkbox-badge").textContent = "✓";
        }

        updateEstimatedTotalPrice();
        renderSelectedSummary();
        renderCategoryCardsOverview(wizardSearchInput ? wizardSearchInput.value : "");
      });
    });

    const customInput = document.getElementById("custom-cat-input-field");
    if (customInput) {
      customInput.addEventListener("input", (e) => {
        customCategoryInputs[cat.id] = e.target.value;
        renderSelectedSummary();
      });
    }
  }

  function showCategoriesOverview() {
    activeCategoryId = null;
    if (catOverviewView) catOverviewView.classList.remove("hidden");
    if (catSubservicesView) catSubservicesView.classList.add("hidden");
    renderCategoryCardsOverview(wizardSearchInput ? wizardSearchInput.value : "");
  }

  if (backToCategoriesBtn) {
    backToCategoriesBtn.addEventListener("click", showCategoriesOverview);
  }

  renderCategoryCardsOverview();

  if (wizardSearchInput) {
    wizardSearchInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      if (val.length > 0) {
        showCategoriesOverview();
      }
      renderCategoryCardsOverview(val);
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
      avatar: "👨‍🔧"
    },
    {
      id: "master_alexey",
      name: "Алексей Смирнов",
      role: "Старший механик (Двигатель и ТО)",
      avatar: "👨‍🔧"
    },
    {
      id: "master_dmitry",
      name: "Дмитрий Ковалев",
      role: "Диагност-автоэлектрик",
      avatar: "⚡"
    },
    {
      id: "master_igor",
      name: "Игорь Соколов",
      role: "Мастер по ходовой части",
      avatar: "🛞"
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
        <div class="af-master-card ${isSelected ? 'selected' : ''}" data-master-id="${m.id}">
          <div class="af-master-avatar">${m.avatar}</div>
          <div>
            <div class="af-master-name">${m.name}</div>
            <div class="af-master-role">${m.role}</div>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".af-master-card").forEach(card => {
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
      daysHtml += `<div class="af-cal-day empty"></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
      const cellDate = new Date(calendarYear, calendarMonth, day);
      const isToday = (cellDate.toDateString() === todayObj.toDateString());
      const isPast = (cellDate < new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate()));
      const isSelected = (cellDate.toDateString() === selectedDateObj.toDateString());

      let classes = "af-cal-day";
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
      <div class="af-cal-header">
        <button type="button" class="af-cal-btn" id="cal-prev-month" ${isPrevDisabled ? 'disabled' : ''}>‹</button>
        <span class="af-cal-title">${MONTH_NAMES_RU[calendarMonth]} ${calendarYear}</span>
        <button type="button" class="af-cal-btn" id="cal-next-month">›</button>
      </div>
      <div class="af-cal-weekdays">
        <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
      </div>
      <div class="af-cal-grid">
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

    container.querySelectorAll(".af-cal-day:not(.past):not(.empty)").forEach(cell => {
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
      dateBadge.textContent = selectedDateLabel;
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
      label.textContent = `Свободное время на ${selectedDateLabel} (${selectedMasterName}):`;
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
        return `<div class="af-slot-item booked">${time}</div>`;
      }

      return `<div class="af-slot-item ${isSelected ? 'active' : ''}" data-time="${time}">${time}</div>`;
    }).join("");

    container.querySelectorAll(".af-slot-item:not(.booked)").forEach(item => {
      item.addEventListener("click", () => {
        container.querySelectorAll(".af-slot-item").forEach(i => i.classList.remove("active"));
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

  // ═══════════════════════════════════════════════════════════
  // RESCHEDULING FAST-TRACK LOGIC (Automatic Approval & Confirmation)
  // ═══════════════════════════════════════════════════════════

  function startRescheduleMode(bookingId) {
    activeRescheduleBookingId = parseInt(bookingId, 10);

    const noticeBadge = document.getElementById("reschedule-notice-badge");
    const noticeTitle = document.getElementById("reschedule-notice-title");
    const toStep3Btn = document.getElementById("to-step-3-btn");
    const confirmRescheduleBtn = document.getElementById("confirm-reschedule-btn");
    const backToStep1Btn = document.getElementById("back-to-step-1-btn");

    if (noticeBadge) noticeBadge.classList.remove("hidden");
    if (noticeTitle) noticeTitle.textContent = `🔄 Перенос записи №${activeRescheduleBookingId}`;
    if (toStep3Btn) toStep3Btn.classList.add("hidden");
    if (confirmRescheduleBtn) confirmRescheduleBtn.classList.remove("hidden");
    if (backToStep1Btn) backToStep1Btn.textContent = "❌ Отмена";

    switchTab("booking");
    goToStep(2);
    loadSlots();
  }

  function clearRescheduleMode() {
    activeRescheduleBookingId = null;

    const noticeBadge = document.getElementById("reschedule-notice-badge");
    const toStep3Btn = document.getElementById("to-step-3-btn");
    const confirmRescheduleBtn = document.getElementById("confirm-reschedule-btn");
    const backToStep1Btn = document.getElementById("back-to-step-1-btn");

    if (noticeBadge) noticeBadge.classList.add("hidden");
    if (toStep3Btn) toStep3Btn.classList.remove("hidden");
    if (confirmRescheduleBtn) confirmRescheduleBtn.classList.add("hidden");
    if (backToStep1Btn) backToStep1Btn.textContent = "← Назад";
  }

  const confirmRescheduleBtn = document.getElementById("confirm-reschedule-btn");
  if (confirmRescheduleBtn) {
    confirmRescheduleBtn.addEventListener("click", async () => {
      if (!selectedSlot) {
        showToast("⚠️ Выберите новое время записи!");
        return;
      }
      if (!activeRescheduleBookingId) return;

      confirmRescheduleBtn.disabled = true;
      confirmRescheduleBtn.textContent = "⏳ Сохранение...";

      try {
        const targetSlot = `${selectedSlot} (Мастер: ${selectedMasterName})`;
        const res = await fetch(`${BACKEND_URL}/api/booking/reschedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: activeRescheduleBookingId,
            user_id: userId,
            new_slot: targetSlot,
            status: "Одобрена"
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`🎉 Запись №${activeRescheduleBookingId} подтверждена на ${selectedSlot}!`);
          clearRescheduleMode();
          await loadUserProfile();
          switchTab("bookings-list");
        } else {
          showToast("⚠️ " + (data.error || "Ошибка переноса"));
        }
      } catch (e) {
        showToast("⚠️ Ошибка соединения");
      } finally {
        confirmRescheduleBtn.disabled = false;
        confirmRescheduleBtn.textContent = "🔄 Подтвердить перенос записи";
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // HOME TAB ACTIVE BOOKING COUNTDOWN & REMINDER
  // ═══════════════════════════════════════════════════════════
  let activeCountdownInterval = null;

  function parseBookingDate(slotStr) {
    if (!slotStr) return null;
    const months = {
      "января": 0, "февраля": 1, "марта": 2, "апреля": 3, "мая": 4, "июня": 5,
      "июля": 6, "августа": 7, "сентября": 8, "октября": 9, "ноября": 10, "декабря": 11
    };

    const cleanStr = slotStr.toLowerCase();
    const parts = cleanStr.match(/(\d{1,2})\s+([а-я]+)(?:\s+(\d{4}))?\s+в\s+(\d{1,2}):(\d{2})/);
    if (!parts) return null;

    const day = parseInt(parts[1], 10);
    const month = months[parts[2]];
    if (month === undefined) return null;
    const year = parts[3] ? parseInt(parts[3], 10) : new Date().getFullYear();
    const hours = parseInt(parts[4], 10);
    const minutes = parseInt(parts[5], 10);

    return new Date(year, month, day, hours, minutes);
  }

  function startCountdownTimer(targetDate, valElement) {
    if (activeCountdownInterval) clearInterval(activeCountdownInterval);

    function update() {
      const now = new Date();
      const diffMs = targetDate - now;

      if (diffMs <= 0) {
        valElement.textContent = "🚗 Визит на автосервис!";
        clearInterval(activeCountdownInterval);
        return;
      }

      const totalSec = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      if (days > 0) {
        valElement.textContent = `${days} дн. ${hours} ч. ${mins} мин.`;
      } else {
        const pad = (n) => String(n).padStart(2, '0');
        valElement.textContent = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
      }
    }

    update();
    activeCountdownInterval = setInterval(update, 1000);
  }

  function updateHomeActiveBookingCard(bookings) {
    const container = document.getElementById("home-active-booking-container");
    if (!container) return;

    if (activeCountdownInterval) clearInterval(activeCountdownInterval);

    const activeBooking = (bookings || []).find(b =>
      b.status === "Одобрена" || b.status === "Активна" || b.status === "На рассмотрении"
    );

    if (!activeBooking) {
      container.innerHTML = `
        <div class="af-no-booking-card">
          <div class="af-no-booking-icon">📅</div>
          <div class="af-no-booking-text">
            <strong>Нет ближайших записей</strong><br>
            Запишитесь на ТО или ремонт в 2 клика!
          </div>
        </div>
      `;
      return;
    }

    // Rescheduled or approved bookings automatically show as confirmed
    const isApproved = activeBooking.status === "Одобрена" || activeBooking.status === "Активна" || activeBooking.status.includes("Перенесена");
    const statusClass = isApproved ? "approved" : "pending";
    const statusLabel = isApproved ? "✅ Подтверждена" : "⏳ На рассмотрении";

    container.innerHTML = `
      <div class="af-reminder-card">
        <div class="af-reminder-header">
          <span class="af-reminder-badge">📅 Запись №${activeBooking.id}</span>
          <span class="af-reminder-status-tag ${statusClass}">${statusLabel}</span>
        </div>

        <div class="af-reminder-title">${activeBooking.problem}</div>

        <div class="af-reminder-meta">
          <div>📍 AutoFriends Service · ${activeBooking.slot}</div>
          <div>🚘 Авто: ${activeBooking.car_model} ${activeBooking.car_number ? `(${activeBooking.car_number})` : ''}</div>
        </div>

        <div class="af-countdown-box">
          <span class="af-countdown-label">⏳ До визита:</span>
          <span class="af-countdown-value" id="home-countdown-val">Считаем...</span>
        </div>

        <div class="af-reminder-actions">
          <button type="button" class="af-reminder-btn af-reminder-btn-secondary" id="home-view-bookings-btn">
            📋 Записи
          </button>
          <button type="button" class="af-reminder-btn af-reminder-btn-secondary" id="home-reschedule-btn" data-id="${activeBooking.id}">
            🔄 Перенести
          </button>
          <button type="button" class="af-reminder-btn af-reminder-btn-secondary" id="home-cancel-booking-btn" data-id="${activeBooking.id}" style="color:var(--red);">
            ❌ Отменить
          </button>
        </div>
      </div>
    `;

    const countdownValEl = document.getElementById("home-countdown-val");
    const targetDate = parseBookingDate(activeBooking.slot);

    if (targetDate && countdownValEl) {
      startCountdownTimer(targetDate, countdownValEl);
    } else if (countdownValEl) {
      countdownValEl.textContent = activeBooking.slot;
    }

    const viewBtn = document.getElementById("home-view-bookings-btn");
    if (viewBtn) {
      viewBtn.addEventListener("click", () => switchTab("bookings-list"));
    }

    const rescheduleBtn = document.getElementById("home-reschedule-btn");
    if (rescheduleBtn) {
      rescheduleBtn.addEventListener("click", () => {
        startRescheduleMode(activeBooking.id);
      });
    }

    const cancelBtn = document.getElementById("home-cancel-booking-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async () => {
        if (confirm(`Отменить запись №${activeBooking.id}?`)) {
          await cancelBooking(activeBooking.id);
        }
      });
    }
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
      updateHomeActiveBookingCard(data.bookings || []);
    } catch (e) {
      console.error(e);
    }
  }

  // Load user profile on startup
  loadUserProfile();

  function renderUserBookings(bookings) {
    const container = document.getElementById("user-bookings-list");
    if (!container) return;

    if (!bookings || bookings.length === 0) {
      container.innerHTML = `<div class="af-card"><p style="text-align: center; color: var(--gray-3);">У вас пока нет активных записей.</p></div>`;
      return;
    }

    container.innerHTML = bookings.map(b => {
      let isUnavailable = b.status.includes("недоступен") || b.status.includes("Перенос");
      let displayStatus = b.status;
      let statusColor = "var(--yellow)";
      let isCancelled = b.status.includes("Отменен") || b.status.includes("Отклонен");
      
      if (b.status === "Одобрена" || b.status === "Активна" || b.status.includes("Перенесена")) {
        displayStatus = "✅ Подтверждена";
        statusColor = "var(--green)";
      } else if (isCancelled) {
        displayStatus = "❌ Отменена";
        statusColor = "var(--red)";
      }

      const isCancelable = ["На рассмотрении", "Одобрена", "Активна"].includes(b.status) || isUnavailable;

      return `
        <div class="af-card" style="${isCancelled ? 'opacity:0.75;' : ''}">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:14px;font-weight:800;">Запись №${b.id}</span>
            <span style="font-size:12px;font-weight:700;color:${statusColor};">${displayStatus}</span>
          </div>
          <div style="font-size:13px;color:var(--gray-2);line-height:1.45;">
            <div><strong>Услуга:</strong> ${b.problem}</div>
            <div><strong>Авто:</strong> ${b.car_model} ${b.car_number ? `(${b.car_number})` : ''}</div>
            <div><strong>Время:</strong> ${b.slot}</div>
            ${b.comment ? `<div style="margin-top:4px;padding:6px;background:var(--bg-pill);border-radius:6px;"><strong>Примечание:</strong> ${b.comment}</div>` : ''}
          </div>
          ${!isCancelled ? `
            <div style="display:flex;gap:6px;margin-top:4px;">
              ${isUnavailable ? `<button class="af-btn-primary reschedule-btn" data-id="${b.id}" style="padding:6px 12px;font-size:12px;">Выбрать другое время</button>` : `<button class="af-btn-secondary reschedule-btn" data-id="${b.id}" style="padding:6px 12px;font-size:12px;">🔄 Перенести</button>`}
              ${isCancelable ? `<button class="af-btn-secondary cancel-btn" data-id="${b.id}" style="padding:6px 12px;font-size:12px;color:var(--red);">❌ Отменить</button>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join("");

    container.querySelectorAll(".reschedule-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        startRescheduleMode(btn.dataset.id);
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
        await loadUserProfile();
        if (isAdmin) loadAdminBookings(currentAdminFilter);
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
      <div class="af-summary-row">
        <span class="af-summary-lbl">Услуги:</span>
        <span class="af-summary-val">${problemText}</span>
      </div>
      <div class="af-summary-row">
        <span class="af-summary-lbl">Мастер:</span>
        <span class="af-summary-val">${selectedMasterName}</span>
      </div>
      <div class="af-summary-row">
        <span class="af-summary-lbl">Дата и время:</span>
        <span class="af-summary-val">${selectedSlot || "Не выбрано"}</span>
      </div>
      <div class="af-summary-row">
        <span class="af-summary-lbl">Автомобиль:</span>
        <span class="af-summary-val">${carModel || "Не указан"} ${carNumber ? `(${carNumber})` : ""}</span>
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

      if (allProblems.length === 0) {
        showToast("⚠️ Выберите хотя бы одну услугу!");
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
    });
  }

  if (toStep4Btn) {
    toStep4Btn.addEventListener("click", () => {
      const carModel = document.getElementById("car-model").value.trim();
      if (!carModel || carModel.length < 2) {
        showToast("⚠️ Укажите марку и модель авто!");
        return;
      }
      goToStep(4);
    });
  }

  if (backToStep1Btn) {
    backToStep1Btn.addEventListener("click", () => {
      if (activeRescheduleBookingId) {
        clearRescheduleMode();
        switchTab("bookings-list");
      } else {
        goToStep(1);
      }
    });
  }

  if (backToStep2Btn) backToStep2Btn.addEventListener("click", () => goToStep(2));
  if (backToStep3Btn) backToStep3Btn.addEventListener("click", () => goToStep(3));

  const bookingForm = document.getElementById("booking-form");
  const submitBtn = document.getElementById("submit-booking-btn");

  bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const checkedProblems = Array.from(selectedProblemsSet);
    const customProblems = Object.values(customCategoryInputs).map(v => v.trim()).filter(v => v.length > 0);
    const allProblems = [...checkedProblems, ...customProblems];
    const problem = allProblems.join(", ");

    const carModel = document.getElementById("car-model").value.trim();
    const carNumber = document.getElementById("car-number") ? document.getElementById("car-number").value.trim().toUpperCase() : "";
    const phone = document.getElementById("phone-number").value.trim();
    const privacyAgree = document.getElementById("privacy-agree");

    if (!problem) { showToast("⚠️ Выберите услугу!"); goToStep(1); return; }
    if (!carModel) { showToast("⚠️ Укажите марку авто!"); goToStep(3); return; }
    if (!phone) { showToast("⚠️ Укажите телефон!"); return; }
    if (privacyAgree && !privacyAgree.checked) { showToast("⚠️ Примите Соглашение!"); return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳ Отправка...</span>`;

    try {
      const targetSlot = `${selectedSlot} (Мастер: ${selectedMasterName})`;

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
        Object.keys(customCategoryInputs).forEach(k => delete customCategoryInputs[k]);
        showCategoriesOverview();
        goToStep(1);
        setTimeout(() => {
          switchTab("bookings-list");
        }, 1000);
      } else {
        showToast("⚠️ " + (data.error || "Ошибка создания"));
      }
    } catch (err) {
      console.error(err);
      showToast("⚠️ Ошибка соединения с серверным API");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `🚀 Подтвердить запись`;
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

  // Admin moderation logic
  async function loadAdminBookings(statusFilter = "all") {
    const container = document.getElementById("admin-bookings-list");
    if (!container) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/bookings?user_id=${userId}&status=${statusFilter}`);
      if (!res.ok) throw new Error("Access denied");
      const data = await res.json();
      renderAdminBookings(data.bookings || []);
    } catch (e) {
      container.innerHTML = `<div class="af-card"><p style="text-align:center;color:var(--gray-3);">Ошибка загрузки заявок</p></div>`;
    }
  }

  function renderAdminBookings(bookings) {
    const container = document.getElementById("admin-bookings-list");
    if (!container) return;

    if (!bookings || bookings.length === 0) {
      container.innerHTML = `<div class="af-card"><p style="text-align:center;color:var(--gray-3);">Заявок нет.</p></div>`;
      return;
    }

    container.innerHTML = bookings.map(b => {
      let isPending = b.status === "На рассмотрении";
      let isApproved = b.status === "Одобрена" || b.status === "Активна";
      let isCancelled = b.status.includes("Отменен") || b.status.includes("Отклонен");

      let statusColor = "var(--yellow)";
      let statusTag = "⏳ Ожидает";
      if (isApproved) { statusColor = "var(--green)"; statusTag = "✅ Одобрена"; }
      if (isCancelled) { statusColor = "var(--red)"; statusTag = "❌ Отменена"; }

      let actionsHtml = isPending ? `
        <div style="display:flex;gap:6px;margin-top:6px;">
          <button class="af-btn-primary admin-btn-approve" data-id="${b.id}" style="padding:6px 12px;font-size:12px;">✅ Одобрить</button>
          <button class="af-btn-secondary admin-btn-reject" data-id="${b.id}" style="padding:6px 12px;font-size:12px;color:var(--red);">❌ Отклонить</button>
        </div>
      ` : ``;

      return `
        <div class="af-card" style="${isCancelled ? 'opacity:0.7;' : ''}">
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:14px;font-weight:800;">Заявка №${b.id}</span>
            <span style="font-size:12px;font-weight:700;color:${statusColor};">${statusTag}</span>
          </div>
          <div style="font-size:13px;color:var(--gray-2);">
            <div><strong>Клиент:</strong> ${b.user_name} (${b.phone})</div>
            <div><strong>Услуга:</strong> ${b.problem}</div>
            <div><strong>Авто:</strong> ${b.car_model}</div>
            <div><strong>Время:</strong> ${b.slot}</div>
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
  }

  const modal = document.getElementById("admin-modal");
  const modalComment = document.getElementById("modal-comment");
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");

  function openAdminModal(bookingId, action) {
    pendingAdminAction = { bookingId, action };
    document.getElementById("modal-title").textContent = action === "approve" ? `Одобрить запись №${bookingId}` : `Отклонить запись №${bookingId}`;
    if (modalComment) modalComment.value = "";
    if (modal) modal.classList.remove("hidden");
  }

  if (modalCancelBtn) modalCancelBtn.addEventListener("click", () => modal.classList.add("hidden"));
  if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener("click", async () => {
      if (!pendingAdminAction) return;
      const { bookingId, action } = pendingAdminAction;
      const comment = modalComment ? modalComment.value.trim() : "";
      modal.classList.add("hidden");
      await executeAdminAction(bookingId, action, comment);
    });
  }

  async function executeAdminAction(bookingId, action, comment) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/booking/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: userId, booking_id: parseInt(bookingId), action: action, comment: comment })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("✅ Действие выполнено");
        loadAdminBookings(currentAdminFilter);
      }
    } catch (e) {
      showToast("⚠️ Ошибка вызова API");
    }
  }

  const admTriggerRescheduleBtn = document.getElementById("adm-trigger-reschedule-btn");
  if (admTriggerRescheduleBtn) {
    admTriggerRescheduleBtn.addEventListener("click", async () => {
      const masterSelect = document.getElementById("adm-master-select");
      const dateInput = document.getElementById("adm-off-date");
      const reasonInput = document.getElementById("adm-master-reason");

      const masterName = masterSelect ? masterSelect.value : "";
      const rawDate = dateInput ? dateInput.value : "";
      const reason = reasonInput ? reasonInput.value.trim() : "";

      if (!rawDate) { showToast("⚠️ Укажите дату!"); return; }

      const [y, m, d] = rawDate.split("-");
      const formattedDate = `${parseInt(d)} ${MONTH_NAMES_RU_GENITIVE[parseInt(m)-1]}`;

      if (!confirm(`Отменить смену мастера "${masterName}" на ${formattedDate}?`)) return;

      try {
        const res = await fetch(`${BACKEND_URL}/api/admin/master/reschedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ admin_id: userId, master_name: masterName, target_date: formattedDate, reason: reason })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`✅ Смена мастера отменена!`);
          loadAdminBookings(currentAdminFilter);
        }
      } catch (e) {
        showToast("⚠️ Ошибка соединения");
      }
    });
  }

});
