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
from aiogram.types import ReplyKeyboardRemove

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL")

from aiohttp import web
from web_server import create_web_app

from database import (
    init_db, add_booking, get_user_bookings, get_user_stats, 
    cancel_booking_by_id, get_all_bookings, update_booking_status, 
    get_admin_stats, get_booking_by_id
)

logging.basicConfig(level=logging.INFO, stream=sys.stdout)

# Расширенный словарь марок автомобилей (Русский -> Английский)
BRANDS_MAP = {
    "бмв": "BMW", "bmw": "BMW", "опель": "Opel", "opel": "Opel",
    "мерседес-бенц": "Mercedes-Benz", "мерседес бенц": "Mercedes-Benz",
    "мерседес": "Mercedes-Benz", "мерс": "Mercedes-Benz", "тойота": "Toyota", "toyota": "Toyota",
    "хендай": "Hyundai", "хёндэ": "Hyundai", "хенде": "Hyundai", "хюндай": "Hyundai", "hyundai": "Hyundai",
    "киа": "Kia", "kia": "Kia", "фольксваген": "Volkswagen", "фольц": "Volkswagen", "фолькс": "Volkswagen", "volkswagen": "Volkswagen", "vw": "Volkswagen",
    "ауди": "Audi", "audi": "Audi", "ниссан": "Nissan", "nissan": "Nissan", "лада": "Lada", "lada": "Lada", "ваз": "Lada (ВАЗ)",
    "жигули": "Lada", "шкода": "Skoda", "skoda": "Skoda", "форд": "Ford", "ford": "Ford", "мазда": "Mazda", "mazda": "Mazda",
    "субару": "Subaru", "subaru": "Subaru", "рено": "Renault", "renault": "Renault", "пежо": "Peugeot", "peugeot": "Peugeot",
    "ситроен": "Citroen", "citroen": "Citroen", "шевроле": "Chevrolet", "chevrolet": "Chevrolet", "шеви": "Chevrolet",
    "митсубиси": "Mitsubishi", "мицубиси": "Mitsubishi", "мицубиши": "Mitsubishi", "mitsubishi": "Mitsubishi",
    "хонда": "Honda", "honda": "Honda", "лексус": "Lexus", "lexus": "Lexus", "инфинити": "Infiniti", "infiniti": "Infiniti",
    "порше": "Porsche", "порш": "Porsche", "porsche": "Porsche", "вольво": "Volvo", "volvo": "Volvo",
    "сузуки": "Suzuki", "suzuki": "Suzuki", "уаз": "UAZ", "uaz": "UAZ", "газ": "GAZ", "gaz": "GAZ", "москвич": "Moskvich",
    "чери": "Chery", "chery": "Chery", "хавал": "Haval", "хавейл": "Haval", "haval": "Haval", "джили": "Geely", "geely": "Geely",
    "эксид": "Exeed", "exeed": "Exeed", "омода": "Omoda", "omoda": "Omoda", "чанган": "Changan", "changan": "Changan",
    "ягуар": "Jaguar", "jaguar": "Jaguar", "ленд ровер": "Land Rover", "лэнд ровер": "Land Rover", "land rover": "Land Rover",
    "рейндж ровер": "Range Rover", "ранж ровер": "Range Rover", "range rover": "Range Rover", "тесла": "Tesla", "tesla": "Tesla",
    "джип": "Jeep", "jeep": "Jeep", "додж": "Dodge", "dodge": "Dodge", "крайслер": "Chrysler", "chrysler": "Chrysler",
    "кадиллак": "Cadillac", "cadillac": "Cadillac", "линкольн": "Lincoln", "lincoln": "Lincoln", "фиат": "Fiat", "fiat": "Fiat",
    "альфа ромео": "Alfa Romeo", "alfa romeo": "Alfa Romeo", "сеат": "Seat", "seat": "Seat", "танк": "Tank", "tank": "Tank",
    "зикр": "Zeekr", "zeekr": "Zeekr", "ли авто": "Li Auto", "ликсианг": "Lixiang", "li auto": "Li Auto", "lixiang": "Lixiang",
    "воях": "Voyah", "voyah": "Voyah", "джек": "JAC", "jac": "JAC", "фав": "FAW", "faw": "FAW", "лифан": "Lifan", "lifan": "Lifan",
    "грейт вол": "Great Wall", "great wall": "Great Wall", "лифан": "Lifan",
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

# Список ключевых авто-терминов для проверки описания проблемы
AUTO_KEYWORDS = [
    "ремонт", "замена", "стуч", "скрип", "шум", "масл", "колодк", "двигател", "мотор", 
    "коробк", "тормоз", "подвеск", "стоек", "колес", "диагност", "фильтр", "свечи", 
    "аккумул", "электрик", "кондиционер", "климат", "печк", "фара", "бампер", "кузов", 
    "рул", "рейк", "глушител", "то", "течь", "гори", "чек", "не работ", "проблем", 
    "сломал", "течет", "греет", "кипит", "вибрир", "завод", "глохнет", "троит", 
    "тяга", "турбин", "шин", "диск", "покраск", "полировк", "чистк", "заправк", 
    "промывк", "регулировк", "сход", "развал", "патрубок", "жидкост", "антифриз", 
    "тосол", "гур", "помпа", "стартер", "генератор", "сцеплен", "акпп", "мкпп", "вариатор"
]

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

def validate_custom_problem(text: str) -> bool:
    """Ультра-строгая валидация описания проблемы от спама и бессмыслицы"""
    clean_text = text.strip()
    if len(clean_text) < 4 or len(clean_text) > 120:
        return False
        
    # Блокировка ссылок и спама
    if re.search(r"http[s]?://|www\.|t\.me/", clean_text.lower()):
        return False
        
    # Блокировка клавиатурных последовательностей (йцукен, фывапрол, qwerty, asdfgh)
    kb_patterns = [r"qwerty", r"asdfgh", r"zxcvbn", r"йцукен", r"фывапр", r"ячсмит"]
    for pat in kb_patterns:
        if re.search(pat, clean_text.lower()):
            return False
            
    # Должно быть не менее 4 букв
    letters = re.findall(r"[a-zA-Zа-яА-ЯёЁ]", clean_text)
    if len(letters) < 4:
        return False
        
    # Доля букв от общей длины не менее 50%
    if len(letters) / len(clean_text) < 0.5:
        return False
        
    # Блокировка повторяющихся букв (аааааа)
    if re.search(r"([a-zA-Zа-яА-ЯёЁ])\1{2,}", clean_text.lower()):
        return False
        
    # Блокировка набора согласных (фвпрлджкнг)
    if re.search(r"[бвгджзклмнпрстфхцчшщbcdfghjklmnpqrstvwxyz]{5,}", clean_text.lower()):
        return False

    # Проверка доли гласных букв (в реальных словах доля гласных составляет от 20% до 65%)
    vowels = re.findall(r"[аеёиоуыэюяaeiouy]", clean_text.lower())
    if len(vowels) / len(letters) < 0.18 or len(vowels) / len(letters) > 0.70:
        return False

    # ПРОВЕРКА: Содержит ли текст хотя бы одно авто-слово ИЛИ осмысленную фразу (из 2+ слов с гласными)
    has_auto_keyword = any(kw in clean_text.lower() for kw in AUTO_KEYWORDS)
    words = [w for w in clean_text.split() if len(w) >= 2]
    
    if not has_auto_keyword and len(words) < 2:
        return False

    return True

def validate_and_format_car(text: str) -> str | None:
    """Максимально строгая валидация марки и модели авто с обязательной проверкой по авто-базе"""
    clean_text = text.strip()
    if len(clean_text) < 2 or len(clean_text) > 40:
        return None
        
    # Ссылки и спам заблокированы
    if re.search(r"http[s]?://|www\.|t\.me/", clean_text.lower()):
        return None
        
    # Обязательно наличие букв
    letters = re.findall(r"[a-zA-Zа-яА-ЯёЁ]", clean_text)
    if len(letters) < 2:
        return None
        
    # Доля букв от общей длины не менее 50%
    if len(letters) / len(clean_text) < 0.5:
        return None
        
    # Блокировка клавиатурных заборчиков
    kb_patterns = [r"qwerty", r"asdfgh", r"zxcvbn", r"йцукен", r"фывапр", r"ячсмит"]
    for pat in kb_patterns:
        if re.search(pat, clean_text.lower()):
            return None

    # Блокировка повторяющихся букв (ааааа)
    if re.search(r"([a-zA-Zа-яА-ЯёЁ])\1{2,}", clean_text.lower()):
        return None
        
    # Блокировка хаотичного набора согласных
    if re.search(r"[бвгджзклмнпрстфхцчшщbcdfghjklmnpqrstvwxyz]{4,}", clean_text.lower()):
        return None

    words = clean_text.split()
    formatted_words = []
    has_known_car_entity = False
    
    i = 0
    while i < len(words):
        word_lower = words[i].lower()
        if i + 1 < len(words):
            two_words = f"{word_lower} {words[i+1].lower()}"
            if two_words in BRANDS_MAP:
                formatted_words.append(BRANDS_MAP[two_words])
                has_known_car_entity = True
                i += 2
                continue
            if two_words in MODELS_MAP:
                formatted_words.append(MODELS_MAP[two_words])
                has_known_car_entity = True
                i += 2
                continue
                
        if word_lower in BRANDS_MAP:
            formatted_words.append(BRANDS_MAP[word_lower])
            has_known_car_entity = True
        elif word_lower in MODELS_MAP:
            formatted_words.append(MODELS_MAP[word_lower])
            has_known_car_entity = True
        elif re.search(r"[а-яА-ЯёЁ]", words[i]):
            formatted_words.append(transliterate_word(words[i]))
        else:
            formatted_words.append(words[i].capitalize() if words[i].isalpha() else words[i])
        i += 1
        
    # ЖЕСТКАЯ ПРОВЕРКА: В тексте обязательно должна быть распознана известная марка или модель авто из базы!
    if not has_known_car_entity:
        return None

    return " ".join(formatted_words)

# Состояния FSM для записи на ТО
class BookingState(StatesGroup):
    select_category = State()
    custom_problem = State()
    enter_car_model = State()
    select_time_slot = State()
    enter_phone = State()
    confirm = State()

# Состояния FSM для модератора
class AdminState(StatesGroup):
    enter_comment = State()

# --- Инлайн-клавиатуры для единого интерактивного меню ---

def get_main_inline_keyboard():
    builder = InlineKeyboardBuilder()
    if WEBAPP_URL:
        builder.button(text="📱 Открыть Mini App", web_app=types.WebAppInfo(url=WEBAPP_URL))
    builder.button(text="🛠 Услуги и цены", callback_data="nav_services")
    builder.button(text="📅 Записаться на ТО", callback_data="nav_booking")
    builder.button(text="👤 Личный кабинет", callback_data="nav_profile")
    builder.button(text="📍 Контакты и адрес", callback_data="nav_contacts")
    builder.button(text="ℹ️ О нас", callback_data="nav_about")
    builder.button(text="🔄 Обновить меню", callback_data="nav_main")
    if WEBAPP_URL:
        builder.adjust(1, 2, 2, 2, 1)
    else:
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
    data = await state.get_data()
    old_card_id = data.get("card_msg_id")
    await state.clear()
    
    text = f"Здравствуйте, {user_first_name}!\n\n" + MAIN_WELCOME_TEXT
    
    if callback:
        try:
            await callback.message.edit_text(text, parse_mode="HTML", reply_markup=get_main_inline_keyboard())
            await state.update_data(card_msg_id=callback.message.message_id)
            return
        except Exception:
            pass
            
    if old_card_id:
        try:
            await bot.delete_message(chat_id, old_card_id)
        except Exception:
            pass

    msg = await bot.send_message(chat_id, text, parse_mode="HTML", reply_markup=get_main_inline_keyboard())
    await state.update_data(card_msg_id=msg.message_id)

# --- Навигация по /start, /restart ---
@dp.message(Command("start"))
@dp.message(Command("restart"))
async def cmd_start(message: types.Message, state: FSMContext, bot: Bot):
    try:
        await message.delete()
    except Exception:
        pass
        
    rm_msg = await bot.send_message(message.chat.id, "🔄 Обновление интерфейса...", reply_markup=ReplyKeyboardRemove())
    try:
        await rm_msg.delete()
    except Exception:
        pass
        
    await show_main_menu(bot, message.chat.id, message.from_user.first_name, state)

@dp.callback_query(F.data == "nav_main")
async def nav_main_handler(callback: types.CallbackQuery, state: FSMContext, bot: Bot):
    await callback.answer("Меню обновлено! 🔄")
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
        f"• ⏳ На рассмотрении / Активных: <b>{stats['active']}</b>\n"
        f"• 📁 Всего заявок: <b>{stats['total']}</b>\n"
        f"• 🔴 Отклоненных: <b>{stats['cancelled']}</b>\n\n"
        "Выберите нужное действие ниже:"
    )
    
    builder = InlineKeyboardBuilder()
    builder.button(text=f"📋 Ваши записи ({stats['active']})", callback_data="view_active_bookings")
    builder.button(text="📜 Вся история визитов", callback_data="view_all_bookings")
    builder.button(text="📅 Записаться на ТО", callback_data="nav_booking")
    builder.button(text="🔙 Назад в меню", callback_data="nav_main")
    builder.adjust(1)
    
    if isinstance(event, types.CallbackQuery):
        await event.answer()
        await event.message.edit_text(profile_text, parse_mode="HTML", reply_markup=builder.as_markup())
    else:
        await bot.send_message(user.id, profile_text, parse_mode="HTML", reply_markup=builder.as_markup())

# Просмотр активных записей клиентом
@dp.callback_query(F.data == "view_active_bookings")
async def view_active_bookings_handler(callback: types.CallbackQuery):
    await callback.answer()
    user_id = callback.from_user.id
    bookings = get_user_bookings(user_id)
    active_bookings = [b for b in bookings if b["status"] in ("На рассмотрении", "Одобрена", "Активна")]
    
    builder = InlineKeyboardBuilder()
    if not active_bookings:
        text = (
            "<b>🟢 У вас нет активных записей на данный момент.</b>\n\n"
            "Вы можете записаться на ТО в один клик!"
        )
        builder.button(text="📅 Записаться на ТО", callback_data="nav_booking")
    else:
        text = "<b>🟢 Ваши активные и текущие записи:</b>\n\n"
        for b in active_bookings:
            status_icon = "⏳" if b["status"] == "На рассмотрении" else "✅"
            comment_str = f"\n• 💬 <b>Комментарий:</b> <i>{b['comment']}</i>" if b["comment"] else ""
            text += (
                f"<b>Запись №{b['id']}</b> [{status_icon} <b>{b['status']}</b>]\n"
                f"• <b>Услуга:</b> {b['problem']}\n"
                f"• <b>Автомобиль:</b> {b['car_model']}\n"
                f"• <b>Дата и время:</b> {b['slot']}\n"
                f"• <b>Телефон:</b> {b['phone']}"
                f"{comment_str}\n"
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
            status_icon = "⏳" if b["status"] == "На рассмотрении" else ("✅" if b["status"] == "Одобрена" else "🔴")
            comment_str = f"\n• 💬 <b>Комментарий:</b> <i>{b['comment']}</i>" if b["comment"] else ""
            text += (
                f"<b>Запись №{b['id']}</b> [{status_icon} {b['status']}]\n"
                f"• <b>Услуга:</b> {b['problem']}\n"
                f"• <b>Автомобиль:</b> {b['car_model']}\n"
                f"• <b>Дата и время:</b> {b['slot']}\n"
                f"• <b>Телефон:</b> {b['phone']}"
                f"{comment_str}\n"
                "-------------------------\n"
            )
    builder = InlineKeyboardBuilder()
    builder.button(text="🔙 Назад в кабинет", callback_data="nav_profile")
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=builder.as_markup())

# Отмена записи пользователем
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

@dp.callback_query(F.data == "nav_booking")
async def start_booking_inline(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(BookingState.select_category)
    await callback.message.edit_text(
        "<b>Шаг 1 из 4:</b> Выберите категорию проблемы или напишите её вручную:",
        parse_mode="HTML",
        reply_markup=get_categories_keyboard()
    )

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

@dp.message(BookingState.custom_problem)
async def custom_problem_entered_inline(message: types.Message, state: FSMContext, bot: Bot):
    text_val = message.text.strip()
    try:
        await message.delete()
    except Exception:
        pass
        
    data = await state.get_data()
    card_msg_id = data.get("card_msg_id")
    
    if not validate_custom_problem(text_val):
        if card_msg_id:
            builder = InlineKeyboardBuilder()
            builder.button(text="🔙 Отмена и назад", callback_data="nav_main")
            await bot.edit_message_text(
                "⚠️ <b>Некорректно описана проблема!</b>\n\n"
                "Пожалуйста, введите понятное описание поломки или услуги текстом (без чистых цифр, спецсимволов, хаотичных букв и спама).\n"
                "<i>Примеры: Замена передних колодок, Стучит подвеска справа, ТО масло и фильтры</i>",
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
                "⚠️ <b>Некорректное название автомобиля!</b>\n\n"
                "Пожалуйста, введите настоящую марку и модель автомобиля правильным текстом (без чистых цифр, символов, спама и наборных букв).\n"
                "<i>Примеры: Опель астра, BMW X5, Тойота Камри, Kia Rio, Хендай Солярис</i>",
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

# --- 👑 ФУНКЦИОНАЛ И ПАНЕЛЬ МОДЕРАТОРА ---

def get_admin_ids() -> list[int]:
    raw = os.getenv("ADMIN_IDS", "")
    return [int(x.strip()) for x in raw.split(",") if x.strip().isdigit()]

async def process_moderator_decision(bot: Bot, booking_id: int, new_status: str, comment: str = "", callback: types.CallbackQuery = None):
    """Обновление статуса в БД + автоматическое уведомление клиента"""
    success = update_booking_status(booking_id, new_status, comment)
    booking = get_booking_by_id(booking_id)
    
    if success and booking:
        # Уведомление клиенту
        client_id = booking["user_id"]
        comment_text = f"\n\n💬 <b>Комментарий автосервиса:</b> <i>\"{comment}\"</i>" if comment else ""
        
        if new_status == "Одобрена":
            client_msg = (
                f"🎉 <b>Ваша запись №{booking_id} ОДОБРЕНА!</b>\n\n"
                f"• <b>Дата и время:</b> {booking['slot']}\n"
                f"• <b>Автомобиль:</b> {booking['car_model']}\n"
                f"• <b>Услуга:</b> {booking['problem']}"
                f"{comment_text}\n\n"
                "Ждем вас в назначенное время в автосервисе! 🚗"
            )
        else:
            client_msg = (
                f"❌ <b>Ваша запись №{booking_id} ОТКЛОНЕНА.</b>\n\n"
                f"• <b>Дата и время:</b> {booking['slot']}\n"
                f"• <b>Автомобиль:</b> {booking['car_model']}"
                f"{comment_text}\n\n"
                "Вы можете выбрать другое удобное время или связаться с нами."
            )
            
        builder = InlineKeyboardBuilder()
        builder.button(text="👤 Мой кабинет", callback_data="nav_profile")
        builder.button(text="📅 Новая запись", callback_data="nav_booking")
        builder.adjust(2)
        
        try:
            await bot.send_message(client_id, client_msg, parse_mode="HTML", reply_markup=builder.as_markup())
        except Exception as e:
            logging.error(f"Не удалось отправить уведомление клиенту {client_id}: {e}")

    # Обновляем сообщение модератора
    if callback:
        status_label = "✅ ОДОБРЕНА" if new_status == "Одобрена" else "❌ ОТКЛОНЕНА"
        comment_label = f"\n💬 Комментарий: <i>\"{comment}\"</i>" if comment else ""
        
        builder = InlineKeyboardBuilder()
        builder.button(text="👑 Вернуться в админку", callback_data="adm_panel")
        
        try:
            await callback.message.edit_text(
                f"<b>Статус записи №{booking_id} изменен на {status_label}!</b>{comment_label}\n\n"
                "<i>Клиенту автоматически отправлено уведомление в Telegram.</i>",
                parse_mode="HTML",
                reply_markup=builder.as_markup()
            )
        except Exception:
            pass

@dp.message(Command("admin"))
async def admin_panel_handler(message: types.Message, state: FSMContext, bot: Bot):
    try:
        await message.delete()
    except Exception:
        pass
        
    admin_ids = get_admin_ids()
    if not admin_ids:
        await message.answer(
            f"<b>⚙️ Настройка модератора</b>\n\n"
            f"Ваш Telegram ID: <code>{message.from_user.id}</code>\n\n"
            "Чтобы включить панель модератора, добавьте этот ID в переменные окружения на хостинге или в файл <code>.env</code>:\n"
            f"<code>ADMIN_IDS={message.from_user.id}</code>",
            parse_mode="HTML"
        )
        return
        
    if message.from_user.id not in admin_ids:
        await message.answer("⚠️ Доступ запрещен. Ваш ID не найден в списке модераторов.", parse_mode="HTML")
        return
        
    await show_admin_panel(bot, message.chat.id)

async def show_admin_panel(bot: Bot, chat_id: int, callback: types.CallbackQuery = None):
    stats = get_admin_stats()
    admin_text = (
        "<b>👑 Панель Модератора Автосервиса</b>\n\n"
        "<b>📊 Общая статистика заявок:</b>\n"
        f"• ⏳ На рассмотрении: <b>{stats['pending']}</b>\n"
        f"• ✅ Одобрено: <b>{stats['approved']}</b>\n"
        f"• 🔴 Отклонено: <b>{stats['rejected']}</b>\n"
        f"• 📁 Всего в базе: <b>{stats['total']}</b>\n\n"
        "Выберите действие для модерации:"
    )
    builder = InlineKeyboardBuilder()
    builder.button(text=f"⏳ На рассмотрении ({stats['pending']})", callback_data="adm_view_pending")
    builder.button(text="📁 Вся база записей", callback_data="adm_view_all")
    builder.button(text="🔄 Обновить панель", callback_data="adm_panel")
    builder.button(text="🏠 Главное меню", callback_data="nav_main")
    builder.adjust(1)
    
    if callback:
        try:
            await callback.message.edit_text(admin_text, parse_mode="HTML", reply_markup=builder.as_markup())
            return
        except Exception:
            pass
    await bot.send_message(chat_id, admin_text, parse_mode="HTML", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "adm_panel")
async def adm_panel_callback(callback: types.CallbackQuery, bot: Bot):
    await callback.answer("Данные обновлены! 🔄")
    await show_admin_panel(bot, callback.message.chat.id, callback)

# Просмотр записей на рассмотрении модератором
@dp.callback_query(F.data == "adm_view_pending")
async def adm_view_pending_handler(callback: types.CallbackQuery):
    await callback.answer()
    bookings = get_all_bookings(status_filter="На рассмотрении")
    
    if not bookings:
        builder = InlineKeyboardBuilder()
        builder.button(text="🔙 Назад в админку", callback_data="adm_panel")
        await callback.message.edit_text(
            "<b>⏳ Нет новых заявок на рассмотрении.</b>",
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )
        return
        
    for b in bookings:
        card = (
            f"⏳ <b>ЗАЯВКА НА ТО №{b['id']}</b>\n\n"
            f"• <b>Клиент:</b> {b['user_name']}\n"
            f"• <b>Телефон:</b> {b['phone']}\n"
            f"• <b>Автомобиль:</b> {b['car_model']}\n"
            f"• <b>Услуга:</b> {b['problem']}\n"
            f"• <b>Дата и время:</b> {b['slot']}\n"
        )
        builder = InlineKeyboardBuilder()
        builder.button(text="✅ Одобрить", callback_data=f"adm_dec_{b['id']}_approve")
        builder.button(text="❌ Отклонить", callback_data=f"adm_dec_{b['id']}_reject")
        builder.button(text="💬 Одобрить с комментом", callback_data=f"adm_comm_{b['id']}_approve")
        builder.button(text="💬 Отклонить с комментом", callback_data=f"adm_comm_{b['id']}_reject")
        builder.adjust(2, 2)
        await callback.message.answer(card, parse_mode="HTML", reply_markup=builder.as_markup())

# Просмотр всей базы записей модератором
@dp.callback_query(F.data == "adm_view_all")
async def adm_view_all_handler(callback: types.CallbackQuery):
    await callback.answer()
    bookings = get_all_bookings()
    
    if not bookings:
        builder = InlineKeyboardBuilder()
        builder.button(text="🔙 Назад в админку", callback_data="adm_panel")
        await callback.message.edit_text(
            "<b>📁 База записей пуста.</b>",
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )
        return
        
    response = "<b>📁 Архив всех записей клиентов:</b>\n\n"
    for b in bookings[:15]:
        status_icon = "⏳" if b["status"] == "На рассмотрении" else ("✅" if b["status"] == "Одобрена" else "🔴")
        comment_str = f" (Коммент: {b['comment']})" if b["comment"] else ""
        response += (
            f"<b>Запись №{b['id']}</b> [{status_icon} {b['status']}]\n"
            f"• <b>Клиент:</b> {b['user_name']} ({b['phone']})\n"
            f"• <b>Автомобиль:</b> {b['car_model']}\n"
            f"• <b>Дата/время:</b> {b['slot']}{comment_str}\n"
            "-------------------------\n"
        )
    builder = InlineKeyboardBuilder()
    builder.button(text="🔙 Назад в админку", callback_data="adm_panel")
    await callback.message.edit_text(response, parse_mode="HTML", reply_markup=builder.as_markup())

# Прямое решение без комментария
@dp.callback_query(F.data.startswith("adm_dec_"))
async def adm_direct_decision_handler(callback: types.CallbackQuery, bot: Bot):
    parts = callback.data.split("_")
    booking_id = int(parts[2])
    action = parts[3]
    
    new_status = "Одобрена" if action == "approve" else "Отклонена"
    await process_moderator_decision(bot, booking_id, new_status=new_status, comment="", callback=callback)

# Решение с комментарием (запрос ввода текста у модератора)
@dp.callback_query(F.data.startswith("adm_comm_"))
async def adm_comment_request_handler(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    parts = callback.data.split("_")
    booking_id = int(parts[2])
    action = parts[3]
    
    await state.set_state(AdminState.enter_comment)
    await state.update_data(target_booking_id=booking_id, target_action=action, admin_msg_id=callback.message.message_id)
    
    action_text = "ОДОБРЕНИЯ" if action == "approve" else "ОТКЛОНЕНИЯ"
    
    builder = InlineKeyboardBuilder()
    builder.button(text="🔙 Отмена", callback_data="adm_panel")
    await callback.message.edit_text(
        f"<b>✍️ Ввод комментария для {action_text} заявки №{booking_id}:</b>\n\n"
        "Напишите сообщением в чат ваш комментарий для клиента (например: <i>«Ждем вас на 2-м боксе»</i> или <i>«На это время все подъёмники заняты»</i>):",
        parse_mode="HTML",
        reply_markup=builder.as_markup()
    )

# Прием комментария от модератора
@dp.message(AdminState.enter_comment)
async def adm_comment_received(message: types.Message, state: FSMContext, bot: Bot):
    comment_text = message.text.strip()
    try:
        await message.delete()
    except Exception:
        pass
        
    data = await state.get_data()
    booking_id = data.get("target_booking_id")
    action = data.get("target_action")
    admin_msg_id = data.get("admin_msg_id")
    await state.clear()
    
    new_status = "Одобрена" if action == "approve" else "Отклонена"
    
    class FakeCallback:
        def __init__(self, msg):
            self.message = msg
        async def answer(self, *args, **kwargs):
            pass

    fake_cb = None
    if admin_msg_id:
        try:
            fake_msg = await bot.send_message(message.chat.id, "Обработка...", reply_markup=types.ReplyKeyboardRemove())
            fake_msg.message_id = admin_msg_id
            fake_cb = FakeCallback(fake_msg)
        except Exception:
            pass

    await process_moderator_decision(bot, booking_id, new_status=new_status, comment=comment_text, callback=fake_cb)

# Финальное подтверждение записи клиентом
@dp.callback_query(F.data == "confirm_booking")
async def confirm_booking_inline(callback: types.CallbackQuery, state: FSMContext, bot: Bot):
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
        f"<b>🎉 Заявка №{booking_id} создана и отправлена на рассмотрение!</b>\n\n"
        f"• <b>Дата и время:</b> {data.get('slot')}\n"
        f"• <b>Автомобиль:</b> {data.get('car_model')}\n"
        f"• <b>Услуга:</b> {data.get('problem')}\n\n"
        "⏳ <i>Ваша заявка находится на рассмотрении у модератора. "
        "Мы автоматически пришлем вам уведомление в Telegram, как только модератор проверит запись.</i>"
    )
    
    builder = InlineKeyboardBuilder()
    builder.button(text="👤 Перейти в Личный кабинет", callback_data="nav_profile")
    builder.button(text="🏠 Главное меню", callback_data="nav_main")
    builder.adjust(1)
    
    await callback.message.edit_text(final_text, parse_mode="HTML", reply_markup=builder.as_markup())

    # Мгновенное уведомление модераторам
    admin_ids = get_admin_ids()
    if admin_ids:
        user_mention = f"@{callback.from_user.username}" if callback.from_user.username else callback.from_user.full_name
        admin_card = (
            f"🚨 <b>НОВАЯ ЗАЯВКА НА ТО №{booking_id}!</b> (⏳ На рассмотрении)\n\n"
            f"• <b>Клиент:</b> {user_mention} (ID: {callback.from_user.id})\n"
            f"• <b>Телефон:</b> {data.get('phone')}\n"
            f"• <b>Автомобиль:</b> {data.get('car_model')}\n"
            f"• <b>Услуга:</b> {data.get('problem')}\n"
            f"• <b>Дата и время:</b> {data.get('slot')}\n"
        )
        adm_builder = InlineKeyboardBuilder()
        adm_builder.button(text="✅ Одобрить", callback_data=f"adm_dec_{booking_id}_approve")
        adm_builder.button(text="❌ Отклонить", callback_data=f"adm_dec_{booking_id}_reject")
        adm_builder.button(text="💬 Одобрить + коммент", callback_data=f"adm_comm_{booking_id}_approve")
        adm_builder.button(text="💬 Отклонить + коммент", callback_data=f"adm_comm_{booking_id}_reject")
        adm_builder.adjust(2, 2)
        
        for adm_id in admin_ids:
            try:
                await bot.send_message(adm_id, admin_card, parse_mode="HTML", reply_markup=adm_builder.as_markup())
            except Exception as e:
                logging.error(f"Не удалось отправить уведомление модератору {adm_id}: {e}")

async def main():
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token or bot_token == "your_bot_token_here":
        print("ОШИБКА: Укажите валидный BOT_TOKEN в переменных окружения!", flush=True)
        return

    init_db()
    print("База данных SQLite успешно инициализирована!", flush=True)

    bot = Bot(token=bot_token)
    await bot.delete_webhook(drop_pending_updates=True)

    if WEBAPP_URL:
        if WEBAPP_URL.startswith("https://"):
            try:
                await bot.set_chat_menu_button(
                    menu_button=types.MenuButtonWebApp(
                        text="🚗 Mini App",
                        web_app=types.WebAppInfo(url=WEBAPP_URL)
                    )
                )
                print(f"[OK] Кнопка меню Mini App успешно привязана к {WEBAPP_URL}", flush=True)
            except Exception as e:
                logging.warning(f"[WARN] Ошибка установки кнопки WebApp через API: {e}")
        else:
            print(f"[INFO] WEBAPP_URL ({WEBAPP_URL}) использует HTTP. Telegram требует HTTPS для встроенных WebApp.", flush=True)

    # Запуск встроенного веб-сервера Mini App
    web_app = create_web_app(bot)
    runner = web.AppRunner(web_app)
    await runner.setup()
    port = int(os.getenv("PORT", "8080"))
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    print(f"[OK] Mini App сервер запущен на http://0.0.0.0:{port}", flush=True)

    print("Бот успешно запущен!", flush=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
