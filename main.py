import asyncio
import logging
import os
import re
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command
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
    "бмв": "BMW", "bmw": "BMW", "опель": "Opel", "opel": "Opel",
    "мерседес-бенц": "Mercedes-Benz", "мерседес бенц": "Mercedes-Benz",
    "мерседес": "Mercedes-Benz", "мерс": "Mercedes-Benz", "тойота": "Toyota",
    "хендай": "Hyundai", "хёндэ": "Hyundai", "хенде": "Hyundai", "хюндай": "Hyundai",
    "киа": "Kia", "фольксваген": "Volkswagen", "фольц": "Volkswagen", "фолькс": "Volkswagen",
    "ауди": "Audi", "ниссан": "Nissan", "лада": "Lada", "ваз": "Lada (ВАЗ)",
    "жигули": "Lada", "шкода": "Skoda", "форд": "Ford", "мазда": "Mazda",
    "субару": "Subaru", "рено": "Renault", "пежо": "Peugeot", "ситроен": "Citroen",
    "шевроле": "Chevrolet", "шеви": "Chevrolet", "митсубиси": "Mitsubishi",
    "мицубиси": "Mitsubishi", "мицубиши": "Mitsubishi", "хонда": "Honda",
    "лексус": "Lexus", "инфинити": "Infiniti", "порше": "Porsche", "порш": "Porsche",
    "вольво": "Volvo", "сузуки": "Suzuki", "уаз": "UAZ", "газ": "GAZ",
    "чери": "Chery", "хавал": "Haval", "хавейл": "Haval", "джили": "Geely",
    "эксид": "Exeed", "омода": "Omoda", "чанган": "Changan", "ягуар": "Jaguar",
    "ленд ровер": "Land Rover", "лэнд ровер": "Land Rover", "рейндж ровер": "Range Rover",
    "ранж ровер": "Range Rover", "тесла": "Tesla",
}

# Словарь известных моделей (Русский -> Английский)
MODELS_MAP = {
    "астра": "Astra", "вектра": "Vectra", "зафира": "Zafira", "корса": "Corsa",
    "инсигния": "Insignia", "мокка": "Mokka", "омега": "Omega", "камри": "Camry",
    "королла": "Corolla", "рав4": "RAV4", "рав 4": "RAV4", "прадо": "Prado",
    "крузер": "Land Cruiser", "хайлендер": "Highlander", "ярис": "Yaris",
    "авенсис": "Avensis", "солярис": "Solaris", "элантра": "Elantra",
    "соната": "Sonata", "туссан": "Tucson", "туксон": "Tucson", "крета": "Creta",
    "рио": "Rio", "сид": "Ceed", "спортейдж": "Sportage", "спортэйдж": "Sportage",
    "оптима": "Optima", "к5": "K5", "соренто": "Sorento", "пиканто": "Picanto",
    "поло": "Polo", "гольф": "Golf", "пассат": "Passat", "тигуан": "Tiguan",
    "туарег": "Touareg", "джета": "Jetta", "джетта": "Jetta", "октавия": "Octavia",
    "рапид": "Rapid", "суперб": "Superb", "кодиак": "Kodiaq", "карок": "Karoq",
    "фокус": "Focus", "мондео": "Mondeo", "куга": "Kuga", "фиеста": "Fiesta",
    "транзит": "Transit", "экоспорт": "EcoSport", "кашкай": "Qashqai",
    "икстрейл": "X-Trail", "хтрейл": "X-Trail", "х-трейл": "X-Trail",
    "альмера": "Almera", "жук": "Juke", "теана": "Teana", "мурано": "Murano",
    "патфайндер": "Pathfinder", "дустер": "Duster", "дастер": "Duster",
    "логан": "Logan", "сандеро": "Sandero", "каптюр": "Kaptur", "аркана": "Arkana",
    "лансер": "Lancer", "аутлендер": "Outlander", "паджеро": "Pajero",
    "галант": "Galant", "импреза": "Impreza", "форестер": "Forester",
    "аутбек": "Outback", "легаси": "Legacy", "круз": "Cruze", "авео": "Aveo",
    "лачетти": "Lacetti", "каптива": "Captiva", "орландо": "Orlando",
    "кобальт": "Cobalt", "цивик": "Civic", "сивик": "Civic", "аккорд": "Accord",
    "црв": "CR-V", "срв": "CR-V", "пилот": "Pilot", "веста": "Vesta",
    "гранта": "Granta", "приора": "Priora", "калина": "Kalina", "нива": "Niva",
    "ларгус": "Largus", "хрей": "XRAY", "тигго": "Tiggo", "джолион": "Jolion",
    "дарго": "Dargo", "атлас": "Atlas", "кулрей": "Coolray", "монжаро": "Monjaro",
    "тугелла": "Tugella", "седан": "Sedan", "хэтчбек": "Hatchback",
    "универсал": "Universal", "кроссовер": "Crossover", "внедорожник": "SUV",
}

CYRILLIC_TO_LATIN = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
}

def transliterate_word(word: str) -> str:
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
    return "".join(res).capitalize()

def validate_and_format_car(text: str) -> str | None:
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
    select_category = State()
    custom_problem = State()
    enter_car_model = State()
    select_time_slot = State()
    enter_phone = State()
    confirm = State()

# --- Инлайн-клавиатуры для единого интерактивного меню ---

def get_main_inline_keyboard():
    builder = InlineKeyboardBuilder()
    builder.button(text="🛠 Услуги и цены", callback_data="nav_services")
    builder.button(text="📅 Записаться на ТО", callback_data="nav_booking")
    builder.button(text="👤 Личный кабинет", callback_data="nav_profile")
    builder.button(text="📍 Контакты и адрес", callback_data="nav_contacts")
    builder.button(text="ℹ️ О нас", callback_data="nav_about")
    builder.button(text="🔄 Обновить меню", callback_data="nav_main")
    builder.adjust(2, 1, 2, 1)
    return builder.as_markup()

def get_back_inline_keyboard():
    builder = InlineKeyboardBuilder()
    builder.button(text="🔙 Назад в меню", callback_data="nav_main")
    return builder.as_markup()

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
    builder.button(text="🔙 Отмена и назад", callback_data="nav_main")
    builder.adjust(1)
    return builder.as_markup()

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
    builder.button(text="🔙 Отмена и назад", callback_data="nav_main")
    builder.adjust(2, 2, 2, 2, 1)
    return builder.as_markup()

def get_confirm_keyboard():
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Подтвердить запись", callback_data="confirm_booking")
    builder.button(text="❌ Отменить", callback_data="nav_main")
    builder.adjust(2)
    return builder.as_markup()

dp = Dispatcher(storage=MemoryStorage())

MAIN_WELCOME_TEXT = (
    "🚗 <b>Автосервис «Интерактивный Бот»</b>\n\n"
    "Добро пожаловать! Все разделы работают прямо в одном сообщении.\n"
    "Нажимайте на кнопки ниже для переходов:"
)

# Функция отсылки или обновления главного меню
async def show_main_menu(bot: Bot, chat_id: int, user_first_name: str, state: FSMContext, callback: types.CallbackQuery = None):
    await state.clear()
    text = f"Здравствуйте, {user_first_name}!\n\n" + MAIN_WELCOME_TEXT
    
    if callback:
        try:
            await callback.message.edit_text(text, parse_mode="HTML", reply_markup=get_main_inline_keyboard())
            return
        except Exception:
            pass
            
    msg = await bot.send_message(chat_id, text, parse_mode="HTML", reply_markup=get_main_inline_keyboard())
    await state.update_data(card_msg_id=msg.message_id)

# --- Навигация по /start, /restart ---
@dp.message(Command("start"))
@dp.message(Command("restart"))
@dp.message(F.text.in_({"🔄 Обновить", "🔄 Обновить меню", "🛠 Услуги", "📅 Записаться", "👤 Кабинет", "📍 Контакты"}))
async def cmd_start(message: types.Message, state: FSMContext, bot: Bot):
    try:
        await message.delete()
    except Exception:
        pass
    await show_main_menu(bot, message.chat.id, message.from_user.first_name, state)

# Возврат в главное меню через Inline Callback
@dp.callback_query(F.data == "nav_main")
async def nav_main_handler(callback: types.CallbackQuery, state: FSMContext, bot: Bot):
    await callback.answer()
    await show_main_menu(bot, callback.message.chat.id, callback.from_user.first_name, state, callback)

# --- Раздел: 🛠 Услуги и цены ---
@dp.callback_query(F.data == "nav_services")
async def nav_services_handler(callback: types.CallbackQuery):
    await callback.answer()
    services_text = (
        "<b>🛠 Цены на основные услуги автосервиса:</b>\n\n"
        "• Компьютерная диагностика — от 1 000 ₽\n"
        "• Замена масла и фильтров — от 1 500 ₽\n"
        "• Ремонт тормозной системы — от 2 000 ₽\n"
        "• Обслуживание подвески — от 2 500 ₽\n"
        "• Заправка и обслуживание кондиционера — от 2 000 ₽\n"
        "• Шиномонтаж (комплект) — от 2 000 ₽\n\n"
        "<i>Нажмите «📅 Записаться на ТО», чтобы выбрать удобное время.</i>"
    )
    builder = InlineKeyboardBuilder()
    builder.button(text="📅 Записаться на ТО", callback_data="nav_booking")
    builder.button(text="🔙 Назад в меню", callback_data="nav_main")
    builder.adjust(1)
    await callback.message.edit_text(services_text, parse_mode="HTML", reply_markup=builder.as_markup())

# --- Раздел: 📍 Контакты и адрес ---
@dp.callback_query(F.data == "nav_contacts")
async def nav_contacts_handler(callback: types.CallbackQuery):
    await callback.answer()
    contacts_text = (
        "<b>📍 Контакты автосервиса</b>\n\n"
        "<b>Адрес:</b> г. Москва, ул. Автомобильная, д. 10\n"
        "<b>Режим работы:</b> Ежедневно с 09:00 до 21:00\n"
        "<b>Телефон:</b> +7 (999) 000-00-00\n"
        "<b>Телеграм автосервиса:</b> @autoservice_admin"
    )
    await callback.message.edit_text(contacts_text, parse_mode="HTML", reply_markup=get_back_inline_keyboard())

# --- Раздел: ℹ️ О нас ---
@dp.callback_query(F.data == "nav_about")
async def nav_about_handler(callback: types.CallbackQuery):
    await callback.answer()
    about_text = (
        "<b>ℹ️ О нашем автосервисе</b>\n\n"
        "Мы предоставляем полный спектр услуг по ремонту и обслуживанию легковых автомобилей.\n"
        "• Опыт работы более 10 лет\n"
        "• Современное оборудование\n"
        "• Гарантия на все виды работ\n"
        "• Прозрачные цены без скрытых переплат"
    )
    await callback.message.edit_text(about_text, parse_mode="HTML", reply_markup=get_back_inline_keyboard())

# --- Раздел: 👤 Личный кабинет ---
@dp.callback_query(F.data == "nav_profile")
@dp.message(Command("profile"))
async def profile_handler(event: types.CallbackQuery | types.Message, state: FSMContext, bot: Bot):
    user = event.from_user
    if isinstance(event, types.Message):
        try:
            await event.delete()
        except Exception:
            pass
            
    stats = get_user_stats(user.id)
    user_name = user.full_name or user.first_name
    username_str = f" (@{user.username})" if user.username else ""
    
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
    builder.button(text="📅 Записаться на ТО", callback_data="nav_booking")
    builder.button(text="🔙 Назад в меню", callback_data="nav_main")
    builder.adjust(1)
    
    if isinstance(event, types.CallbackQuery):
        await event.answer()
        await event.message.edit_text(profile_text, parse_mode="HTML", reply_markup=builder.as_markup())
    else:
        await bot.send_message(user.id, profile_text, parse_mode="HTML", reply_markup=builder.as_markup())

# Просмотр активных записей
@dp.callback_query(F.data == "view_active_bookings")
async def view_active_bookings_handler(callback: types.CallbackQuery):
    await callback.answer()
    user_id = callback.from_user.id
    bookings = get_user_bookings(user_id, status_filter="Активна")
    
    builder = InlineKeyboardBuilder()
    if not bookings:
        text = (
            "<b>🟢 У вас нет активных записей на данный момент.</b>\n\n"
            "Вы можете записаться на ТО в один клик!"
        )
        builder.button(text="📅 Записаться на ТО", callback_data="nav_booking")
    else:
        text = "<b>🟢 Ваши активные записи:</b>\n\n"
        for b in bookings:
            text += (
                f"<b>Запись №{b['id']}</b>\n"
                f"• <b>Услуга:</b> {b['problem']}\n"
                f"• <b>Автомобиль:</b> {b['car_model']}\n"
                f"• <b>Дата и время:</b> {b['slot']}\n"
                f"• <b>Телефон:</b> {b['phone']}\n"
                "-------------------------\n"
            )
            builder.button(text=f"❌ Отменить запись №{b['id']}", callback_data=f"cancel_db_booking_{b['id']}")
            
    builder.button(text="🔙 Назад в кабинет", callback_data="nav_profile")
    builder.adjust(1)
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=builder.as_markup())

# Просмотр всей истории записей
@dp.callback_query(F.data == "view_all_bookings")
async def view_all_bookings_handler(callback: types.CallbackQuery):
    await callback.answer()
    user_id = callback.from_user.id
    bookings = get_user_bookings(user_id)
    
    if not bookings:
        text = "<b>📜 История ваших записей пуста.</b>"
    else:
        text = "<b>📜 Полная история ваших записей:</b>\n\n"
        for b in bookings:
            status_icon = "🟢" if b["status"] == "Активна" else "🔴"
            text += (
                f"<b>Запись №{b['id']}</b> [{status_icon} {b['status']}]\n"
                f"• <b>Услуга:</b> {b['problem']}\n"
                f"• <b>Автомобиль:</b> {b['car_model']}\n"
                f"• <b>Дата и время:</b> {b['slot']}\n"
                f"• <b>Телефон:</b> {b['phone']}\n"
                "-------------------------\n"
            )
    builder = InlineKeyboardBuilder()
    builder.button(text="🔙 Назад в кабинет", callback_data="nav_profile")
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=builder.as_markup())

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
    
    builder = InlineKeyboardBuilder()
    builder.button(text="🔙 Назад в кабинет", callback_data="nav_profile")
    if success:
        await callback.message.edit_text(
            f"<b>✅ Запись №{booking_id} успешно отменена.</b>",
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )
    else:
        await callback.message.edit_text(
            "⚠️ Не удалось отменить запись или она уже отменена.",
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )

# --- 📅 Интерактивный поток записи на ТО ---

# Шаг 1: Старт записи
@dp.callback_query(F.data == "nav_booking")
async def start_booking_inline(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(BookingState.select_category)
    await callback.message.edit_text(
        "<b>Шаг 1 из 4:</b> Выберите категорию проблемы или напишите её вручную:",
        parse_mode="HTML",
        reply_markup=get_categories_keyboard()
    )

# Выбор категории
@dp.callback_query(F.data.startswith("cat_"))
async def category_selected_inline(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    categories_map = {
        "cat_engine": "🔧 Двигатель и выхлоп",
        "cat_chassis": "🛞 Подвеска и тормоза",
        "cat_electric": "⚡ Электрика и диагностика",
        "cat_to": "🛢 Регулярное ТО",
        "cat_climate": "❄️ Климат и кондиционер",
    }
    
    await state.update_data(card_msg_id=callback.message.message_id)
    
    if callback.data == "cat_custom":
        await state.set_state(BookingState.custom_problem)
        builder = InlineKeyboardBuilder()
        builder.button(text="🔙 Отмена и назад", callback_data="nav_main")
        await callback.message.edit_text(
            "<b>Шаг 1 из 4:</b> Напишите сообщением вашу проблему или нужную услугу:\n\n"
            "<i>(Ваше текстовое сообщение будет автоматически удалено для чистоты чата)</i>",
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )
    else:
        chosen_category = categories_map.get(callback.data, "Общий ремонт")
        await state.update_data(problem=chosen_category)
        await state.set_state(BookingState.enter_car_model)
        
        builder = InlineKeyboardBuilder()
        builder.button(text="🔙 Отмена и назад", callback_data="nav_main")
        await callback.message.edit_text(
            f"Выбрано: <b>{chosen_category}</b>\n\n"
            "<b>Шаг 2 из 4:</b> Напишите сообщением марку и модель автомобиля (например: <i>Опель астра</i> или <i>Toyota Camry</i>):\n\n"
            "<i>(Ваше текстовое сообщение отчистится из чата автоматически)</i>",
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )

# Ручной ввод проблемы текстом
@dp.message(BookingState.custom_problem)
async def custom_problem_entered_inline(message: types.Message, state: FSMContext, bot: Bot):
    text_val = message.text.strip()
    try:
        await message.delete()
    except Exception:
        pass
        
    data = await state.get_data()
    card_msg_id = data.get("card_msg_id")
    
    if len(text_val) < 3:
        if card_msg_id:
            builder = InlineKeyboardBuilder()
            builder.button(text="🔙 Отмена и назад", callback_data="nav_main")
            await bot.edit_message_text(
                "⚠️ <b>Слишком короткое описание.</b>\n"
                "Пожалуйста, напишите подробнее (не менее 3 символов):",
                chat_id=message.chat.id,
                message_id=card_msg_id,
                parse_mode="HTML",
                reply_markup=builder.as_markup()
            )
        return

    await state.update_data(problem=text_val)
    await state.set_state(BookingState.enter_car_model)
    
    builder = InlineKeyboardBuilder()
    builder.button(text="🔙 Отмена и назад", callback_data="nav_main")
    if card_msg_id:
        await bot.edit_message_text(
            f"Проблема принята: <b>{text_val}</b>\n\n"
            "<b>Шаг 2 из 4:</b> Укажите марку и модель автомобиля (например: <i>Тойота Камри</i>):",
            chat_id=message.chat.id,
            message_id=card_msg_id,
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )

# Ввод марки/модели текстом
@dp.message(BookingState.enter_car_model)
async def car_model_entered_inline(message: types.Message, state: FSMContext, bot: Bot):
    text_val = message.text.strip()
    try:
        await message.delete()
    except Exception:
        pass
        
    formatted_car = validate_and_format_car(text_val)
    data = await state.get_data()
    card_msg_id = data.get("card_msg_id")
    
    builder = InlineKeyboardBuilder()
    builder.button(text="🔙 Отмена и назад", callback_data="nav_main")
    
    if not formatted_car:
        if card_msg_id:
            await bot.edit_message_text(
                "⚠️ <b>Некорректное название автомобиля.</b>\n\n"
                "Пожалуйста, введите марку и модель автомобиля правильным текстом.\n"
                "<i>Примеры: Опель астра, BMW X5, Тойота Камри, Kia Rio</i>",
                chat_id=message.chat.id,
                message_id=card_msg_id,
                parse_mode="HTML",
                reply_markup=builder.as_markup()
            )
        return
        
    await state.update_data(car_model=formatted_car)
    await state.set_state(BookingState.select_time_slot)
    
    if card_msg_id:
        await bot.edit_message_text(
            f"Автомобиль принят: <b>{formatted_car}</b>\n\n"
            "<b>Шаг 3 из 4:</b> Выберите точную дату и время визита:",
            chat_id=message.chat.id,
            message_id=card_msg_id,
            parse_mode="HTML",
            reply_markup=get_time_slots_keyboard()
        )

# Выбор слота с датой/временем
@dp.callback_query(F.data.startswith("slot_"))
async def slot_selected_inline(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    slot_text = callback.data.replace("slot_📅 ", "").replace("slot_", "")
    await state.update_data(slot=slot_text)
    await state.set_state(BookingState.enter_phone)
    
    builder = InlineKeyboardBuilder()
    builder.button(text="🔙 Отмена и назад", callback_data="nav_main")
    
    await callback.message.edit_text(
        f"Выбранное время: <b>{slot_text}</b>\n\n"
        "<b>Шаг 4 из 4:</b> Отправьте ваш номер телефона сообщением в чат (например: <i>+79991234567</i>):\n\n"
        "<i>(Сообщение с телефоном удалится из чата сразу после отправки для вашей конфиденциальности)</i>",
        parse_mode="HTML",
        reply_markup=builder.as_markup()
    )

# Ввод телефона
@dp.message(BookingState.enter_phone)
async def phone_entered_inline(message: types.Message, state: FSMContext, bot: Bot):
    if message.contact:
        phone = message.contact.phone_number
    else:
        phone = message.text.strip()
        
    try:
        await message.delete()
    except Exception:
        pass
        
    digits = re.sub(r"\D", "", phone)
    data = await state.get_data()
    card_msg_id = data.get("card_msg_id")
    
    if len(digits) < 7 or len(digits) > 15:
        if card_msg_id:
            builder = InlineKeyboardBuilder()
            builder.button(text="🔙 Отмена и назад", callback_data="nav_main")
            await bot.edit_message_text(
                "⚠️ <b>Некорректный номер телефона.</b>\n"
                "Пожалуйста, введите верный номер (например: +79991234567):",
                chat_id=message.chat.id,
                message_id=card_msg_id,
                parse_mode="HTML",
                reply_markup=builder.as_markup()
            )
        return
        
    await state.update_data(phone=phone)
    updated_data = await state.get_data()
    
    summary = (
        "<b>📋 Подтверждение записи на ТО:</b>\n\n"
        f"• <b>Услуга/Проблема:</b> {updated_data.get('problem')}\n"
        f"• <b>Автомобиль:</b> {updated_data.get('car_model')}\n"
        f"• <b>Дата и время:</b> {updated_data.get('slot')}\n"
        f"• <b>Телефон:</b> {updated_data.get('phone')}\n\n"
        "Всё верно?"
    )
    
    await state.set_state(BookingState.confirm)
    if card_msg_id:
        await bot.edit_message_text(
            summary,
            chat_id=message.chat.id,
            message_id=card_msg_id,
            parse_mode="HTML",
            reply_markup=get_confirm_keyboard()
        )

# Финальное подтверждение записи
@dp.callback_query(F.data == "confirm_booking")
async def confirm_booking_inline(callback: types.CallbackQuery, state: FSMContext):
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
        f"• <b>Дата и время:</b> {data.get('slot')}\n"
        f"• <b>Автомобиль:</b> {data.get('car_model')}\n"
        f"• <b>Услуга:</b> {data.get('problem')}\n\n"
        "Наш мастер свяжется с вами для подтверждения.\n"
        "<i>Вы всегда можете отслеживать статус в «👤 Личном кабинете».</i>"
    )
    
    builder = InlineKeyboardBuilder()
    builder.button(text="👤 Перейти в Личный кабинет", callback_data="nav_profile")
    builder.button(text="🏠 Главное меню", callback_data="nav_main")
    builder.adjust(1)
    
    await callback.message.edit_text(final_text, parse_mode="HTML", reply_markup=builder.as_markup())

async def main():
    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token or bot_token == "your_bot_token_here":
        print("ОШИБКА: Укажите валидный BOT_TOKEN в переменных окружения!", flush=True)
        return

    init_db()
    print("База данных SQLite успешно инициализирована!", flush=True)

    bot = Bot(token=bot_token)
    await bot.delete_webhook(drop_pending_updates=True)
    print("Бот успешно запущен в режиме Интерактивного Одностраничного Меню!", flush=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
