import os
import json
import logging
from datetime import datetime, timedelta
from aiohttp import web
from aiogram import Bot
from aiogram.utils.keyboard import InlineKeyboardBuilder

from database import (
    add_booking, get_user_bookings, get_user_stats, 
    cancel_booking_by_id, get_booking_by_id,
    get_all_bookings, get_admin_stats, delete_booking_by_id,
    mark_master_bookings_unavailable, reschedule_booking
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

@routes.get(r"/{filename:(?:style\.css|app\.js|favicon\.ico)}")
async def handle_root_assets(request: web.Request):
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
    from main import validate_and_format_car, validate_custom_problem, get_admin_ids

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

    # Уведомление модераторов
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

            # Send Telegram notification to CLIENT
            client_msg = (
                f"❌ <b>Ваша запись №{b_id} отменена</b>\n\n"
                f"• <b>Услуга:</b> {booking['problem']}\n"
                f"• <b>Автомобиль:</b> {car_info}\n"
                f"• <b>Была на время:</b> {booking['slot']}\n\n"
                "Вы всегда можете записаться снова на любое удобное время!"
            )
            builder = InlineKeyboardBuilder()
            builder.button(text="📅 Записаться снова", callback_data="nav_booking")
            try:
                await bot.send_message(client_id, client_msg, parse_mode="HTML", reply_markup=builder.as_markup())
            except Exception as e:
                logging.error(f"Не удалось отправить уведомление клиенту {client_id}: {e}")

            # Send Telegram notification to MODERATORS
            from main import get_admin_ids
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

# --- Admin / Moderator Endpoints ---

def check_is_admin(user_id: int) -> bool:
    from main import get_admin_ids
    return user_id in get_admin_ids()

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
    from main import process_moderator_decision

    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    admin_id = data.get("admin_id")
    booking_id = data.get("booking_id")
    action = data.get("action") # "approve", "reject", "delete", "cancel"
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

    if action == "cancel":
        booking = get_booking_by_id(booking_id)
        if booking:
            cancel_booking_by_id(booking_id, booking["user_id"])
            return web.json_response({"success": True, "message": "Запись отменена"})
        return web.json_response({"error": "Не найдена"}, status=400)
    
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
            builder.button(text="🔄 Выбрать другого мастера/время", callback_data=f"reschedule_{booking_id}")
            builder.button(text="❌ Отменить запись", callback_data=f"cancel_b_{booking_id}")
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
