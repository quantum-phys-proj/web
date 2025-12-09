
document.addEventListener('DOMContentLoaded', function() {
    
    const button = document.getElementById('demo-button');
    const demoText = document.getElementById('demo-text');
    
    
    button.addEventListener('click', function() {
        const messages = [
            'Привет! Это работает! 🎉',
            'JavaScript подключен и работает корректно! ✅',
            'Вы успешно настроили фронтенд окружение! 🚀',
            'Все системы работают! 💪'
        ];
        
        
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        
        
        demoText.classList.add('opacity-0');
        
        setTimeout(() => {
            demoText.textContent = randomMessage;
            demoText.classList.remove('opacity-0');
            demoText.classList.add('opacity-100');
        }, 200);
    });
    
    
    console.log('Frontend проект загружен успешно!');
});

