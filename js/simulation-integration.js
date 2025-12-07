/**
 * Интеграция симулятора BB84 с панелью управления
 */

let simulator = null;

// Инициализация симулятора после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    // Ждем инициализации панели управления
    setTimeout(() => {
        const simulationContainer = document.getElementById('simulation-content');
        if (simulationContainer) {
            simulator = new BB84Simulator(simulationContainer);
            window.simulator = simulator; // Делаем доступным глобально
            
            // Загружаем состояние из sessionStorage, если есть
            const savedSessionData = sessionStorage.getItem('sessionData');
            if (savedSessionData) {
                try {
                    const data = JSON.parse(savedSessionData);
                    simulator.importState(data);
                    sessionStorage.removeItem('sessionData'); // Очищаем после загрузки
                } catch (e) {
                    console.error('Ошибка при загрузке сессии:', e);
                }
            }
            
            // Переходим на текущий шаг
            simulator.goToStep(simulator.currentStep);
            
            // Обновляем обработчики панели управления
            updatePanelHandlers();
            
            // Обновляем статус подключения после создания симулятора
            if (typeof updateConnectionStatusDisplay === 'function') {
                updateConnectionStatusDisplay();
            }
            
            // Добавляем кнопку экспорта в меню
            addExportButton();
        }
    }, 100);
});

// Обновление обработчиков панели управления
function updatePanelHandlers() {
    // Переопределяем обработчики для работы с симулятором
    window.handleToggleRun = function() {
        if (simulator) {
            simulator.toggleAutoPlay();
            panelState.simulationState.isRunning = simulator.isRunning;
            if (typeof updateRunButton === 'function') {
                updateRunButton();
            }
            if (typeof updateControlButtonsLabels === 'function') {
                updateControlButtonsLabels();
            }
        } else {
            panelState.simulationState.isRunning = !panelState.simulationState.isRunning;
            if (typeof updateRunButton === 'function') {
                updateRunButton();
            }
        }
    };
    
    // Переопределяем handlePrevStep
    window.handlePrevStep = function() {
        if (simulator) {
            simulator.prevStep();
            panelState.simulationState.currentStep = simulator.currentStep;
            updateConnectionStatusDisplay();
        }
    };
    
    // Переопределяем handleNextStep
    window.handleNextStep = function() {
        if (simulator) {
            simulator.nextStep();
            panelState.simulationState.currentStep = simulator.currentStep;
            updateConnectionStatusDisplay();
        }
    };
    
    // Переопределяем handleReset
    window.handleReset = function() {
        if (simulator) {
            simulator.reset();
            panelState.simulationState.currentStep = 0;
            panelState.simulationState.isRunning = false;
            updateRunButton();
            updateConnectionStatusDisplay();
        }
    };
    
    // Обновляем отображение статуса
    const originalUpdateConnectionStatus = updateConnectionStatus;
    window.updateConnectionStatus = function() {
        const statusDiv = document.createElement('div');
        statusDiv.className = `connection-status ${panelState.wsConnected ? 'connected' : 'disconnected'}`;
        
        const indicator = document.createElement('span');
        indicator.className = `status-indicator ${panelState.wsConnected ? 'connected' : 'disconnected'}`;
        
        const text = document.createElement('span');
        if (simulator) {
            // Если симулятор создан, показываем текущий шаг
            text.textContent = `Шаг: ${simulator.currentStep} / ${simulator.steps.length - 1}`;
        } else {
            // Если симулятор еще не создан, проверяем сохраненное состояние
            let currentStep = 0;
            const totalSteps = 9; // Всего шагов 0-9
            
            // Проверяем sessionStorage (для загруженной сессии из JSON)
            const savedSessionData = sessionStorage.getItem('sessionData');
            if (savedSessionData) {
                try {
                    const data = JSON.parse(savedSessionData);
                    currentStep = data.currentStep || 0;
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            } else {
                // Проверяем localStorage (для сохраненной сессии)
                const savedState = localStorage.getItem('bb84_simulation_state');
                if (savedState) {
                    try {
                        const parsed = JSON.parse(savedState);
                        currentStep = parsed.currentStep || 0;
                    } catch (e) {
                        // Игнорируем ошибки парсинга
                    }
                }
            }
            
            // Показываем шаг вместо "Не подключено"
            text.textContent = `Шаг: ${currentStep} / ${totalSteps}`;
        }
        
        statusDiv.appendChild(indicator);
        statusDiv.appendChild(text);
        
        return statusDiv;
    };
}

// Добавление кнопки экспорта в меню
function addExportButton() {
    // Добавляем кнопку экспорта в развернутую панель
    const controlButtonsContainer = elements.controlButtonsContainer;
    if (controlButtonsContainer) {
        const exportBtn = document.createElement('button');
        exportBtn.id = 'export-btn';
        exportBtn.className = 'control-btn';
        exportBtn.textContent = 'Экспорт в JSON';
        exportBtn.addEventListener('click', handleExport);
        controlButtonsContainer.appendChild(exportBtn);
    }
}

// Обработчик экспорта
function handleExport() {
    if (!simulator) {
        alert('Симулятор не инициализирован');
        return;
    }
    
    const exportData = simulator.exportState();
    
    // Используем функцию сохранения из index.js, если она доступна
    if (window.saveSessionToFile) {
        window.saveSessionToFile(exportData, `bb84-session-${Date.now()}.json`);
    } else {
        // Альтернативный способ сохранения
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bb84-session-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    console.log('Экспортировано:', exportData);
}

// Функция показа уведомления об изменении конфигурации
function showConfigChangeNotification(key, newValue, oldValue) {
    // Удаляем предыдущее уведомление, если есть
    const existingNotification = document.querySelector('.config-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'config-notification';
    
    const configLabels = {
        n: 'Длина ключа (n)',
        delta: 'Δ (delta)',
        eve_check_subset_len: 'EveCheckSubsetLen',
        max_eve_check_errors: 'MaxEveCheckErrors',
        noise_mode: 'Тип шума'
    };
    
    const label = configLabels[key] || key;
    const reason = key === 'n' 
        ? 'Изменение длины ключа невозможно после генерации битов. Сбросьте симуляцию для применения изменений.'
        : 'Изменение этого параметра невозможно на текущем этапе симуляции. Сбросьте симуляцию для применения изменений.';
    
    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
                <p class="font-semibold">Изменение не применено</p>
                <p class="text-sm mt-1">${label}: ${oldValue} → ${newValue}</p>
                <p class="text-sm mt-1 opacity-90">${reason}</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматически скрываем через 5 секунд
    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease-out reverse';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Делаем функцию доступной глобально
window.showConfigChangeNotification = showConfigChangeNotification;

