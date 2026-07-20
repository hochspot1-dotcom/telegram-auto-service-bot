# 🚗 Telegram Auto Service Bot

A modern, interactive Telegram bot for an Auto Repair Service built with Python and **aiogram 3.x** framework.

[![Python Version](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![aiogram](https://img.shields.io/badge/aiogram-3.x-blue.svg)](https://docs.aiogram.dev/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## ✨ Key Features

- 🛠 **Services & Prices** — Quick overview of repair and maintenance price list.
- 📅 **Interactive Appointment Booking (FSM)** — Step-by-step booking flow:
  1. **Problem Category Selection:** Choose from predefined categories (*Engine, Brakes & Suspension, Electrical, Oil Change, AC/Climate*) or type a custom issue.
  2. **Car Brand & Model Validation:** Smart automatic translation of Cyrillic car names to English (*e.g., "опель астра" ➡️ "Opel Astra", "тойота камри" ➡️ "Toyota Camry"*).
  3. **Exact Date & Time Slots:** Real calendar dates and weekdays generated dynamically for booking.
  4. **Contact Sharing:** Easy one-click phone number submission via Telegram contact button or manual text.
  5. **Booking Confirmation:** Final confirmation card before submitting.
- 👤 **Personal Cabinet & Booking History (SQLite DB)** — Dedicated personal space for clients to view profile details, phone number, active bookings, full history of visits, and cancel bookings if needed.
- 📍 **Contacts & Address** — Location, working hours, and phone details.
- ℹ️ **About Us** — Overview of company experience and guarantees.

---

## 🛠 Tech Stack

- **Language:** Python 3.10+
- **Framework:** `aiogram 3.x` (Async Telegram Bot API framework)
- **Database:** SQLite 3 (`service_bot.db`)
- **Environment Management:** `python-dotenv`
- **State Management:** `aiogram` FSM (Finite State Machine)

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10 or higher installed.
- A Telegram bot token obtained from [@BotFather](https://t.me/BotFather).

### 2. Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/hochspot1-dotcom/telegram-auto-service-bot.git
   cd telegram-auto-service-bot
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (or copy from `.env.example`):
   ```env
   BOT_TOKEN=your_telegram_bot_token_here
   ```

4. **Run the Bot:**
   ```bash
   python main.py
   ```

---

## 📂 Project Structure

```
.
├── main.py              # Main bot entry point & FSM handlers
├── database.py          # SQLite database connection & queries
├── service_bot.db       # SQLite database storage file (auto-generated)
├── requirements.txt     # Python dependencies (aiogram, python-dotenv)
├── .env.example         # Example environment variables file
├── .gitignore           # Git ignore file (excludes .env)
└── README.md            # Project documentation
```

---

## 📄 License

This project is licensed under the MIT License.
