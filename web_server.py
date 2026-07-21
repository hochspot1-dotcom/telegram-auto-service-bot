import os
import json
import logging
from datetime import datetime, timedelta
from aiohttp import web
from aiogram import Bot
from aiogram.utils.keyboard import InlineKeyboardBuilder

from database import (
    add_booking, get_user_bookings, get_user_stats, 
    cancel_booking_by_id, get_booking_by_id
)

routes = web.RouteTableDef()

# --- Serve Static Files & Index ---
@routes.get("/")
async def handle_index(request: web.Request):
    return web.FileResponse(os.path.join(os.path.dirname(__file__), "webapp", "index.html"))

@routes.get("/webapp/{filename:.*}")
async def handle_static(request: web.Request):
    filename = request.match_info["filename"]
    filepath = os.path.join(os.path.dirname(__file__), "webapp", filename)
    if os.path.exists(filepath) and os.path.isfile(filepath):
        return web.FileResponse(filepath)
    return web.HTTPNotFound()

# --- API Endpoints ---

@routes.get("/api/slots")
async def handle_get_slots(request: web.Request):
    today = datetime.now()
    days_ru = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    slots = []
    for day_offset in range(1, 4):
        date_obj = today + timedelta(days=day_offset)
        date_str = date_obj.strftime("%d.%m")
        day_name = days_ru[date_obj.weekday()]
        for time_str in ["10:00", "14:00", "17:00"]:
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
    # Import validation functions from main to prevent circular imports
    from main import validate_and_format_car, validate_custom_problem, get_admin_ids

    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Неверный формат данных (JSON)"}, status=400)

    user_id = data.get("user_id")
    user_name = data.get("user_name", "Клиент")
    problem = data.get("problem", "").strip()
    car_model_raw = data.get("car_model", "").strip()
    slot = data.get("slot", "").strip()
    phone = data.get("phone", "").strip()

    if not user_id:
        return web.json_response({"error": "user_id не передан"}, status=400)
    if not problem:
        return web.json_response({"error": "Опишите проблему или выберите услугу"}, status=400)

    # Валидация авто
    formatted_car = validate_and_format_car(car_model_raw)
    if not formatted_car:
        return web.json_response({
            "error": "Некорректная марка/модель авто! Укажите реальную марку (напр. Toyota Camry, Opel Astra)"
        }, status=400)

    # Валидация кастомной проблемы (если это не предустановленная категория)
    known_cats = [
        "🔧 Двигатель и выхлоп", "🛞 Подвеска и тормоза", 
        "⚡ Электрика и диагностика", "🛢 Регулярное ТО", "❄️ Климат и кондиционер"
    ]
    if problem not in known_cats:
        if not validate_custom_problem(problem):
            return web.json_response({
                "error": "Некорректное описание проблемы. Введите понятную причину обращения."
            }, status=400)

    # Запись в БД
    booking_id = add_booking(
        user_id=int(user_id),
        user_name=user_name,
        problem=problem,
        car_model=formatted_car,
        slot=slot,
        phone=phone
    )

    # Уведомление модераторов
    bot: Bot = request.app.get("bot")
    if bot:
        admin_ids = get_admin_ids()
        if admin_ids:
            admin_card = (
                f"🚨 <b>НОВАЯ ЗАЯВКА ИЗ MINI APP №{booking_id}!</b> (⏳ На рассмотрении)\n\n"
                f"• <b>Клиент:</b> {user_name} (ID: {user_id})\n"
                f"• <b>Телефон:</b> {phone}\n"
                f"• <b>Автомобиль:</b> {formatted_car}\n"
                f"• <b>Услуга:</b> {problem}\n"
                f"• <b>Дата и время:</b> {slot}\n"
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

    booking_id = data.get("booking_id")
    user_id = data.get("user_id")

    if not booking_id or not user_id:
        return web.json_response({"error": "Missing booking_id or user_id"}, status=400)

    success = cancel_booking_by_id(int(booking_id), int(user_id))
    if success:
        return web.json_response({"success": True})
    else:
        return web.json_response({"error": "Запись не найдена или уже отменена"}, status=400)

@web.middleware
async def cors_middleware(request, handler):
    response = await handler(request)
    response.headers["Bypass-Tunnel-Reminder"] = "true"
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

def create_web_app(bot: Bot) -> web.Application:
    app = web.Application(middlewares=[cors_middleware])
    app["bot"] = bot
    app.add_routes(routes)
    return app

if __name__ == "__main__":
    import sys
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    from dotenv import load_dotenv
    load_dotenv()
    bot_token = os.getenv("BOT_TOKEN")
    bot_instance = Bot(token=bot_token) if bot_token and bot_token != "your_bot_token_here" else None
    app = create_web_app(bot_instance)
    port = int(os.getenv("PORT", "8080"))
    print(f"[OK] Запуск локального сервера Mini App на http://localhost:{port}...")
    web.run_app(app, host="0.0.0.0", port=port)
