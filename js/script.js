// Ждем загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Получаем элементы
    const button = document.getElementById('demo-button');
    const demoText = document.getElementById('demo-text');
    
    // Обработчик клика на кнопку
    button.addEventListener('click', function() {
        const messages = [
            'Привет! Это работает! 🎉',
            'JavaScript подключен и работает корректно! ✅',
            'Вы успешно настроили фронтенд окружение! 🚀',
            'Все системы работают! 💪'
        ];
        
        // Выбираем случайное сообщение
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        
        // Добавляем анимацию с использованием Tailwind классов
        demoText.classList.add('opacity-0');
        
        setTimeout(() => {
            demoText.textContent = randomMessage;
            demoText.classList.remove('opacity-0');
            demoText.classList.add('opacity-100');
        }, 200);
    });
    
    // Инициализация
    console.log('Frontend проект загружен успешно!');
});

