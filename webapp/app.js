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
            showToast("Номер телефона сохранен!");
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

  const privacyAgreeCheckbox = document.getElementById("privacy-agree");
  const submitBookingBtn = document.getElementById("submit-booking-btn");

  if (privacyAgreeCheckbox && submitBookingBtn) {
    submitBookingBtn.disabled = !privacyAgreeCheckbox.checked;
    privacyAgreeCheckbox.addEventListener("change", () => {
      submitBookingBtn.disabled = !privacyAgreeCheckbox.checked;
    });
  }

  const CATEGORY_ICONS_SVG = {
    cat_engine: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>`,
    cat_chassis: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>`,
    cat_electric: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    cat_to: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    cat_climate: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>`,
    cat_custom: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
  };

  const SERVICE_CATEGORIES = [
    {
      id: "cat_engine",
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
        <div style="font-size:13px;font-weight:800;color:var(--green);">Выбранные услуги (${items.length}):</div>
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
      const iconSvg = CATEGORY_ICONS_SVG[cat.id] || CATEGORY_ICONS_SVG['cat_custom'];

      return `
        <div class="af-cat-card" data-cat-id="${cat.id}">
          <div class="af-cat-card-left">
            <div class="af-cat-icon">
              ${iconSvg}
            </div>
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
      selectedCatTitleBadge.textContent = cat.title;
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
        <label class="af-label">Опишите проблему своими словами:</label>
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
      name: "Любой свободный мастер",
      role: "Ближайшее доступное время"
    },
    {
      id: "master_alexey",
      name: "Алексей Смирнов",
      role: "Старший механик (Двигатель и ТО)"
    },
    {
      id: "master_dmitry",
      name: "Дмитрий Ковалев",
      role: "Диагност-автоэлектрик"
    },
    {
      id: "master_igor",
      name: "Игорь Соколов",
      role: "Мастер по ходовой части"
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

  function startRescheduleMode(bookingId) {
    activeRescheduleBookingId = parseInt(bookingId, 10);

    const noticeBadge = document.getElementById("reschedule-notice-badge");
    const noticeTitle = document.getElementById("reschedule-notice-title");
    const toStep3Btn = document.getElementById("to-step-3-btn");
    const confirmRescheduleBtn = document.getElementById("confirm-reschedule-btn");
    const backToStep1Btn = document.getElementById("back-to-step-1-btn");

    if (noticeBadge) noticeBadge.classList.remove("hidden");
    if (noticeTitle) noticeTitle.textContent = `Перенос записи №${activeRescheduleBookingId}`;
    if (toStep3Btn) toStep3Btn.classList.add("hidden");
    if (confirmRescheduleBtn) confirmRescheduleBtn.classList.remove("hidden");
    if (backToStep1Btn) backToStep1Btn.textContent = "Отмена";

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
        showToast("Выберите новое время записи!");
        return;
      }
      if (!activeRescheduleBookingId) return;

      confirmRescheduleBtn.disabled = true;
      confirmRescheduleBtn.textContent = "Сохранение...";

      try {
        const targetSlot = `${selectedSlot} (Мастер: ${selectedMasterName})`;
        const res = await fetch(`${BACKEND_URL}/api/booking/reschedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: activeRescheduleBookingId,
            id: activeRescheduleBookingId,
            user_id: userId,
            telegram_id: userId,
            chat_id: userId,
            user_name: userName,
            name: userName,
            new_slot: targetSlot,
            status: "Одобрена",
            init_data: tg?.initData || "",
            initData: tg?.initData || "",
            notify_client: true,
            notify_admin: true
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`Запись №${activeRescheduleBookingId} подтверждена на ${selectedSlot}!`);
          clearRescheduleMode();
          await loadUserProfile();
          switchTab("bookings-list");
        } else {
          showToast(data.error || "Ошибка переноса");
        }
      } catch (e) {
        showToast("Ошибка соединения");
      } finally {
        confirmRescheduleBtn.disabled = false;
        confirmRescheduleBtn.textContent = "Подтвердить перенос записи";
      }
    });
  }

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
        valElement.textContent = "Визит на автосервис!";
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
      ["Одобрена", "Активна", "На рассмотрении"].includes(b.status)
    );

    if (!activeBooking) {
      container.innerHTML = `
        <div class="af-no-booking-card">
          <div class="af-no-booking-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="af-no-booking-text">
            <strong>Нет ближайших записей</strong><br>
            Запишитесь на ТО или ремонт в 2 клика!
          </div>
        </div>
      `;
      return;
    }

    let statusClass = "pending";
    let statusLabel = "На рассмотрении";
    if (activeBooking.status === "Одобрена" || activeBooking.status === "Активна") {
      statusClass = "approved";
      statusLabel = "Подтверждена";
    }

    container.innerHTML = `
      <div class="af-reminder-card">
        <div class="af-reminder-header">
          <span class="af-reminder-badge">Запись №${activeBooking.id}</span>
          <span class="af-reminder-status-tag ${statusClass}">${statusLabel}</span>
        </div>

        <div class="af-reminder-title">${activeBooking.problem}</div>

        <div class="af-reminder-meta">
          <div>📍 AutoFriends Service · ${activeBooking.slot}</div>
          <div>🚘 Авто: ${activeBooking.car_model} ${activeBooking.car_number ? `(${activeBooking.car_number})` : ''}</div>
        </div>

        <div class="af-countdown-box">
          <span class="af-countdown-label">До визита:</span>
          <span class="af-countdown-value" id="home-countdown-val">Считаем...</span>
        </div>

        <div class="af-reminder-actions">
          <button type="button" class="af-reminder-btn af-reminder-btn-secondary" id="home-view-bookings-btn">
            Записи
          </button>
          <button type="button" class="af-reminder-btn af-reminder-btn-secondary" id="home-reschedule-btn" data-id="${activeBooking.id}">
            Перенести
          </button>
          <button type="button" class="af-reminder-btn af-reminder-btn-secondary" id="home-cancel-booking-btn" data-id="${activeBooking.id}" style="color:var(--red);">
            Отменить
          </button>
          <a href="https://t.me/autofriends_service" target="_blank" class="af-reminder-btn af-reminder-btn-secondary" style="text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dark);">
            Поддержка
          </a>
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
        displayStatus = "Подтверждена";
        statusColor = "var(--green)";
      } else if (isCancelled) {
        displayStatus = "Отменена";
        statusColor = "var(--red)";
      }

      const isCancelable = ["На рассмотрении", "Одобрена", "Активна"].includes(b.status) || isUnavailable;

      return `
        <div class="af-card" style="${isCancelled ? 'opacity:0.75;' : ''}">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:14px;font-weight:800;">Запись №${b.id}</span>
            <span style="font-size:12px;font-weight:700;color:${statusColor};">${displayStatus}</span>
          </div>
          <div style="font-size:13px;color:var(--gray-2);line-height:1.45;margin-top:4px;">
            <div><strong>Услуга:</strong> ${b.problem}</div>
            <div><strong>Авто:</strong> ${b.car_model} ${b.car_number ? `(${b.car_number})` : ''}</div>
            <div><strong>Время:</strong> ${b.slot}</div>
            ${b.comment ? `<div style="margin-top:4px;padding:6px;background:var(--bg-pill);border-radius:6px;"><strong>Примечание:</strong> ${b.comment}</div>` : ''}
          </div>
          ${!isCancelled ? `
            <div style="display:flex;gap:8px;margin-top:10px;">
              ${isUnavailable ? `<button class="af-btn-primary reschedule-btn" data-id="${b.id}" style="flex:1;">Выбрать другое время</button>` : `<button class="af-btn-secondary reschedule-btn" data-id="${b.id}" style="flex:1;">Перенести</button>`}
              ${isCancelable ? `<button class="af-btn-secondary cancel-btn" data-id="${b.id}" style="flex:1;color:var(--red);">Отменить</button>` : ''}
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
      const bId = parseInt(bookingId, 10);
      const payload = {
        booking_id: bId,
        id: bId,
        user_id: userId,
        telegram_id: userId,
        chat_id: userId,
        user_name: userName,
        name: userName,
        init_data: tg?.initData || "",
        initData: tg?.initData || "",
        status: "Отменена",
        action: "cancel",
        notify_client: true,
        notify_admin: true,
        notify: true
      };

      const res = await fetch(`${BACKEND_URL}/api/booking/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      fetch(`${BACKEND_URL}/api/booking/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bId,
          id: bId,
          user_id: userId,
          telegram_id: userId,
          chat_id: userId,
          user_name: userName,
          action: "cancel",
          status: "Отменена",
          init_data: tg?.initData || ""
        })
      }).catch(() => {});

      let data = {};
      try { data = await res.json(); } catch (e) {}

      if (res.ok || data.success) {
        showToast("Запись отменена! Уведомление отправлено.");
        await loadUserProfile();
        if (isAdmin) loadAdminBookings(currentAdminFilter);
      } else {
        showToast(data.error || "Ошибка отмены");
      }
    } catch (e) {
      console.error(e);
      showToast("Ошибка соединения");
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
      showToast("Введите нужный номер");
    });
  }

  if (toStep2Btn) {
    toStep2Btn.addEventListener("click", () => {
      const checkedProblems = Array.from(selectedProblemsSet);
      const customProblems = Object.values(customCategoryInputs).map(v => v.trim()).filter(v => v.length > 0);
      const allProblems = [...checkedProblems, ...customProblems];

      if (allProblems.length === 0) {
        showToast("Выберите хотя бы одну услугу!");
        return;
      }
      goToStep(2);
    });
  }

  if (toStep3Btn) {
    toStep3Btn.addEventListener("click", () => {
      if (!selectedSlot) {
        showToast("Выберите время записи!");
        return;
      }
      goToStep(3);
    });
  }

  if (toStep4Btn) {
    toStep4Btn.addEventListener("click", () => {
      const carModel = document.getElementById("car-model").value.trim();
      if (!carModel || carModel.length < 2) {
        showToast("Укажите марку и модель авто!");
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

    if (!problem) { showToast("Выберите услугу!"); goToStep(1); return; }
    if (!carModel) { showToast("Укажите марку авто!"); goToStep(3); return; }
    if (!phone) { showToast("Укажите телефон!"); return; }
    if (privacyAgree && !privacyAgree.checked) { showToast("Примите Соглашение!"); return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Отправка...</span>`;

    try {
      const targetSlot = `${selectedSlot} (Мастер: ${selectedMasterName})`;

      const res = await fetch(`${BACKEND_URL}/api/booking/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          telegram_id: userId,
          chat_id: userId,
          user_name: userName,
          problem: problem,
          car_model: carModel,
          car_number: carNumber,
          slot: targetSlot,
          phone: phone,
          init_data: tg?.initData || ""
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`Заявка №${data.booking_id} успешно создана!`);
        bookingForm.reset();
        selectedProblemsSet.clear();
        Object.keys(customCategoryInputs).forEach(k => delete customCategoryInputs[k]);
        showCategoriesOverview();
        goToStep(1);
        setTimeout(() => {
          switchTab("bookings-list");
        }, 1000);
      } else {
        showToast(data.error || "Ошибка создания");
      }
    } catch (err) {
      console.error(err);
      showToast("Ошибка соединения с серверным API");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Подтвердить запись`;
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

  // ═══════════════════════════════════════════════════════════
  // MODERATOR PANEL LOGIC (Clean, Large Ergonomic Buttons with SVGs)
  // ═══════════════════════════════════════════════════════════
  const statusPillsContainer = document.getElementById("admin-status-pills");
  if (statusPillsContainer) {
    statusPillsContainer.querySelectorAll(".af-filter-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        statusPillsContainer.querySelectorAll(".af-filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        currentAdminFilter = chip.dataset.status;
        loadAdminBookings(currentAdminFilter);
      });
    });
  }

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
      let isCancelled = b.status.includes("Отменен") || b.status.includes("Отклонен");
      let isApproved = b.status === "Одобрена" || b.status === "Активна";

      let statusColor = "var(--yellow)";
      let statusBg = "rgba(255, 204, 0, 0.15)";
      let statusTag = "На рассмотрении";

      if (isApproved) { statusColor = "var(--green)"; statusBg = "rgba(52, 199, 89, 0.15)"; statusTag = "Одобрена"; }
      if (isCancelled) { statusColor = "var(--red)"; statusBg = "rgba(255, 59, 48, 0.15)"; statusTag = "Отменена"; }

      const phoneClean = (b.phone || "").replace(/[^\d+]/g, "");

      return `
        <div class="af-card" style="${isCancelled ? 'opacity:0.75;' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:15px;font-weight:800;">Заявка №${b.id}</span>
            <span style="font-size:13px;font-weight:800;padding:4px 12px;border-radius:16px;background:${statusBg};color:${statusColor};">${statusTag}</span>
          </div>
          <div style="font-size:14px;color:var(--gray-2);margin-top:6px;line-height:1.5;">
            <div><strong>Клиент:</strong> ${b.user_name} (ID: ${b.user_id})</div>
            <div><strong>Телефон:</strong> ${b.phone || 'Не указан'}</div>
            <div><strong>Услуга:</strong> ${b.problem}</div>
            <div><strong>Авто:</strong> ${b.car_model} ${b.car_number ? `(${b.car_number})` : ''}</div>
            <div><strong>Время:</strong> ${b.slot}</div>
            ${b.comment ? `<div style="margin-top:6px;padding:8px 12px;background:var(--bg-pill);border-radius:8px;"><strong>Комментарий:</strong> ${b.comment}</div>` : ''}
          </div>

          <div style="display:flex;gap:8px;margin-top:10px;">
            ${phoneClean ? `<a href="tel:${phoneClean}" class="af-btn-secondary" style="flex:1;text-decoration:none;font-size:13.5px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> Звонок</a>` : ''}
            <a href="https://t.me/${b.user_id}" target="_blank" class="af-btn-secondary" style="flex:1;text-decoration:none;font-size:13.5px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Telegram</a>
          </div>

          <!-- Prominent, Ergonomic Moderator Buttons with Clean SVG Icons -->
          <div class="af-mod-actions-grid">
            ${!isApproved ? `
              <button class="af-btn-mod af-btn-approve admin-btn-action" data-id="${b.id}" data-act="approve">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Одобрить
              </button>
            ` : ''}
            ${!isCancelled ? `
              <button class="af-btn-mod af-btn-reject admin-btn-action" data-id="${b.id}" data-act="reject">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Отклонить
              </button>
            ` : ''}
            <button class="af-btn-mod af-btn-delete admin-btn-action" data-id="${b.id}" data-act="delete">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Удалить из базы
            </button>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".admin-btn-action").forEach(btn => {
      btn.addEventListener("click", async () => {
        const bId = btn.dataset.id;
        const act = btn.dataset.act;

        if (act === "delete") {
          if (!confirm(`Вы уверены, что хотите удалить запись №${bId} из базы?`)) return;
          await executeAdminAction(bId, "delete", "");
        } else if (act === "approve" || act === "reject") {
          openAdminModal(bId, act);
        }
      });
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
        showToast("Действие модератора выполнено!");
        loadAdminBookings(currentAdminFilter);
        loadUserProfile();
      } else {
        showToast(data.error || "Ошибка");
      }
    } catch (e) {
      showToast("Ошибка вызова API");
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

      if (!rawDate) { showToast("Укажите дату!"); return; }

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
          showToast(`Смена мастера отменена! Клиенты уведомлены.`);
          loadAdminBookings(currentAdminFilter);
        }
      } catch (e) {
        showToast("Ошибка соединения");
      }
    });
  }

});
