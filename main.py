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
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.types import ReplyKeyboardRemove
from aiohttp import web

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL")

from database import (
    init_db, add_booking, get_user_bookings, get_user_stats, 
    cancel_booking_by_id, get_all_bookings, update_booking_status, 
    get_admin_stats, get_booking_by_id, delete_booking_by_id,
    mark_master_bookings_unavailable, reschedule_booking
)

logging.basicConfig(level=logging.INFO, stream=sys.stdout)

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
    "грейт вол": "Great Wall", "great wall": "Great Wall",
}

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
    clean_text = text.strip()
    if len(clean_text) < 4 or len(clean_text) > 120:
        return False
        
    if re.search(r"http[s]?://|www\.|t\.me/", clean_text.lower()):
        return False
        
    kb_patterns = [r"qwerty", r"asdfgh", r"zxcvbn", r"йцукен", r"фывапр", r"ячсмит"]
    for pat in kb_patterns:
        if re.search(pat, clean_text.lower()):
            return False
            
    letters = re.findall(r"[a-zA-Zа-яА-ЯёЁ]", clean_text)
    if len(letters) < 4:
        return False
        
    if len(letters) / len(clean_text) < 0.5:
        return False
        
    if re.search(r"([a-zA-Zа-яА-ЯёЁ])\1{2,}", clean_text.lower()):
        return False
        
    if re.search(r"[бвгджзклмнпрстфхцчшщbcdfghjklmnpqrstvwxyz]{5,}", clean_text.lower()):
        return False

    vowels = re.findall(r"[аеёиоуыэюяaeiouy]", clean_text.lower())
    if len(vowels) / len(letters) < 0.18 or len(vowels) / len(letters) > 0.70:
        return False

    has_auto_keyword = any(kw in clean_text.lower() for kw in AUTO_KEYWORDS)
    words = [w for w in clean_text.split() if len(w) >= 2]
    
    if not has_auto_keyword and len(words) < 2:
        return False

    return True

def validate_and_format_car(text: str) -> str | None:
    clean_text = text.strip()
    if len(clean_text) < 2 or len(clean_text) > 50:
        return None
        
    if re.search(r"http[s]?://|www\.|t\.me/", clean_text.lower()):
        return None
        
    letters = re.findall(r"[a-zA-Zа-яА-ЯёЁ]", clean_text)
    if len(letters) < 1:
        return None

    kb_patterns = [r"qwerty", r"asdfgh", r"zxcvbn", r"йцукен", r"фывапр", r"ячсмит"]
    for pat in kb_patterns:
        if re.search(pat, clean_text.lower()):
            return None

    if re.search(r"([a-zA-Zа-яА-ЯёЁ])\1{3,}", clean_text.lower()):
        return None

    words = clean_text.split()
    formatted_words = []
    
    i = 0
    while i < len(words):
        word_lower = words[i].lower()
        if i + 1 < len(words):
            two_words = f"{word_lower} {words[i+1].lower()}"
            if two_words in BRANDS_MAP:
                formatted_words.append(BRANDS_MAP[two_words])
                i += 2
                continue
            if two_words in MODELS_MAP:
                formatted_words.append(MODELS_MAP[two_words])
                i += 2
                continue
                
        if word_lower in BRANDS_MAP:
            formatted_words.append(BRANDS_MAP[word_lower])
        elif word_lower in MODELS_MAP:
            formatted_words.append(MODELS_MAP[word_lower])
        elif re.fullmatch(r"[а-яА-ЯёЁ]+", words[i]):
            formatted_words.append(transliterate_word(words[i]))
        else:
            formatted_words.append(words[i].capitalize() if words[i].isalpha() else words[i].upper() if len(words[i]) <= 3 and words[i].isalnum() else words[i].capitalize())
        i += 1
        
    result = " ".join(formatted_words)
    return result if len(result) >= 2 else None


class BookingState(StatesGroup):
    select_category = State()
    custom_problem = State()
    select_master = State()
    enter_car_model = State()
    enter_car_number = State()
    select_time_slot = State()
    enter_phone = State()
    confirm = State()

class AdminState(StatesGroup):
    enter_comment = State()

def get_main_inline_keyboard():
    builder = InlineKeyboardBuilder()
    if WEBAPP_URL and WEBAPP_URL.startswith("https://"):
        builder.button(text="Открыть Mini App", web_app=types.WebAppInfo(url=WEBAPP_URL))
    builder.button(text="Услуги и цены", callback_data="nav_services")
    builder.button(text="Записаться на ТО", callback_data="nav_booking")
    builder.button(text="Личный кабинет", callback_data="nav_profile")
    builder.button(text="Контакты и адрес", callback_data="nav_contacts")
    builder.button(text="О нас", callback_data="nav_about")
    builder.button(text="Обновить меню", callback_data="nav_main")
    if WEBAPP_URL and WEBAPP_URL.startswith("https://"):
        builder.adjust(1, 2, 2, 2, 1)
    else:
        builder.adjust(2, 1, 2, 1)
    return builder.as_markup()

def get_back_inline_keyboard():
    builder = InlineKeyboardBuilder()
    builder.button(text="Назад в меню", callback_data="nav_main")
    return builder.as_markup()

def get_categories_keyboard():
    builder = InlineKeyboardBuilder()
    categories = [
        ("Двигатель и выхлопная система", "cat_engine"),
        ("Подвеска и тормозная система", "cat_chassis"),
        ("Электрика и автоэлектроника", "cat_electric"),
        ("Регулярное ТО и масляный сервис", "cat_to"),
        ("Климат и кондиционер", "cat_climate"),
        ("Написать проблему своими словами", "cat_custom"),
    ]
    for text, callback_data in categories:
        builder.button(text=text, callback_data=callback_data)
    builder.button(text="Назад в меню", callback_data="nav_main")
    builder.adjust(1)
    return builder.as_markup()

def get_masters_keyboard():
    builder = InlineKeyboardBuilder()
    masters = [
        ("Любой свободный мастер", "m_any"),
        ("Алексей Смирнов (Двигатель/ТО)", "m_alexey"),
        ("Дмитрий Ковалев (Диагност)", "m_dmitry"),
        ("Игорь Соколов (Ходовая)", "m_igor"),
    ]
    for text, callback_data in masters:
        builder.button(text=text, callback_data=callback_data)
    builder.button(text="Назад в меню", callback_data="nav_main")
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
        for time_str in ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00"]:
            slot_label = f"{date_str} ({day_name}) в {time_str}"
            builder.button(text=slot_label, callback_data=f"slot_{slot_label}")
    builder.button(text="Назад в меню", callback_data="nav_main")
    builder.adjust(2)
    return builder.as_markup()

def get_confirm_keyboard():
    builder = InlineKeyboardBuilder()
    builder.button(text="Подтвердить запись", callback_data="confirm_booking")
    builder.button(text="Отменить", callback_data="nav_main")
    builder.adjust(2)
    return builder.as_markup()

dp = Dispatcher(storage=MemoryStorage())

MAIN_WELCOME_TEXT = (
    "<b>Интерактивный Автосервис AutoFriends</b>\n\n"
    "Добро пожаловать! Вы можете полностью записаться на ТО или ремонт прямо здесь через Telegram бота.\n"
    "Выберите нужное действие ниже:"
)

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

@dp.message(Command("start"))
@dp.message(Command("restart"))
async def cmd_start(message: types.Message, state: FSMContext, bot: Bot):
    try:
        await message.delete()
    except Exception:
        pass
        
    rm_msg = await bot.send_message(message.chat.id, "Обновление интерфейса...", reply_markup=ReplyKeyboardRemove())
    try:
        await rm_msg.delete()
    except Exception:
        pass
        
    await show_main_menu(bot, message.chat.id, message.from_user.first_name, state)

@dp.callback_query(F.data == "nav_main")
async def nav_main_handler(callback: types.CallbackQuery, state: FSMContext, bot: Bot):
    await callback.answer("Главное меню")
    await show_main_menu(bot, callback.message.chat.id, callback.from_user.first_name, state, callback)

@dp.callback_query(F.data == "nav_services")
async def nav_services_handler(callback: types.CallbackQuery):
    await callback.answer()
    services_text = (
        "<b>Прайс-лист автосервиса:</b>\n\n"
        "• Компьютерная диагностика — от 1 000 ₽\n"
        "• Замена моторного масла и фильтра — от 1 500 ₽\n"
        "• Замена тормозных колодок — от 1 500 ₽\n"
        "• Замена амортизаторов / пружин — от 3 000 ₽\n"
        "• Заправка и чистка кондиционера — от 2 000 ₽\n"
        "• Шиномонтаж и балансировка — от 2 000 ₽\n\n"
        "<i>Нажмите «Записаться на ТО», чтобы выбрать дату и мастера.</i>"
    )
    builder = InlineKeyboardBuilder()
    builder.button(text="Записаться на ТО", callback_data="nav_booking")
    builder.button(text="Назад в меню", callback_data="nav_main")
    builder.adjust(1)
    await callback.message.edit_text(services_text, parse_mode="HTML", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "nav_contacts")
async def nav_contacts_handler(callback: types.CallbackQuery):
    await callback.answer()
    contacts_text = (
        "<b>Контакты автосервиса AutoFriends</b>\n\n"
        "<b>Адрес:</b> г. Горловка, ул. Автомобильная, д. 10\n"
        "<b>Режим работы:</b> Пн-Сб с 09:00 до 19:00\n"
        "<b>Телефон:</b> +7 (949) 000-00-00\n"
        "<b>Телеграм:</b> @autofriends_service"
    )
    await callback.message.edit_text(contacts_text, parse_mode="HTML", reply_markup=get_back_inline_keyboard())

@dp.callback_query(F.data == "nav_about")
async def nav_about_handler(callback: types.CallbackQuery):
    await callback.answer()
    about_text = (
        "<b>О нашем сервисе</b>\n\n"
        "AutoFriends — это профессиональный сервис с гарантией качества на все работы.\n"
        "• Квалифицированные мастера\n"
        "• Современное диагностическое оборудование\n"
        "• Прозрачная история обслуживания"
    )
    await callback.message.edit_text(about_text, parse_mode="HTML", reply_markup=get_back_inline_keyboard())

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
        f"<b>Личный кабинет клиента</b>\n\n"
        f"• <b>Имя:</b> {user_name}{username_str}\n"
        f"• <b>Телефон:</b> {stats['phone']}\n"
        f"• <b>Автомобиль:</b> {stats['car_model']}\n\n"
        f"<b>Статистика:</b>\n"
        f"• Активных / Подтвержденных: <b>{stats['active']}</b>\n"
        f"• Всего записей: <b>{stats['total']}</b>\n"
        f"• Отмененных: <b>{stats['cancelled']}</b>\n\n"
        "Выберите нужный раздел:"
    )
    
    builder = InlineKeyboardBuilder()
    builder.button(text=f"Ваши записи ({stats['active']})", callback_data="view_active_bookings")
    builder.button(text="История всех визитов", callback_data="view_all_bookings")
    builder.button(text="Записаться на ТО", callback_data="nav_booking")
    builder.button(text="Назад в меню", callback_data="nav_main")
    builder.adjust(1)
    
    if isinstance(event, types.CallbackQuery):
        await event.answer()
        await event.message.edit_text(profile_text, parse_mode="HTML", reply_markup=builder.as_markup())
    else:
        await bot.send_message(user.id, profile_text, parse_mode="HTML", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "view_active_bookings")
async def view_active_bookings_handler(callback: types.CallbackQuery):
    await callback.answer()
    user_id = callback.from_user.id
    bookings = get_user_bookings(user_id)
    active_bookings = [b for b in bookings if b["status"] in ("На рассмотрении", "Одобрена", "Активна")]
    
    builder = InlineKeyboardBuilder()
    if not active_bookings:
        text = (
            "<b>У вас нет активных записей на данный момент.</b>\n\n"
            "Вы можете оформить новую запись в 2 клика!"
        )
        builder.button(text="Записаться на ТО", callback_data="nav_booking")
    else:
        text = "<b>Ваши активные записи:</b>\n\n"
        for b in active_bookings:
            comment_str = f"\n• <b>Примечание:</b> <i>{b['comment']}</i>" if b["comment"] else ""
            text += (
                f"<b>Запись №{b['id']}</b> [<b>{b['status']}</b>]\n"
                f"• <b>Услуга:</b> {b['problem']}\n"
                f"• <b>Автомобиль:</b> {b['car_model']}\n"
                f"• <b>Дата и время:</b> {b['slot']}\n"
                f"• <b>Телефон:</b> {b['phone']}"
                f"{comment_str}\n"
                "-------------------------\n"
            )
            builder.button(text=f"Отменить запись №{b['id']}", callback_data=f"cancel_db_booking_{b['id']}")
            
    builder.button(text="Назад в кабинет", callback_data="nav_profile")
    builder.adjust(1)
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "view_all_bookings")
async def view_all_bookings_handler(callback: types.CallbackQuery):
    await callback.answer()
    user_id = callback.from_user.id
    bookings = get_user_bookings(user_id)
    
    if not bookings:
        text = "<b>История ваших записей пуста.</b>"
    else:
        text = "<b>Вся история ваших записей:</b>\n\n"
        for b in bookings:
            comment_str = f"\n• <b>Примечание:</b> <i>{b['comment']}</i>" if b["comment"] else ""
            text += (
                f"<b>Запись №{b['id']}</b> [{b['status']}]\n"
                f"• <b>Услуга:</b> {b['problem']}\n"
                f"• <b>Автомобиль:</b> {b['car_model']}\n"
                f"• <b>Время:</b> {b['slot']}"
                f"{comment_str}\n"
                "-------------------------\n"
            )
    builder = InlineKeyboardBuilder()
    builder.button(text="Назад в кабинет", callback_data="nav_profile")
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=builder.as_markup())

@dp.callback_query(F.data.startswith("cancel_db_booking_"))
async def cancel_db_booking_handler(callback: types.CallbackQuery, bot: Bot):
    await callback.answer()
    try:
        booking_id = int(callback.data.replace("cancel_db_booking_", ""))
    except ValueError:
        return
        
    user_id = callback.from_user.id
    booking = get_booking_by_id(booking_id)
    success = cancel_booking_by_id(booking_id, user_id)
    
    builder = InlineKeyboardBuilder()
    builder.button(text="Назад в кабинет", callback_data="nav_profile")
    if success:
        await callback.message.edit_text(
            f"<b>Запись №{booking_id} успешно отменена.</b>",
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )

        admin_ids = get_admin_ids()
        if admin_ids and booking:
            user_name = callback.from_user.full_name or callback.from_user.first_name
            car_info = booking.get("car_model", "")
            if booking.get("car_number"):
                car_info += f" ({booking['car_number']})"
            admin_msg = (
                f"🚨 <b>ОТМЕНА ЗАПИСИ №{booking_id} КЛИЕНТОМ!</b>\n\n"
                f"• <b>Клиент:</b> {user_name} (ID: {user_id})\n"
                f"• <b>Телефон:</b> {booking.get('phone', 'Не указан')}\n"
                f"• <b>Автомобиль:</b> {car_info}\n"
                f"• <b>Услуга:</b> {booking['problem']}\n"
                f"• <b>Была на время:</b> {booking['slot']}\n"
            )
            for adm_id in admin_ids:
                try:
                    await bot.send_message(adm_id, admin_msg, parse_mode="HTML")
                except Exception as e:
                    logging.error(f"Не удалось отправить уведомление модератору {adm_id}: {e}")
    else:
        await callback.message.edit_text(
            "Не удалось отменить запись или она уже отменена.",
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )

@dp.callback_query(F.data == "nav_booking")
async def start_booking_inline(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(BookingState.select_category)
    await callback.message.edit_text(
        "<b>Шаг 1 из 4:</b> Выберите услугу или категорию работ:",
        parse_mode="HTML",
        reply_markup=get_categories_keyboard()
    )

@dp.callback_query(F.data.startswith("cat_"))
async def category_selected_inline(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    categories_map = {
        "cat_engine": "Двигатель и выхлопная система",
        "cat_chassis": "Подвеска и тормозная система",
        "cat_electric": "Электрика и автоэлектроника",
        "cat_to": "Регулярное ТО и масляный сервис",
        "cat_climate": "Климат и кондиционер",
    }
    
    await state.update_data(card_msg_id=callback.message.message_id)
    
    if callback.data == "cat_custom":
        await state.set_state(BookingState.custom_problem)
        builder = InlineKeyboardBuilder()
        builder.button(text="Назад в меню", callback_data="nav_main")
        await callback.message.edit_text(
            "<b>Шаг 1 из 4:</b> Напишите причиной вашего обращения или услугу сообщением:",
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )
    else:
        chosen_category = categories_map.get(callback.data, "Общий ремонт")
        await state.update_data(problem=chosen_category)
        await state.set_state(BookingState.select_master)
        
        await callback.message.edit_text(
            f"Выбрано: <b>{chosen_category}</b>\n\n"
            "<b>Шаг 2 из 4:</b> Выберите специалиста или любого свободного мастера:",
            parse_mode="HTML",
            reply_markup=get_masters_keyboard()
        )

@dp.callback_query(F.data.startswith("m_"))
async def master_selected_inline(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    masters_map = {
        "m_any": "Любой свободный мастер",
        "m_alexey": "Алексей Смирнов (Двигатель/ТО)",
        "m_dmitry": "Дмитрий Ковалев (Диагност)",
        "m_igor": "Игорь Соколов (Ходовая)",
    }
    chosen_master = masters_map.get(callback.data, "Любой свободный мастер")
    await state.update_data(master=chosen_master)
    await state.set_state(BookingState.enter_car_model)

    builder = InlineKeyboardBuilder()
    builder.button(text="Назад в меню", callback_data="nav_main")
    await callback.message.edit_text(
        f"Мастер: <b>{chosen_master}</b>\n\n"
        "<b>Шаг 3 из 5:</b> Напишите марку и модель автомобиля (например: <i>Opel Astra</i> или <i>Toyota Camry</i>):",
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
            builder.button(text="Назад в меню", callback_data="nav_main")
            await bot.edit_message_text(
                "Некорректное описание проблемы!\n\n"
                "Введите понятное описание поломки или нужной услуги.\n"
                "<i>Пример: Замена передних тормозных колодок</i>",
                chat_id=message.chat.id,
                message_id=card_msg_id,
                parse_mode="HTML",
                reply_markup=builder.as_markup()
            )
        return

    await state.update_data(problem=text_val)
    await state.set_state(BookingState.select_master)
    
    if card_msg_id:
        await bot.edit_message_text(
            f"Проблема: <b>{text_val}</b>\n\n"
            "<b>Шаг 2 из 5:</b> Выберите специалиста или любого свободного мастера:",
            chat_id=message.chat.id,
            message_id=card_msg_id,
            parse_mode="HTML",
            reply_markup=get_masters_keyboard()
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
    builder.button(text="Назад в меню", callback_data="nav_main")
    
    if not formatted_car:
        if card_msg_id:
            await bot.edit_message_text(
                "Некорректное название автомобиля!\n"
                "Укажите марку и модель авто (например: <i>Opel Astra, Toyota Camry, Hyundai Solaris</i>):",
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
            f"Автомобиль: <b>{formatted_car}</b>\n\n"
            "<b>Шаг 4 из 5:</b> Выберите удобную дату и время визита:",
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
    builder.button(text="Назад в меню", callback_data="nav_main")
    
    await callback.message.edit_text(
        f"Выбранное время: <b>{slot_text}</b>\n\n"
        "<b>Шаг 5 из 5:</b> Отправьте ваш номер телефона (например: <i>+79991234567</i>):",
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
            builder.button(text="Назад в меню", callback_data="nav_main")
            await bot.edit_message_text(
                "Некорректный номер телефона.\n"
                "Введите правильный номер (например: +79991234567):",
                chat_id=message.chat.id,
                message_id=card_msg_id,
                parse_mode="HTML",
                reply_markup=builder.as_markup()
            )
        return
        
    await state.update_data(phone=phone)
    updated_data = await state.get_data()
    
    master_str = f" (Мастер: {updated_data.get('master', 'Любой')})" if updated_data.get('master') else ""
    full_slot = f"{updated_data.get('slot')}{master_str}"

    summary = (
        "<b>Подтверждение вашей записи:</b>\n\n"
        f"• <b>Услуга:</b> {updated_data.get('problem')}\n"
        f"• <b>Автомобиль:</b> {updated_data.get('car_model')}\n"
        f"• <b>Дата и время:</b> {full_slot}\n"
        f"• <b>Телефон:</b> {updated_data.get('phone')}\n\n"
        "Подтверждаете запись?"
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

def get_admin_ids() -> list[int]:
    raw = os.getenv("ADMIN_IDS", "")
    return [int(x.strip()) for x in raw.split(",") if x.strip().isdigit()]

async def process_moderator_decision(bot: Bot, booking_id: int, new_status: str, comment: str = "", callback: types.CallbackQuery = None):
    success = update_booking_status(booking_id, new_status, comment)
    booking = get_booking_by_id(booking_id)
    
    if success and booking:
        client_id = booking["user_id"]
        comment_text = f"\n\n💬 <b>Комментарий автосервиса:</b> <i>\"{comment}\"</i>" if comment else ""
        
        if new_status == "Одобрена":
            client_msg = (
                f"🎉 <b>Ваша запись №{booking_id} ОДОБРЕНА!</b>\n\n"
                f"• <b>Дата и время:</b> {booking['slot']}\n"
                f"• <b>Автомобиль:</b> {booking['car_model']}\n"
                f"• <b>Услуга:</b> {booking['problem']}"
                f"{comment_text}\n\n"
                "Ждем вас в назначенное время в автосервисе!"
            )
        else:
            client_msg = (
                f"❌ <b>Ваша запись №{booking_id} ОТКЛОНЕНА.</b>\n\n"
                f"• <b>Дата и время:</b> {booking['slot']}\n"
                f"• <b>Автомобиль:</b> {booking['car_model']}"
                f"{comment_text}\n\n"
                "Вы можете выбрать другое время или связаться с нами."
            )
            
        builder = InlineKeyboardBuilder()
        builder.button(text="Мой кабинет", callback_data="nav_profile")
        builder.button(text="Новая запись", callback_data="nav_booking")
        builder.adjust(2)
        
        try:
            if bot:
                await bot.send_message(client_id, client_msg, parse_mode="HTML", reply_markup=builder.as_markup())
        except Exception as e:
            logging.error(f"Не удалось отправить уведомление клиенту {client_id}: {e}")

    if callback:
        status_label = "ОДОБРЕНА" if new_status == "Одобрена" else "ОТКЛОНЕНА"
        comment_label = f"\n💬 Комментарий: <i>\"{comment}\"</i>" if comment else ""
        
        builder = InlineKeyboardBuilder()
        builder.button(text="Панель модерации", callback_data="adm_panel")
        
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
            f"<b>Настройка модератора</b>\n\n"
            f"Ваш Telegram ID: <code>{message.from_user.id}</code>\n\n"
            "Чтобы включить панель модератора, добавьте этот ID в переменные окружения Amvera или файл <code>.env</code>:\n"
            f"<code>ADMIN_IDS={message.from_user.id}</code>",
            parse_mode="HTML"
        )
        return
        
    if message.from_user.id not in admin_ids:
        await message.answer("Доступ запрещен. Ваш ID не найден в списке модераторов.", parse_mode="HTML")
        return
        
    await show_admin_panel(bot, message.chat.id)

async def show_admin_panel(bot: Bot, chat_id: int, callback: types.CallbackQuery = None):
    stats = get_admin_stats()
    admin_text = (
        "<b>Панель Модератора Автосервиса</b>\n\n"
        "<b>Статистика заявок:</b>\n"
        f"• На рассмотрении: <b>{stats['pending']}</b>\n"
        f"• Одобрено: <b>{stats['approved']}</b>\n"
        f"• Отклонено / Отменено: <b>{stats['rejected']}</b>\n"
        f"• Всего в базе: <b>{stats['total']}</b>\n\n"
        "Выберите действие:"
    )
    builder = InlineKeyboardBuilder()
    builder.button(text=f"На рассмотрении ({stats['pending']})", callback_data="adm_view_pending")
    builder.button(text="Вся база записей", callback_data="adm_view_all")
    builder.button(text="Обновить панель", callback_data="adm_panel")
    builder.button(text="Главное меню", callback_data="nav_main")
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
    await callback.answer("Панель обновлена")
    await show_admin_panel(bot, callback.message.chat.id, callback)

@dp.callback_query(F.data == "adm_view_pending")
async def adm_view_pending_handler(callback: types.CallbackQuery):
    await callback.answer()
    bookings = get_all_bookings(status_filter="На рассмотрении")
    
    if not bookings:
        builder = InlineKeyboardBuilder()
        builder.button(text="Назад в админку", callback_data="adm_panel")
        await callback.message.edit_text(
            "<b>Нет новых заявок на рассмотрении.</b>",
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )
        return
        
    for b in bookings:
        card = (
            f"<b>ЗАЯВКА НА ТО №{b['id']}</b>\n\n"
            f"• <b>Клиент:</b> {b['user_name']}\n"
            f"• <b>Телефон:</b> {b['phone']}\n"
            f"• <b>Автомобиль:</b> {b['car_model']}\n"
            f"• <b>Услуга:</b> {b['problem']}\n"
            f"• <b>Дата и время:</b> {b['slot']}\n"
        )
        builder = InlineKeyboardBuilder()
        builder.button(text="Одобрить", callback_data=f"adm_dec_{b['id']}_approve")
        builder.button(text="Отклонить", callback_data=f"adm_dec_{b['id']}_reject")
        builder.button(text="Одобрить + коммент", callback_data=f"adm_comm_{b['id']}_approve")
        builder.button(text="Отклонить + коммент", callback_data=f"adm_comm_{b['id']}_reject")
        builder.adjust(2, 2)
        await callback.message.answer(card, parse_mode="HTML", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "adm_view_all")
async def adm_view_all_handler(callback: types.CallbackQuery):
    await callback.answer()
    bookings = get_all_bookings()
    
    if not bookings:
        builder = InlineKeyboardBuilder()
        builder.button(text="Назад в админку", callback_data="adm_panel")
        await callback.message.edit_text(
            "<b>База записей пуста.</b>",
            parse_mode="HTML",
            reply_markup=builder.as_markup()
        )
        return
        
    response = "<b>Архив всех записей клиентов:</b>\n\n"
    for b in bookings[:15]:
        comment_str = f" (Коммент: {b['comment']})" if b["comment"] else ""
        response += (
            f"<b>Запись №{b['id']}</b> [{b['status']}]\n"
            f"• <b>Клиент:</b> {b['user_name']} ({b['phone']})\n"
            f"• <b>Автомобиль:</b> {b['car_model']}\n"
            f"• <b>Дата/время:</b> {b['slot']}{comment_str}\n"
            "-------------------------\n"
        )
    builder = InlineKeyboardBuilder()
    builder.button(text="Назад в админку", callback_data="adm_panel")
    await callback.message.edit_text(response, parse_mode="HTML", reply_markup=builder.as_markup())

@dp.callback_query(F.data.startswith("adm_dec_"))
async def adm_direct_decision_handler(callback: types.CallbackQuery, bot: Bot):
    parts = callback.data.split("_")
    booking_id = int(parts[2])
    action = parts[3]
    
    new_status = "Одобрена" if action == "approve" else "Отклонена"
    await process_moderator_decision(bot, booking_id, new_status=new_status, comment="", callback=callback)

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
    builder.button(text="Отмена", callback_data="adm_panel")
    await callback.message.edit_text(
        f"<b>Ввод комментария для {action_text} заявки №{booking_id}:</b>\n\n"
        "Напишите комментарий для клиента сообщением:",
        parse_mode="HTML",
        reply_markup=builder.as_markup()
    )

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

@dp.callback_query(F.data.startswith("reschedule_"))
async def client_reschedule_inline_handler(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    booking_id = callback.data.split("_")[1]
    await state.update_data(reschedule_id=booking_id)
    await state.set_state(BookingState.select_time_slot)
    
    await callback.message.edit_text(
        f"<b>Перенос записи №{booking_id}:</b>\n\n"
        "Выберите новое доступное время и дату:",
        parse_mode="HTML",
        reply_markup=get_time_slots_keyboard()
    )

@dp.callback_query(F.data.startswith("cancel_b_"))
async def client_cancel_inline_handler(callback: types.CallbackQuery, bot: Bot):
    await callback.answer()
    booking_id = int(callback.data.split("_")[2])
    user_id = callback.from_user.id
    booking = get_booking_by_id(booking_id)
    
    success = cancel_booking_by_id(booking_id, user_id)
    if success:
        await callback.message.edit_text(
            f"<b>Запись №{booking_id} отменена по вашему запросу.</b>\n\n"
            "Вы всегда можете оформить новую запись в любое время!",
            parse_mode="HTML"
        )
        admin_ids = get_admin_ids()
        if admin_ids and booking:
            user_name = callback.from_user.full_name or callback.from_user.first_name
            car_info = booking.get("car_model", "")
            if booking.get("car_number"):
                car_info += f" ({booking['car_number']})"
            admin_msg = (
                f"🚨 <b>ОТМЕНА ЗАПИСИ №{booking_id} КЛИЕНТОМ!</b>\n\n"
                f"• <b>Клиент:</b> {user_name} (ID: {user_id})\n"
                f"• <b>Телефон:</b> {booking.get('phone', 'Не указан')}\n"
                f"• <b>Автомобиль:</b> {car_info}\n"
                f"• <b>Услуга:</b> {booking['problem']}\n"
                f"• <b>Была на время:</b> {booking['slot']}\n"
            )
            for adm_id in admin_ids:
                try:
                    await bot.send_message(adm_id, admin_msg, parse_mode="HTML")
                except Exception as e:
                    logging.error(f"Не удалось отправить уведомление модератору {adm_id}: {e}")
    else:
        await callback.message.answer("Не удалось отменить запись или она уже отменена.")

@dp.callback_query(F.data == "confirm_booking")
async def confirm_booking_inline(callback: types.CallbackQuery, state: FSMContext, bot: Bot):
    await callback.answer()
    data = await state.get_data()
    await state.clear()
    
    master_str = f" (Мастер: {data.get('master', 'Любой')})" if data.get('master') else ""
    target_slot = f"{data.get('slot', 'Не указано')}{master_str}"

    booking_id = add_booking(
        user_id=callback.from_user.id,
        user_name=callback.from_user.full_name or callback.from_user.first_name,
        problem=data.get('problem', 'Общий ремонт'),
        car_model=data.get('car_model', 'Не указано'),
        slot=target_slot,
        phone=data.get('phone', 'Не указан')
    )
    
    final_text = (
        f"<b>Заявка №{booking_id} успешно создана!</b>\n\n"
        f"• <b>Дата и время:</b> {target_slot}\n"
        f"• <b>Автомобиль:</b> {data.get('car_model')}\n"
        f"• <b>Услуга:</b> {data.get('problem')}\n\n"
        "<i>Заявка отправлена на рассмотрение. Мы пришлем вам уведомление, как только её проверят.</i>"
    )
    
    builder = InlineKeyboardBuilder()
    builder.button(text="Мой кабинет", callback_data="nav_profile")
    builder.button(text="Главное меню", callback_data="nav_main")
    builder.adjust(1)
    
    await callback.message.edit_text(final_text, parse_mode="HTML", reply_markup=builder.as_markup())

    admin_ids = get_admin_ids()
    if admin_ids:
        user_mention = f"@{callback.from_user.username}" if callback.from_user.username else callback.from_user.full_name
        admin_card = (
            f"🚨 <b>НОВАЯ ЗАЯВКА НА ТО №{booking_id}!</b> (⏳ На рассмотрении)\n\n"
            f"• <b>Клиент:</b> {user_mention} (ID: {callback.from_user.id})\n"
            f"• <b>Телефон:</b> {data.get('phone')}\n"
            f"• <b>Автомобиль:</b> {data.get('car_model')}\n"
            f"• <b>Услуга:</b> {data.get('problem')}\n"
            f"• <b>Дата и время:</b> {target_slot}\n"
        )
        adm_builder = InlineKeyboardBuilder()
        adm_builder.button(text="Одобрить", callback_data=f"adm_dec_{booking_id}_approve")
        adm_builder.button(text="Отклонить", callback_data=f"adm_dec_{booking_id}_reject")
        adm_builder.button(text="Одобрить + коммент", callback_data=f"adm_comm_{booking_id}_approve")
        adm_builder.button(text="Отклонить + коммент", callback_data=f"adm_comm_{booking_id}_reject")
        adm_builder.adjust(2, 2)
        
        for adm_id in admin_ids:
            try:
                await bot.send_message(adm_id, admin_card, parse_mode="HTML", reply_markup=adm_builder.as_markup())
            except Exception as e:
                logging.error(f"Не удалось отправить уведомление модератору {adm_id}: {e}")


# ═══════════════════════════════════════════════════════════
# REST API ENDPOINTS (Synchronizing Mini App with Telegram Bot)
# ═══════════════════════════════════════════════════════════

routes = web.RouteTableDef()

@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        response = web.Response(status=200)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, PUT, DELETE"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response

    try:
        response = await handler(request)
    except web.HTTPException as ex:
        response = ex

    response.headers["Bypass-Tunnel-Reminder"] = "true"
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, PUT, DELETE"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    return response

def check_is_admin(user_id: int) -> bool:
    return user_id in get_admin_ids()

@routes.get("/api/slots")
async def handle_get_slots(request: web.Request):
    today = datetime.now()
    days_ru = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    slots = []
    for day_offset in range(1, 4):
        date_obj = today + timedelta(days=day_offset)
        date_str = date_obj.strftime("%d.%m")
        day_name = days_ru[date_obj.weekday()]
        for time_str in ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00"]:
            slots.append(f"{date_str} ({day_name}) в {time_str}")
    return web.json_response({"slots": slots})

@routes.get("/api/user/info")
async def handle_user_info(request: web.Request):
    user_id_str = request.query.get("user_id")
    if not user_id_str or not user_id_str.isdigit():
        return web.json_response({"error": "Invalid user_id"}, status=400)
    
    user_id = int(user_id_str)
    stats = get_user_stats(user_id)
    raw_bookings = get_user_bookings(user_id)
    
    bookings = []
    for b in raw_bookings:
        bookings.append({
            "id": b["id"],
            "problem": b["problem"],
            "car_model": b["car_model"],
            "car_number": b["car_number"] if "car_number" in b.keys() else "",
            "slot": b["slot"],
            "phone": b["phone"],
            "status": b["status"],
            "comment": b["comment"] if "comment" in b.keys() else "",
            "created_at": b["created_at"] if "created_at" in b.keys() else ""
        })

    return web.json_response({
        "stats": stats,
        "bookings": bookings
    })

@routes.post("/api/booking/create")
async def handle_create_booking(request: web.Request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Неверный формат данных (JSON)"}, status=400)

    user_id = data.get("user_id")
    user_name = data.get("user_name", "Клиент")
    problem = data.get("problem", "").strip()
    car_model_raw = data.get("car_model", "").strip()
    car_number = data.get("car_number", "").strip().upper()
    slot = data.get("slot", "").strip()
    phone = data.get("phone", "").strip()

    if not user_id:
        return web.json_response({"error": "user_id не передан"}, status=400)
    if not problem:
        return web.json_response({"error": "Опишите проблему или выберите услугу"}, status=400)

    formatted_car = validate_and_format_car(car_model_raw)
    if not formatted_car:
        return web.json_response({
            "error": "Некорректная марка/модель авто! Укажите реальную марку (напр. Toyota Camry, Opel Astra)"
        }, status=400)

    booking_id = add_booking(
        user_id=int(user_id),
        user_name=user_name,
        problem=problem,
        car_model=formatted_car,
        slot=slot,
        phone=phone,
        car_number=car_number
    )

    bot: Bot = request.app.get("bot")
    if bot:
        admin_ids = get_admin_ids()
        if admin_ids:
            car_num_str = f"• <b>Госномер:</b> {car_number}\n" if car_number else ""
            admin_card = (
                f"🚨 <b>НОВАЯ ЗАЯВКА ИЗ MINI APP №{booking_id}!</b> (⏳ На рассмотрении)\n\n"
                f"• <b>Клиент:</b> {user_name} (ID: {user_id})\n"
                f"• <b>Телефон:</b> {phone}\n"
                f"• <b>Автомобиль:</b> {formatted_car}\n"
                f"{car_num_str}"
                f"• <b>Услуга:</b> {problem}\n"
                f"• <b>Дата и время:</b> {slot}\n"
            )
            adm_builder = InlineKeyboardBuilder()
            adm_builder.button(text="Одобрить", callback_data=f"adm_dec_{booking_id}_approve")
            adm_builder.button(text="Отклонить", callback_data=f"adm_dec_{booking_id}_reject")
            adm_builder.button(text="Одобрить + коммент", callback_data=f"adm_comm_{booking_id}_approve")
            adm_builder.button(text="Отклонить + коммент", callback_data=f"adm_comm_{booking_id}_reject")
            adm_builder.adjust(2, 2)

            for adm_id in admin_ids:
                try:
                    await bot.send_message(adm_id, admin_card, parse_mode="HTML", reply_markup=adm_builder.as_markup())
                except Exception as e:
                    logging.error(f"Не удалось отправить уведомление модератору {adm_id}: {e}")

    return web.json_response({
        "success": True,
        "booking_id": booking_id
    })

@routes.post("/api/booking/cancel")
async def handle_cancel_booking(request: web.Request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    booking_id = data.get("booking_id") or data.get("id")
    user_id = data.get("user_id") or data.get("telegram_id") or data.get("chat_id")

    if not booking_id or not user_id:
        return web.json_response({"error": "Missing booking_id or user_id"}, status=400)

    b_id = int(booking_id)
    u_id = int(user_id)

    booking = get_booking_by_id(b_id)
    success = cancel_booking_by_id(b_id, u_id)

    if success:
        bot: Bot = request.app.get("bot")
        if bot and booking:
            client_id = booking["user_id"]
            car_info = booking.get("car_model", "")
            if booking.get("car_number"):
                car_info += f" ({booking['car_number']})"

            client_msg = (
                f"❌ <b>Ваша запись №{b_id} отменена</b>\n\n"
                f"• <b>Услуга:</b> {booking['problem']}\n"
                f"• <b>Автомобиль:</b> {car_info}\n"
                f"• <b>Была на время:</b> {booking['slot']}\n\n"
                "Вы всегда можете записаться снова на любое удобное время!"
            )
            builder = InlineKeyboardBuilder()
            builder.button(text="Записаться снова", callback_data="nav_booking")
            try:
                await bot.send_message(client_id, client_msg, parse_mode="HTML", reply_markup=builder.as_markup())
            except Exception as e:
                logging.error(f"Не удалось отправить уведомление клиенту {client_id}: {e}")

            admin_ids = get_admin_ids()
            if admin_ids:
                user_name = data.get("user_name") or booking.get("user_name") or "Клиент"
                admin_msg = (
                    f"🚨 <b>ОТМЕНА ЗАПИСИ №{b_id} КЛИЕНТОМ!</b>\n\n"
                    f"• <b>Клиент:</b> {user_name} (ID: {client_id})\n"
                    f"• <b>Телефон:</b> {booking.get('phone', 'Не указан')}\n"
                    f"• <b>Автомобиль:</b> {car_info}\n"
                    f"• <b>Услуга:</b> {booking['problem']}\n"
                    f"• <b>Была на время:</b> {booking['slot']}\n"
                )
                for adm_id in admin_ids:
                    try:
                        await bot.send_message(adm_id, admin_msg, parse_mode="HTML")
                    except Exception as e:
                        logging.error(f"Не удалось отправить уведомление админу {adm_id}: {e}")

        return web.json_response({"success": True})
    else:
        return web.json_response({"error": "Запись не найдена или уже отменена"}, status=400)

@routes.get("/api/admin/check")
async def handle_admin_check(request: web.Request):
    user_id_str = request.query.get("user_id")
    if not user_id_str or not user_id_str.isdigit():
        return web.json_response({"is_admin": False})
    
    is_adm = check_is_admin(int(user_id_str))
    return web.json_response({"is_admin": is_adm})

@routes.get("/api/admin/bookings")
async def handle_admin_bookings(request: web.Request):
    user_id_str = request.query.get("user_id")
    if not user_id_str or not user_id_str.isdigit():
        return web.json_response({"error": "Unauthorized"}, status=401)
    
    if not check_is_admin(int(user_id_str)):
        return web.json_response({"error": "Forbidden: Not an admin"}, status=403)
        
    status_filter = request.query.get("status")
    if status_filter == "all" or not status_filter:
        status_filter = None

    raw_bookings = get_all_bookings(status_filter)
    stats = get_admin_stats()

    bookings = []
    for b in raw_bookings:
        bookings.append({
            "id": b["id"],
            "user_id": b["user_id"],
            "user_name": b["user_name"],
            "problem": b["problem"],
            "car_model": b["car_model"],
            "car_number": b["car_number"] if "car_number" in b.keys() else "",
            "slot": b["slot"],
            "phone": b["phone"],
            "status": b["status"],
            "comment": b["comment"] if "comment" in b.keys() else "",
            "created_at": str(b["created_at"]) if "created_at" in b.keys() else ""
        })

    return web.json_response({
        "stats": stats,
        "bookings": bookings
    })

@routes.post("/api/admin/booking/action")
async def handle_admin_action(request: web.Request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    admin_id = data.get("admin_id")
    booking_id = data.get("booking_id")
    action = data.get("action")
    comment = data.get("comment", "").strip()

    if not admin_id or not check_is_admin(int(admin_id)):
        return web.json_response({"error": "Forbidden"}, status=403)

    if not booking_id or not action:
        return web.json_response({"error": "Missing parameters"}, status=400)

    booking_id = int(booking_id)

    if action == "delete":
        success = delete_booking_by_id(booking_id)
        if success:
            return web.json_response({"success": True, "message": "Запись успешно удалена"})
        return web.json_response({"error": "Не удалось удалить запись"}, status=400)

    new_status = "Одобрена" if action == "approve" else "Отклонена"
    bot: Bot = request.app.get("bot")
    
    await process_moderator_decision(bot, booking_id, new_status, comment)
    return web.json_response({"success": True, "status": new_status})

@routes.post("/api/admin/master/reschedule")
async def handle_admin_master_reschedule(request: web.Request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    admin_id = data.get("admin_id")
    master_name = data.get("master_name", "").strip()
    target_date = data.get("target_date", "").strip()
    reason = data.get("reason", "").strip()

    if not admin_id or not check_is_admin(int(admin_id)):
        return web.json_response({"error": "Forbidden"}, status=403)
    if not master_name:
        return web.json_response({"error": "Укажите имя мастера"}, status=400)

    affected_bookings = mark_master_bookings_unavailable(master_name, target_date, reason)

    bot: Bot = request.app.get("bot")
    if bot and affected_bookings:
        for b in affected_bookings:
            client_id = b["user_id"]
            booking_id = b["id"]
            reason_str = f"\n💬 <b>Причина:</b> <i>{reason}</i>" if reason else ""

            msg = (
                f"⚠️ <b>ВНИМАНИЕ по вашей записи №{booking_id}!</b>\n\n"
                f"К сожалению, выбранный специалист (<b>{master_name}</b>) временно недоступен.{reason_str}\n\n"
                f"• <b>Услуга:</b> {b['problem']}\n"
                f"• <b>Автомобиль:</b> {b['car_model']}\n"
                f"• <b>Текущее время:</b> {b['slot']}\n\n"
                "Пожалуйста, выберите другого мастера или другое удобное время."
            )

            builder = InlineKeyboardBuilder()
            builder.button(text="Выбрать другого мастера/время", callback_data=f"reschedule_{booking_id}")
            builder.button(text="Отменить запись", callback_data=f"cancel_b_{booking_id}")
            builder.adjust(1, 1)

            try:
                await bot.send_message(client_id, msg, parse_mode="HTML", reply_markup=builder.as_markup())
            except Exception as e:
                logging.error(f"Не удалось отправить сообщение о переносе клиенту {client_id}: {e}")

    return web.json_response({
        "success": True,
        "affected_count": len(affected_bookings)
    })

@routes.post("/api/booking/reschedule")
async def handle_client_reschedule(request: web.Request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    booking_id = data.get("booking_id")
    user_id = data.get("user_id")
    new_slot = data.get("new_slot", "").strip()

    if not booking_id or not user_id or not new_slot:
        return web.json_response({"error": "Отсутствуют обязательные параметры"}, status=400)

    b_id = int(booking_id)
    u_id = int(user_id)
    success = reschedule_booking(b_id, u_id, new_slot)

    if success:
        bot: Bot = request.app.get("bot")
        booking = get_booking_by_id(b_id)
        if bot and booking:
            client_msg = (
                f"🎉 <b>Ваша запись №{b_id} обновлена!</b>\n\n"
                f"• <b>Новое время:</b> {new_slot}\n"
                f"• <b>Автомобиль:</b> {booking.get('car_model', '')}\n"
                f"• <b>Статус:</b> ✅ Подтверждена\n\n"
                "Ждем вас в назначенное время!"
            )
            try:
                await bot.send_message(u_id, client_msg, parse_mode="HTML")
            except Exception as e:
                logging.error(f"Failed to send reschedule msg to {u_id}: {e}")

        return web.json_response({"success": True})
    return web.json_response({"error": "Не удалось перенести запись"}, status=400)


def create_api_server(bot: Bot) -> web.Application:
    app = web.Application(middlewares=[cors_middleware])
    app["bot"] = bot
    app.add_routes(routes)
    return app

async def safe_start_polling(bot: Bot):
    try:
        await dp.start_polling(bot)
    except Exception as e:
        logging.error(f"[WARN] Ошибка polling бота (возможно бот запущен на другом ПК): {e}")

async def main():
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    init_db()
    print("База данных SQLite успешно инициализирована!", flush=True)

    port = int(os.getenv("PORT", "8080"))
    bot_token = os.getenv("BOT_TOKEN")
    bot = None

    if bot_token and bot_token != "your_bot_token_here":
        try:
            bot = Bot(token=bot_token)
            await bot.delete_webhook(drop_pending_updates=True)

            if WEBAPP_URL:
                if WEBAPP_URL.startswith("https://"):
                    try:
                        await bot.set_chat_menu_button(
                            menu_button=types.MenuButtonWebApp(
                                text="Mini App",
                                web_app=types.WebAppInfo(url=WEBAPP_URL)
                            )
                        )
                        print(f"[OK] Кнопка меню Mini App успешно привязана к {WEBAPP_URL}", flush=True)
                    except Exception as e:
                        logging.warning(f"[WARN] Ошибка установки кнопки WebApp через API: {e}")
        except Exception as e:
            print(f"[WARN] Ошибка инициализации Telegram бота: {e}", flush=True)

    # Start REST API Server for Mini App integration
    api_app = create_api_server(bot)
    runner = web.AppRunner(api_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    print(f"[OK] REST API сервер слушает http://0.0.0.0:{port} (Синхронизация с Mini App включена)", flush=True)

    if bot:
        print("[OK] Telegram бот запущен и готов к работе!", flush=True)
        asyncio.create_task(safe_start_polling(bot))

    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    asyncio.run(main())
