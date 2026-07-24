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
                status TEXT DEFAULT 'На рассмотрении',
                comment TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        try:
            cursor.execute("ALTER TABLE bookings ADD COLUMN comment TEXT DEFAULT ''")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE bookings ADD COLUMN car_number TEXT DEFAULT ''")
        except Exception:
            pass
        conn.commit()

def add_booking(user_id: int, user_name: str, problem: str, car_model: str, slot: str, phone: str, car_number: str = "") -> int:
    """Добавление новой записи на ТО со статусом 'На рассмотрении'"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO bookings (user_id, user_name, problem, car_model, car_number, slot, phone, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'На рассмотрении')
        """, (user_id, user_name, problem, car_model, car_number, slot, phone))
        conn.commit()
        return cursor.lastrowid

def get_booking_by_id(booking_id: int) -> dict | None:
    """Получение подробной информации о конкретной записи по ID"""
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_user_bookings(user_id: int, status_filter: str = None) -> list:
    """Получение всех или фильтрованных записей конкретного пользователя"""
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if status_filter:
            cursor.execute("""
                SELECT id, problem, car_model, car_number, slot, phone, status, comment, created_at
                FROM bookings
                WHERE user_id = ? AND status = ?
                ORDER BY id DESC
            """, (user_id, status_filter))
        else:
            cursor.execute("""
                SELECT id, problem, car_model, car_number, slot, phone, status, comment, created_at
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
        
        cursor.execute("SELECT COUNT(*) as cnt FROM bookings WHERE user_id = ? AND status IN ('На рассмотрении', 'Одобрена', 'Активна')", (user_id,))
        active = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT COUNT(*) as cnt FROM bookings WHERE user_id = ? AND status = 'Отклонена'", (user_id,))
        cancelled = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT phone, car_model, car_number FROM bookings WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,))
        last = cursor.fetchone()
        
        return {
            "total": total,
            "active": active,
            "cancelled": cancelled,
            "phone": last["phone"] if last else "Не указан",
            "car_model": last["car_model"] if last else "Не указан",
            "car_number": last["car_number"] if last else ""
        }

def cancel_booking_by_id(booking_id: int, user_id: int) -> bool:
    """Отмена записи по ID пользователем"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE bookings
            SET status = 'Отменена пользователем'
            WHERE id = ? AND user_id = ? AND status IN ('На рассмотрении', 'Одобрена', 'Активна')
        """, (booking_id, user_id))
        conn.commit()
        return cursor.rowcount > 0

# --- Функции администратора / модератора ---

def get_all_bookings(status_filter: str = None) -> list:
    """Получение всех записей сервиса для администратора"""
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if status_filter:
            cursor.execute("""
                SELECT id, user_id, user_name, problem, car_model, car_number, slot, phone, status, comment, created_at
                FROM bookings
                WHERE status = ?
                ORDER BY id DESC
            """, (status_filter,))
        else:
            cursor.execute("""
                SELECT id, user_id, user_name, problem, car_model, car_number, slot, phone, status, comment, created_at
                FROM bookings
                ORDER BY id DESC
            """)
        return cursor.fetchall()


def update_booking_status(booking_id: int, new_status: str, comment: str = "") -> bool:
    """Изменение статуса записи и добавление комментария модератора"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE bookings
            SET status = ?, comment = ?
            WHERE id = ?
        """, (new_status, comment, booking_id))
        conn.commit()
        return cursor.rowcount > 0

def delete_booking_by_id(booking_id: int) -> bool:
    """Полное удаление записи модератором"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
        conn.commit()
        return cursor.rowcount > 0


def get_admin_stats() -> dict:
    """Общая статистика автосервиса для модератора"""
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as cnt FROM bookings")
        total = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT COUNT(*) as cnt FROM bookings WHERE status = 'На рассмотрении'")
        pending = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT COUNT(*) as cnt FROM bookings WHERE status = 'Одобрена'")
        approved = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT COUNT(*) as cnt FROM bookings WHERE status = 'Отклонена'")
        rejected = cursor.fetchone()["cnt"]
        
        return {
            "total": total,
            "pending": pending,
            "approved": approved,
            "rejected": rejected
        }
