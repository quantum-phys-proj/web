# Frontend Project

Простой фронтенд проект на HTML, CSS и JavaScript с Tailwind CSS.

## Структура проекта

```
proj/
├── index.html      # Главный HTML файл
├── css/
│   └── style.css   # Дополнительные кастомные стили
├── js/
│   └── script.js   # JavaScript код
└── README.md       # Документация
```

## Запуск проекта

1. Откройте `index.html` в браузере
2. Или используйте локальный сервер:

```bash
# Python 3
python -m http.server 8000

# Node.js (если установлен http-server)
npx http-server -p 8000
```

Затем откройте в браузере: `http://localhost:8000`

## Технологии

- HTML5
- CSS3
- Tailwind CSS (через CDN)
- Vanilla JavaScript (ES6+)

## Особенности

- ✅ Tailwind CSS для быстрой разработки
- ✅ Адаптивный дизайн
- ✅ Современный UI
- ✅ Чистый код без зависимостей (кроме Tailwind CDN)
- ✅ Готов к расширению

## Использование Tailwind

Проект использует Tailwind CSS через CDN. Все стили применяются через utility-классы в HTML.

Примеры:
- `bg-blue-500` - синий фон
- `text-white` - белый текст
- `p-4` - padding
- `rounded-lg` - скругленные углы
- `hover:shadow-lg` - тень при наведении

Документация: https://tailwindcss.com/docs

