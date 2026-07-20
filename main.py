import asyncio
import logging
import os
import re
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")

from database import init_db, add_booking, get_user_bookings, get_user_stats, cancel_booking_by_id

logging.basicConfig(level=logging.INFO, stream=sys.stdout)

# Словарь марок автомобилей (Русский -> Английский)
BRANDS_MAP = {

    "бмв": "BMW",
    "bmw": "BMW",
    "опель": "Opel",
    "opel": "Opel",
    "мерседес-бенц": "Mercedes-Benz",
    "мерседес бенц": "Mercedes-Benz",
    "мерседес": "Mercedes-Benz",
    "мерс": "Mercedes-Benz",
    "тойота": "Toyota",
    "хендай": "Hyundai",
    "хёндэ": "Hyundai",
    "хенде": "Hyundai",
    "хюндай": "Hyundai",
    "киа": "Kia",
    "фольксваген": "Volkswagen",
    "фольц": "Volkswagen",
    "фолькс": "Volkswagen",
    "ауди": "Audi",
    "ниссан": "Nissan",
    "лада": "Lada",
    "ваз": "Lada (ВАЗ)",
    "жигули": "Lada",
    "шкода": "Skoda",
    "форд": "Ford",
    "мазда": "Mazda",
    "субару": "Subaru",
    "рено": "Renault",
    "пежо": "Peugeot",
    "ситроен": "Citroen",
    "шевроле": "Chevrolet",
    "шеви": "Chevrolet",
    "митсубиси": "Mitsubishi",
    "мицубиси": "Mitsubishi",
    "мицубиши": "Mitsubishi",
    "хонда": "Honda",
    "лексус": "Lexus",
    "инфинити": "Infiniti",
    "порше": "Porsche",
    "порш": "Porsche",
    "вольво": "Volvo",
    "сузуки": "Suzuki",
    "уаз": "UAZ",
    "газ": "GAZ",
    "чери": "Chery",
    "хавал": "Haval",
    "хавейл": "Haval",
    "джили": "Geely",
    "эксид": "Exeed",
    "омода": "Omoda",
    "чанган": "Changan",
    "ягуар": "Jaguar",
    "ленд ровер": "Land Rover",
    "лэнд ровер": "Land Rover",
    "рейндж ровер": "Range Rover",
    "ранж ровер": "Range Rover",
    "тесла": "Tesla",
}

# Словарь известных моделей (Русский -> Английский)
MODELS_MAP = {
    "астра": "Astra",
    "вектра": "Vectra",
    "зафира": "Zafira",
    "корса": "Corsa",
    "инсигния": "Insignia",
    "мокка": "Mokka",
    "омега": "Omega",
    "камри": "Camry",
    "королла": "Corolla",
    "рав4": "RAV4",
    "рав 4": "RAV4",
    "прадо": "Prado",
    "крузер": "Land Cruiser",
    "хайлендер": "Highlander",
    "ярис": "Yaris",
    "авенсис": "Avensis",
    "солярис": "Solaris",
    "элантра": "Elantra",
    "соната": "Sonata",
    "туссан": "Tucson",
    "туксон": "Tucson",
    "крета": "Creta",
    "рио": "Rio",
    "сид": "Ceed",
    "спортейдж": "Sportage",
    "спортэйдж": "Sportage",
    "оптима": "Optima",
    "к5": "K5",
    "соренто": "Sorento",
    "пиканто": "Picanto",
    "поло": "Polo",
    "гольф": "Golf",
    "пассат": "Passat",
    "тигуан": "Tiguan",
    "туарег": "Touareg",
    "джета": "Jetta",
    "джетта": "Jetta",
    "октавия": "Octavia",
    "рапид": "Rapid",
    "суперб": "Superb",
    "кодиак": "Kodiaq",
    "карок": "Karoq",
    "фокус": "Focus",
    "мондео": "Mondeo",
    "куга": "Kuga",
    "фиеста": "Fiesta",
    "транзит": "Transit",
    "экоспорт": "EcoSport",
    "кашкай": "Qashqai",
    "икстрейл": "X-Trail",
    "хтрейл": "X-Trail",
    "х-трейл": "X-Trail",
    "альмера": "Almera",
    "жук": "Juke",
    "теана": "Teana",
    "мурано": "Murano",
    "патфайндер": "Pathfinder",
    "дустер": "Duster",
    "дастер": "Duster",
    "логан": "Logan",
    "сандеро": "Sandero",
    "каптюр": "Kaptur",
    "аркана": "Arkana",
    "лансер": "Lancer",
    "аутлендер": "Outlander",
    "паджеро": "Pajero",
    "галант": "Galant",
    "импреза": "Impreza",
    "форестер": "Forester",
    "аутбек": "Outback",
    "легаси": "Legacy",
    "круз": "Cruze",
    "авео": "Aveo",
    "лачетти": "Lacetti",
    "каптива": "Captiva",
    "орландо": "Orlando",
    "кобальт": "Cobalt",
    "цивик": "Civic",
    "сивик": "Civic",
    "аккорд": "Accord",
    "црв": "CR-V",
    "срв": "CR-V",
    "пилот": "Pilot",
    "веста": "Vesta",
    "гранта": "Granta",
    "приора": "Priora",
    "калина": "Kalina",
    "нива": "Niva",
    "ларгус": "Largus",
    "хрей": "XRAY",
    "тигго": "Tiggo",
    "джолион": "Jolion",
    "дарго": "Dargo",
    "атлас": "Atlas",
    "кулрей": "Coolray",
    "монжаро": "Monjaro",
    "тугелла": "Tugella",
    "седан": "Sedan",
    "хэтчбек": "Hatchback",
    "универсал": "Universal",
    "кроссовер": "Crossover",
    "внедорожник": "SUV",
}

CYRILLIC_TO_LATIN = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
}

def transliterate_word(word: str) -> str:
    """Транслитерация кириллического слова в латиницу"""
    res = []
    for char in word:
        lower_char = char.lower()
        if lower_char in CYRILLIC_TO_LATIN:
            trans = CYRILLIC_TO_LATIN[lower_char]
            if char.isupper():
                trans = trans.capitalize()
            res.append(trans)
        else:
            res.append(char)
    result = "".join(res)
    return result.capitalize()

def validate_and_format_car(text: str) -> str | None:
    """Проверка и перевод марки и модели авто"""
    clean_text = text.strip()
    
    if len(clean_text) < 2 or len(clean_text) > 50:
        return None
        
    if not re.search(r"[a-zA-Zа-яА-ЯёЁ]", clean_text):
        return None
        
    if re.search(r"(.)\1{4,}", clean_text.lower()):
        return None
        
    words = clean_text.split()
    formatted_words = []
    
    i = 0
    while i < len(words):
        if i + 1 < len(words):
            two_words = f"{words[i].lower()} {words[i+1].lower()}"
            if two_words in BRANDS_MAP:
                formatted_words.append(BRANDS_MAP[two_words])
                i += 2
                continue
            if two_words in MODELS_MAP:
                formatted_words.append(MODELS_MAP[two_words])
                i += 2
                continue
                
        word_lower = words[i].lower()
        
        if word_lower in BRANDS_MAP:
            formatted_words.append(BRANDS_MAP[word_lower])
        elif word_lower in MODELS_MAP:
            formatted_words.append(MODELS_MAP[word_lower])
        elif re.search(r"[а-яА-ЯёЁ]", words[i]):
            formatted_words.append(transliterate_word(words[i]))
        else:
            formatted_words.append(words[i].capitalize() if words[i].isalpha() else words[i])
            
        i += 1
            
    return " ".join(formatted_words)


# Состояния FSM для записи на ТО
class BookingState(StatesGroup):
    select_category = State()       # Выбор категории проблемы
    custom_problem = State()        # Ввод своей проблемы вручную
    enter_car_model = State()       # Ввод марки и модели авто
    select_time_slot = State()      # Выбор точной даты и времени
    enter_phone = State()           # Передача/ввод телефона
    confirm = State()               # Подтверждение записи

# Главное меню бота (6 основных кнопок)
def get_main_keyboard():
    builder = ReplyKeyboardBuilder()
    builder.button(text="🛠 Услуги и цены")
    builder.button(text="📅 Записаться на ТО")
    builder.button(text="👤 Личный кабинет")
    builder.button(text="📍 Контакты и адрес")
    builder.button(text="ℹ️ О нас")
    builder.button(text="🔄 Обновить меню")
    builder.adjust(2, 1, 2, 1)
    return builder.as_markup(resize_keyboard=True)

# Инлайн-клавиатура выбора категорий проблем
def get_categories_keyboard():
    builder = InlineKeyboardBuilder()
    categories = [
        ("🔧 Двигатель и выхлоп", "cat_engine"),
        ("🛞 Подвеска и тормоза", "cat_chassis"),
        ("⚡ Электрика и диагностика", "cat_electric"),
        ("🛢 Регулярное ТО (масло/фильтры)", "cat_to"),
        ("❄️ Климат и кондиционер", "cat_climate"),
        ("✏️ Написать свою проблему вручную", "cat_custom"),
    ]
    for text, callback_data in categories:
        builder.button(text=text, callback_data=callback_data)
    builder.button(text="❌ Отмена", callback_data="cancel_booking")
    builder.adjust(1)
    return builder.as_markup()

# Генератор свободных окошек с точными календарными датами
def get_time_slots_keyboard():
    builder = InlineKeyboardBuilder()
    today = datetime.now()
    days_ru = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    
    for day_offset in range(1, 4):
        date_obj = today + timedelta(days=day_offset)
        date_str = date_obj.strftime("%d.%m")
        day_name = days_ru[date_obj.weekday()]
        
        for time_str in ["10:00", "14:00", "17:00"]:
            slot_label = f"📅 {date_str} ({day_name}) в {time_str}"
            builder.button(text=slot_label, callback_data=f"slot_{slot_label}")
            
    builder.button(text="❌ Отмена", callback_data="cancel_booking")
    builder.adjust(2, 2, 2, 2, 1)
    return builder.as_markup()

# Клавиатура для передачи контакта/телефона
def get_phone_keyboard():
    builder = ReplyKeyboardBuilder()
    builder.button(text="📱 Отправить мой номер телефона", request_contact=True)
    builder.button(text="❌ Отмена")
    builder.adjust(1)
    return builder.as_markup(resize_keyboard=True)

# Клавиатура финального подтверждения
def get_confirm_keyboard():
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Подтвердить запись", callback_data="confirm_booking")
    builder.button(text="❌ Отменить", callback_data="cancel_booking")
    builder.adjust(2)
    return builder.as_markup()

dp = Dispatcher(storage=MemoryStorage())

# --- Команда /start и /restart ---
@dp.message(Command("start"))
@dp.message(Command("restart"))
@dp.message(F.text == "🔄 Обновить меню")
async def start_handler(message: types.Message, state: FSMContext):
    await state.clear()
    welcome_text = (
        f"Здравствуйте, {message.from_user.first_name}!\n\n"
        "🔄 <b>Меню бота успешно обновлено.</b>\n"
        "Выберите нужное действие в меню ниже:"
    )
    await message.answer(welcome_text, parse_mode="HTML", reply_markup=get_main_keyboard())

# --- Обработка Отмены ---
@dp.message(F.text == "❌ Отмена")
@dp.callback_query(F.data == "cancel_booking")
async def cancel_handler(event: types.Message | types.CallbackQuery, state: FSMContext):
    await state.clear()
    text = "Запись отменена."
    if isinstance(event, types.CallbackQuery):
        await event.answer()
        await event.message.answer(text, reply_markup=get_main_keyboard())
    else:
        await event.answer(text, reply_markup=get_main_keyboard())

# --- 🛠 Услуги и цены ---
@dp.message(F.text == "🛠 Услуги и цены")
async def services_handler(message: types.Message):
    services_text = (
        "<b>🛠 Цены на основные услуги:</b>\n\n"
        "• Компьютерная диагностика — от 1 000 ₽\n"
        "• Замена масла и фильтров — от 1 500 ₽\n"
        "• Ремонт тормозной системы — от 2 000 ₽\n"
        "• Обслуживание подвески — от 2 500 ₽\n"
        "• Заправка и обслуживание кондиционера — от 2 000 ₽\n"
        "• Шиномонтаж (комплект) — от 2 000 ₽\n\n"
        "<i>Нажмите «📅 Записаться на ТО», чтобы выбрать дату и записаться.</i>"
    )
    await message.answer(services_text, parse_mode="HTML")

# --- 📍 Контакты и адрес ---
@dp.message(F.text == "📍 Контакты и адрес")
async def contacts_handler(message: types.Message):
    contacts_text = (
        "<b>📍 Контакты автосервиса</b>\n\n"
        "<b>Адрес:</b> г. Москва, ул. Автомобильная, д. 10\n"
        "<b>Режим работы:</b> Ежедневно с 09:00 до 21:00\n"
        "<b>Телефон:</b> +7 (999) 000-00-00"
    )
    await message.answer(contacts_text, parse_mode="HTML")

# --- ℹ️ О нас ---
@dp.message(F.text == "ℹ️ О нас")
async def about_handler(message: types.Message):
    about_text = (
        "<b>ℹ️ О нашем автосервисе</b>\n\n"
        "Качественный ремонт и техническое обслуживание авто всех марок.\n"
        "Гарантия на работы, современное оборудование и квалифицированные мастера."
    )
    await message.answer(about_text, parse_mode="HTML")

# --- 👤 Личный кабинет ---
@dp.message(F.text == "👤 Личный кабинет")
@dp.message(Command("profile"))
@dp.message(Command("my_bookings"))
async def profile_handler(message: types.Message):
    user_id = message.from_user.id
    stats = get_user_stats(user_id)
    user_name = message.from_user.full_name or message.from_user.first_name
    username_str = f" (@{message.from_user.username})" if message.from_user.username else ""
    
    profile_text = (
        f"<b>👤 Личный кабинет клиента</b>\n\n"
        f"• <b>Клиент:</b> {user_name}{username_str}\n"
        f"• <b>Телефон:</b> {stats['phone']}\n"
        f"• <b>Последнее авто:</b> {stats['car_model']}\n\n"
        f"<b>📊 Ваша статистика записей:</b>\n"
        f"• 🟢 Активных записей: <b>{stats['active']}</b>\n"
        f"• 📁 Всего заявок: <b>{stats['total']}</b>\n"
        f"• 🔴 Отмененных: <b>{stats['cancelled']}</b>\n\n"
        "Выберите нужное действие ниже:"
    )
    
    builder = InlineKeyboardBuilder()
    builder.button(text=f"📋 Активные записи ({stats['active']})", callback_data="view_active_bookings")
    builder.button(text="📜 Вся история визитов", callback_data="view_all_bookings")
    builder.button(text="📅 Записаться на ТО", callback_data="start_booking_from_profile")
    builder.adjust(1)
    
    await message.answer(profile_text, parse_mode="HTML", reply_markup=builder.as_markup())

# Показ активных записей
@dp.callback_query(F.data == "view_active_bookings")
async def view_active_bookings_handler(callback: types.CallbackQuery):
    await callback.answer()
    user_id = callback.from_user.id
    bookings = get_user_bookings(user_id, status_filter="Активна")
    
    if not bookings:
        await callback.message.answer(
            "<b>🟢 У вас нет активных записей на данный момент.</b>\n\n"
            "Вы можете записаться на ТО, нажав кнопку «📅 Записаться на ТО».",
            parse_mode="HTML"
        )
        return
        
    response = "<b>🟢 Ваши активные записи:</b>\n\n"
    builder = InlineKeyboardBuilder()
    for b in bookings:
        response += (
            f"<b>Запись №{b['id']}</b>\n"
            f"• <b>Услуга:</b> {b['problem']}\n"
            f"• <b>Автомобиль:</b> {b['car_model']}\n"
            f"• <b>Дата и время:</b> {b['slot']}\n"
            f"• <b>Телефон:</b> {b['phone']}\n"
            "-------------------------\n"
        )
        builder.button(text=f"❌ Отменить запись №{b['id']}", callback_data=f"cancel_db_booking_{b['id']}")
        
    builder.adjust(1)
    await callback.message.answer(response, parse_mode="HTML", reply_markup=builder.as_markup())

# Показ всей истории записей
@dp.callback_query(F.data == "view_all_bookings")
async def view_all_bookings_handler(callback: types.CallbackQuery):
    await callback.answer()
    user_id = callback.from_user.id
    bookings = get_user_bookings(user_id)
    
    if not bookings:
        await callback.message.answer(
            "<b>📜 История записей пуста.</b>",
            parse_mode="HTML"
        )
        return
        
    response = "<b>📜 Полная история ваших записей:</b>\n\n"
    for b in bookings:
        status_icon = "🟢" if b["status"] == "Активна" else "🔴"
        response += (
            f"<b>Запись №{b['id']}</b> [{status_icon} {b['status']}]\n"
            f"• <b>Услуга:</b> {b['problem']}\n"
            f"• <b>Автомобиль:</b> {b['car_model']}\n"
            f"• <b>Дата и время:</b> {b['slot']}\n"
            f"• <b>Телефон:</b> {b['phone']}\n"
            "-------------------------\n"
        )
    await callback.message.answer(response, parse_mode="HTML")

# Запуск записи из личного кабинета
@dp.callback_query(F.data == "start_booking_from_profile")
async def start_booking_from_profile_handler(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(BookingState.select_category)
    await callback.message.answer(
        "<b>Шаг 1 из 4:</b> Выберите категорию проблемы:",
        parse_mode="HTML",
        reply_markup=get_categories_keyboard()
    )

# Отмена записи из базы данных
@dp.callback_query(F.data.startswith("cancel_db_booking_"))
async def cancel_db_booking_handler(callback: types.CallbackQuery):
    await callback.answer()
    try:
        booking_id = int(callback.data.replace("cancel_db_booking_", ""))
    except ValueError:
        return
        
    user_id = callback.from_user.id
    success = cancel_booking_by_id(booking_id, user_id)
    
    if success:
        await callback.message.edit_text(
            f"<b>✅ Запись №{booking_id} успешно отменена.</b>",
            parse_mode="HTML"
        )
    else:
        await callback.message.answer(
            "⚠️ Не удалось отменить запись или она уже была отменена.",
            parse_mode="HTML"
        )

# --- 📅 Поток записи на ТО ---

# Шаг 1: Выбор категории
@dp.message(F.text == "📅 Записаться на ТО")
async def start_booking(message: types.Message, state: FSMContext):
    await state.set_state(BookingState.select_category)
    await message.answer(
        "<b>Шаг 1 из 4:</b> Выберите категорию проблемы:",
        parse_mode="HTML",
        reply_markup=get_categories_keyboard()
    )

# Шаг 1.1: Выбрана категория из списка (срабатывает ВСЕГДА, без жесткого фильтра состояний)
@dp.callback_query(F.data.startswith("cat_"))
async def category_selected(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    
    categories_map = {
        "cat_engine": "🔧 Двигатель и выхлоп",
        "cat_chassis": "🛞 Подвеска и тормоза",
        "cat_electric": "⚡ Электрика и диагностика",
        "cat_to": "🛢 Регулярное ТО",
        "cat_climate": "❄️ Климат и кондиционер",
    }
    
    if callback.data == "cat_custom":
        await state.set_state(BookingState.custom_problem)
        await callback.message.answer(
            "Напишите текстом вашу проблему или нужную услугу:"
        )
    else:
        chosen_category = categories_map.get(callback.data, "Общий ремонт")
        await state.update_data(problem=chosen_category)
        await state.set_state(BookingState.enter_car_model)
        await callback.message.answer(
            f"Выбрано: <b>{chosen_category}</b>\n\n"
            "<b>Шаг 2 из 4:</b> Укажите марку и модель автомобиля (например: <i>Опель астра</i> или <i>Toyota Camry</i>):",
            parse_mode="HTML"
        )

# Шаг 1.2: Ручной ввод проблемы
@dp.message(BookingState.custom_problem)
async def custom_problem_entered(message: types.Message, state: FSMContext):
    if len(message.text.strip()) < 3:
        await message.answer("Пожалуйста, опишите проблему чуть подробнее (не менее 3 символов):")
        return
    await state.update_data(problem=message.text)
    await state.set_state(BookingState.enter_car_model)
    await message.answer(
        "<b>Шаг 2 из 4:</b> Укажите марку и модель автомобиля (например: <i>Тойота Камри 2018</i>):",
        parse_mode="HTML"
    )

# Шаг 2: Ввод марки/модели
@dp.message(BookingState.enter_car_model)
async def car_model_entered(message: types.Message, state: FSMContext):
    formatted_car = validate_and_format_car(message.text)
    
    if not formatted_car:
        await message.answer(
            "⚠️ <b>Некорректное название автомобиля.</b>\n\n"
            "Пожалуйста, введите марку и модель автомобиля правильным текстом.\n"
            "<i>Примеры: Опель астра, BMW X5, Тойота Камри, Kia Rio, Хендай Солярис</i>",
            parse_mode="HTML"
        )
        return
        
    await state.update_data(car_model=formatted_car)
    await state.set_state(BookingState.select_time_slot)
    
    await message.answer(
        f"Автомобиль принят: <b>{formatted_car}</b>\n\n"
        "<b>Шаг 3 из 4:</b> Выберите точную дату и время визита:",
        parse_mode="HTML",
        reply_markup=get_time_slots_keyboard()
    )

# Шаг 3: Выбор окошка с датой (срабатывает ВСЕГДА)
@dp.callback_query(F.data.startswith("slot_"))
async def slot_selected(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    slot_text = callback.data.replace("slot_📅 ", "").replace("slot_", "")
    await state.update_data(slot=slot_text)
    
    await state.set_state(BookingState.enter_phone)
    await callback.message.answer(
        f"Выбранная дата и время: <b>{slot_text}</b>\n\n"
        "<b>Шаг 4 из 4:</b> Нажмите «📱 Отправить мой номер телефона» или введите его вручную:",
        parse_mode="HTML",
        reply_markup=get_phone_keyboard()
    )

# Шаг 4: Ввод телефона
@dp.message(BookingState.enter_phone)
async def phone_entered(message: types.Message, state: FSMContext):
    if message.contact:
        phone = message.contact.phone_number
    else:
        raw_phone = message.text.strip()
        digits = re.sub(r"\D", "", raw_phone)
        if len(digits) < 7 or len(digits) > 15:
            await message.answer(
                "⚠️ <b>Некорректный номер телефона.</b>\n\n"
                "Пожалуйста, нажмите кнопку «📱 Отправить мой номер телефона» "
                "или введите верный номер (например: +79991234567).",
                parse_mode="HTML"
            )
            return
        phone = raw_phone
        
    await state.update_data(phone=phone)
    data = await state.get_data()
    
    summary = (
        "<b>📋 Подтверждение записи:</b>\n\n"
        f"• <b>Услуга/Проблема:</b> {data.get('problem')}\n"
        f"• <b>Марка и модель авто:</b> {data.get('car_model')}\n"
        f"• <b>Дата и время:</b> {data.get('slot')}\n"
        f"• <b>Телефон:</b> {data.get('phone')}\n\n"
        "Всё верно?"
    )
    
    await state.set_state(BookingState.confirm)
    await message.answer("Отлично!", reply_markup=types.ReplyKeyboardRemove())
    await message.answer(summary, parse_mode="HTML", reply_markup=get_confirm_keyboard())

# Шаг 5: Финальное подтверждение (срабатывает ВСЕГДА)
@dp.callback_query(F.data == "confirm_booking")
async def confirm_booking(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    data = await state.get_data()
    await state.clear()
    
    booking_id = add_booking(
        user_id=callback.from_user.id,
        user_name=callback.from_user.full_name or callback.from_user.first_name,
        problem=data.get('problem', 'Общий ремонт'),
        car_model=data.get('car_model', 'Не указано'),
        slot=data.get('slot', 'Не указано'),
        phone=data.get('phone', 'Не указан')
    )
    
    final_text = (
        f"<b>🎉 Запись №{booking_id} успешно подтверждена!</b>\n\n"
        f"Дата и время: <b>{data.get('slot')}</b>\n"
        f"Автомобиль: <b>{data.get('car_model')}</b>\n"
        f"Услуга: <b>{data.get('problem')}</b>\n\n"
        "Мы свяжемся с вами по телефону <b>"
        f"{data.get('phone')}</b> для подтверждения.\n\n"
        "<i>Вы всегда можете посмотреть свои записи и их статус с помощью кнопки «📋 Мои записи».</i>"
    )
    await callback.message.answer(final_text, parse_mode="HTML", reply_markup=get_main_keyboard())

async def main():
    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token or bot_token == "your_bot_token_here":
        print("ОШИБКА: Укажите валидный BOT_TOKEN в переменных окружения!", flush=True)
        return

    # Инициализация базы данных
    init_db()
    print("База данных SQLite успешно инициализирована!", flush=True)

    bot = Bot(token=bot_token)
    
    # Удаляем вебхуки для очистки стэка у Telegram API
    await bot.delete_webhook(drop_pending_updates=True)
    print("Бот успешно запущен и готов к работе!", flush=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
