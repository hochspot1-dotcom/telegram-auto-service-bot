import sqlite3
import os

DB_PATH = "service_bot.db"

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    """Инициализация базы данных и создание таблиц"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                user_name TEXT,
                problem TEXT NOT NULL,
                car_model TEXT NOT NULL,
                slot TEXT NOT NULL,
                phone TEXT NOT NULL,
                status TEXT DEFAULT 'Активна',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

def add_booking(user_id: int, user_name: str, problem: str, car_model: str, slot: str, phone: str) -> int:
    """Добавление новой записи на ТО"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO bookings (user_id, user_name, problem, car_model, slot, phone)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, user_name, problem, car_model, slot, phone))
        conn.commit()
        return cursor.lastrowid

def get_user_bookings(user_id: int, status_filter: str = None) -> list:
    """Получение всех или фильтрованных записей конкретного пользователя"""
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if status_filter:
            cursor.execute("""
                SELECT id, problem, car_model, slot, phone, status, created_at
                FROM bookings
                WHERE user_id = ? AND status = ?
                ORDER BY id DESC
            """, (user_id, status_filter))
        else:
            cursor.execute("""
                SELECT id, problem, car_model, slot, phone, status, created_at
                FROM bookings
                WHERE user_id = ?
                ORDER BY id DESC
            """, (user_id,))
        return cursor.fetchall()

def get_user_stats(user_id: int) -> dict:
    """Получение персональной статистики и данных профиля пользователя"""
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as cnt FROM bookings WHERE user_id = ?", (user_id,))
        total = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT COUNT(*) as cnt FROM bookings WHERE user_id = ? AND status = 'Активна'", (user_id,))
        active = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT COUNT(*) as cnt FROM bookings WHERE user_id = ? AND status = 'Отменена'", (user_id,))
        cancelled = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT phone, car_model FROM bookings WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,))
        last = cursor.fetchone()
        
        return {
            "total": total,
            "active": active,
            "cancelled": cancelled,
            "phone": last["phone"] if last else "Не указан",
            "car_model": last["car_model"] if last else "Не указан"
        }

def cancel_booking_by_id(booking_id: int, user_id: int) -> bool:
    """Отмена записи по ID"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE bookings
            SET status = 'Отменена'
            WHERE id = ? AND user_id = ? AND status = 'Активна'
        """, (booking_id, user_id))
        conn.commit()
        return cursor.rowcount > 0
