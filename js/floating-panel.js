// Состояние панели
const panelState = {
    isCollapsed: true,
    position: { x: 0, y: 0 },
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    offsetStart: { x: 0, y: 0 },
    config: {
        n: 40,
        delta: 0.50,
        eve_check_subset_len: 30,
        max_eve_check_errors: 2,
        noise_mode: 'uniform'
    },
    wsConnected: false,
    sessionId: null,
    simulationState: {
        isRunning: false,
        currentStep: 0
    },
    collapsedPosition: { x: 0, y: 0 },
    isAnimating: false,
};

// Конфигурация полей
const configFields = [
    {
        key: 'n',
        label: 'Длина ключа (n)',
        type: 'number',
        step: 1
    },
    {
        key: 'delta',
        label: 'Δ (delta)',
        type: 'number',
        step: 0.01
    },
    {
        key: 'eve_check_subset_len',
        label: 'EveCheckSubsetLen',
        type: 'number',
        step: 1
    },
    {
        key: 'max_eve_check_errors',
        label: 'MaxEveCheckErrors',
        type: 'number',
        step: 1
    }
];

// Получение элементов DOM
const elements = {
    floatingPanel: null,
    panelContainer: null,
    dragHandle: null,
    collapseBtn: null,
    expandBtn: null,
    configFieldsContainer: null,
    controlButtonsContainer: null,
    connectionStatusContainer: null,
    toggleRunBtn: null,
    prevBtn: null,
    nextBtn: null,
    resetBtn: null,
    goHomeBtn: null,
    playIcon: null,
    pauseIcon: null
};

// Инициализация элементов
function initElements() {
    elements.floatingPanel = document.getElementById('floating-panel');
    elements.panelContainer = document.getElementById('panel-container');
    elements.dragHandle = document.getElementById('drag-handle');
    elements.collapseBtn = document.getElementById('collapse-btn');
    elements.expandBtn = document.getElementById('expand-btn');
    elements.configFieldsContainer = document.getElementById('config-fields');
    elements.controlButtonsContainer = document.getElementById('control-buttons');
    elements.connectionStatusContainer = document.getElementById('connection-status');
    elements.toggleRunBtn = document.getElementById('toggle-run-btn');
    elements.prevBtn = document.getElementById('prev-btn');
    elements.nextBtn = document.getElementById('next-btn');
    elements.resetBtn = document.getElementById('reset-btn');
    elements.goHomeBtn = document.getElementById('go-home-btn');
    elements.playIcon = document.getElementById('play-icon');
    elements.pauseIcon = document.getElementById('pause-icon');
}

// Обновление позиции панели
function updatePosition(x, y, smooth = false) {
    // Если уже идет анимация, отменяем ее
    if (panelState.isAnimating && smooth) {
        return;
    }
    
    panelState.position.x = x;
    panelState.position.y = y;
    
    if (smooth) {
        panelState.isAnimating = true;
        elements.floatingPanel.style.transition = 'left 0.3s ease, top 0.3s ease';
        
        // Сбрасываем флаг анимации после завершения
        setTimeout(() => {
            panelState.isAnimating = false;
            elements.floatingPanel.style.transition = '';
        }, 300);
    } else {
        elements.floatingPanel.style.transition = 'none';
    }
    
    elements.floatingPanel.style.left = `${x}px`;
    elements.floatingPanel.style.top = `${y}px`;
}

// Получение реальных размеров активной панели
function getPanelDimensions() {
    if (!elements.panelContainer) {
        return {
            width: panelState.isCollapsed ? 300 : 520,
            height: panelState.isCollapsed ? 60 : 400
        };
    }
    
    const rect = elements.panelContainer.getBoundingClientRect();
    return {
        width: rect.width,
        height: rect.height
    };
}

// Ограничение позиции в пределах окна
function clampPosition(smooth = false) {
    const padding = 16;
    const dimensions = getPanelDimensions();
    const maxX = Math.max(padding, window.innerWidth - dimensions.width - padding);
    const maxY = Math.max(padding, window.innerHeight - dimensions.height - padding);
    
    const clampedX = Math.min(Math.max(padding, panelState.position.x), maxX);
    const clampedY = Math.min(Math.max(padding, panelState.position.y), maxY);
    
    // Обновляем позицию только если она изменилась
    if (clampedX !== panelState.position.x || clampedY !== panelState.position.y) {
        updatePosition(clampedX, clampedY, smooth);
    }
}
// Начало перетаскивания
function startDrag(event) {
    panelState.isDragging = true;
    panelState.dragStart = {
        x: event.clientX,
        y: event.clientY
    };
    panelState.offsetStart = { ...panelState.position };
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
    event.preventDefault();
}

// Обработка перетаскивания
function handleDrag(event) {
    if (!panelState.isDragging) return;
    
    const deltaX = event.clientX - panelState.dragStart.x;
    const deltaY = event.clientY - panelState.dragStart.y;
    
    let newX = panelState.offsetStart.x + deltaX;
    let newY = panelState.offsetStart.y + deltaY;
    
    // Ограничиваем позицию во время перетаскивания
    const padding = 16;
    const dimensions = getPanelDimensions();
    const maxX = window.innerWidth - dimensions.width - padding;
    const maxY = window.innerHeight - dimensions.height - padding;
    
    newX = Math.min(Math.max(padding, newX), maxX);
    newY = Math.min(Math.max(padding, newY), maxY);
    
    updatePosition(newX, newY, false);
}

// Остановка перетаскивания
function stopDrag() {
    if (!panelState.isDragging) return;
    
    panelState.isDragging = false;
    clampPosition(false); // Без плавной анимации при перетаскивании
    
    // Сохраняем позицию свернутой панели после перетаскивания
    if (panelState.isCollapsed) {
        panelState.collapsedPosition.x = panelState.position.x;
        panelState.collapsedPosition.y = panelState.position.y;
    }
    
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// Переключение состояния панели
function toggleCollapse() {
    const currentX = panelState.position.x;
    const currentY = panelState.position.y;
    const wasCollapsed = panelState.isCollapsed;
    
    // Если мы РАЗВОРАЧИВАЕМ панель (была свернута, станет развернута)
    if (wasCollapsed) {
        // Сохраняем позицию свернутой панели перед разворачиванием
        panelState.collapsedPosition.x = currentX;
        panelState.collapsedPosition.y = currentY;
        
        // Меняем состояние
        panelState.isCollapsed = false;
        
        // Обновляем классы для анимации
        updatePanelVisibility();
        
        // Ждем следующего кадра анимации, чтобы получить реальные размеры
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Теперь панель имеет окончательные размеры
                const padding = 16;
            const dimensions = getPanelDimensions();
                
                // Получаем размеры свернутой панели для расчета смещения
                const collapsedDimensions = {
                    width: 300, // примерная ширина свернутой панели
                    height: 60   // примерная высота свернутой панели
                };
                
                // Получаем позицию свернутой панели
                const collapsedX = panelState.collapsedPosition.x;
                const collapsedY = panelState.collapsedPosition.y;
                
                let newX = collapsedX;
                let newY = collapsedY;
                
                // ПРАВЫЙ КРАЙ: проверяем, выходит ли развернутая панель за правый край
                if (collapsedX + dimensions.width > window.innerWidth - padding) {
                    // Если панель прижата к правому краю в свернутом состоянии
                    // то разворачиваем ее влево от текущей позиции
                    if (collapsedX + collapsedDimensions.width > window.innerWidth - padding - 10) {
                        newX = window.innerWidth - dimensions.width - padding;
                    }
                    // Иначе просто корректируем чтобы не выходила за правый край
                    else {
                        newX = Math.max(padding, window.innerWidth - dimensions.width - padding);
                    }
                }
                
                // НИЖНИЙ КРАЙ: проверяем, выходит ли развернутая панель за нижний край
                if (collapsedY + dimensions.height > window.innerHeight - padding) {
                    // Если панель прижата к нижнему краю в свернутом состоянии
                    // то разворачиваем ее вверх от текущей позиции
                    if (collapsedY + collapsedDimensions.height > window.innerHeight - padding - 10) {
                        newY = window.innerHeight - dimensions.height - padding;
            }
                    // Иначе просто корректируем чтобы не выходила за нижний край
                    else {
                        newY = Math.max(padding, window.innerHeight - dimensions.height - padding);
                    }
                }
                
                // ЛЕВЫЙ КРАЙ: проверяем, не выходит ли панель за левый край
                if (collapsedX < padding) {
                    newX = padding;
            }
            
                // ВЕРХНИЙ КРАЙ: проверяем, не выходит ли панель за верхний край
                if (collapsedY < padding) {
                    newY = padding;
                }
                
                // Применяем коррекцию с плавной анимацией
            if (newX !== currentX || newY !== currentY) {
                updatePosition(newX, newY, true);
            }
            });
        });
    } 
    // Если мы СВОРАЧИВАЕМ панель (была развернута, станет свернута)
    else {
        // Восстанавливаем позицию свернутой панели из сохраненной позиции
        const restoreX = panelState.collapsedPosition.x;
        const restoreY = panelState.collapsedPosition.y;
        
        // Меняем состояние
        panelState.isCollapsed = true;
        
        // Обновляем классы для анимации
        updatePanelVisibility();
        
        // Ждем следующего кадра для получения размеров свернутой панели
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Сразу восстанавливаем сохраненную позицию с плавной анимацией
                updatePosition(restoreX, restoreY, true);
            });
        });
    }
}

// Обновление видимости панели с плавными переходами
function updatePanelVisibility() {
    if (panelState.isCollapsed) {
        elements.panelContainer.classList.remove('expanded');
        elements.panelContainer.classList.add('collapsed');
    } else {
        elements.panelContainer.classList.remove('collapsed');
        elements.panelContainer.classList.add('expanded');
    }
}

// Создание поля конфигурации
function createConfigField(field) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'config-field';
    
    const label = document.createElement('label');
    label.textContent = field.label;
    fieldDiv.appendChild(label);
    
    if (field.type === 'select') {
        const select = document.createElement('select');
        select.id = `config-${field.key}`;
        field.options.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option.value;
            optionEl.textContent = option.label;
            if (panelState.config[field.key] === option.value) {
                optionEl.selected = true;
            }
            select.appendChild(optionEl);
        });
        select.addEventListener('change', (e) => {
            updateConfig(field.key, e.target.value);
        });
        fieldDiv.appendChild(select);
    } else {
        const input = document.createElement('input');
        input.type = field.type;
        input.id = `config-${field.key}`;
        input.value = panelState.config[field.key];
        if (field.step) {
            input.step = field.step;
        }
        input.addEventListener('input', (e) => {
            const value = field.type === 'number' ? parseFloat(e.target.value) : e.target.value;
            updateConfig(field.key, value);
        });
        fieldDiv.appendChild(input);
    }
    
    return fieldDiv;
}

// Обновление конфигурации
function updateConfig(key, value) {
    const oldValue = panelState.config[key];
    panelState.config[key] = value;
    console.log('Config updated:', panelState.config);
    
    // Проверяем, можно ли применить изменения
    if (window.simulator) {
        const canApply = window.simulator.canApplyConfigChange(key, oldValue, value);
        
        if (canApply) {
            // Применяем изменения
            window.simulator.applyConfigChange(key, value);
            window.simulator.saveState();
        } else {
            // Показываем уведомление
            if (typeof window.showConfigChangeNotification === 'function') {
                window.showConfigChangeNotification(key, value, oldValue);
            } else {
                console.warn('Изменение конфигурации не может быть применено:', key, value);
            }
        }
    } else {
        // Если симулятор еще не инициализирован, просто сохраняем
        if (typeof localStorage !== 'undefined') {
            const stateToSave = {
                config: panelState.config
            };
            localStorage.setItem('bb84_simulation_state', JSON.stringify(stateToSave));
        }
    }
}

// Создание кнопок управления
function createControlButtons() {
    const container = document.createElement('div');
    container.className = 'control-buttons-container';
    
    const buttons = [
        { id: 'toggle-run-control', label: 'Запустить', class: 'primary', action: () => {
            const handler = window.handleToggleRun || handleToggleRun;
            handler();
            updateControlButtonsLabels();
        }},
        { id: 'prev-step-control', label: 'Назад', action: () => {
            const handler = window.handlePrevStep || handlePrevStep;
            handler();
        }},
        { id: 'next-step-control', label: 'Далее', action: () => {
            const handler = window.handleNextStep || handleNextStep;
            handler();
        }},
        { id: 'reset-control', label: 'Сбросить', action: () => {
            const handler = window.handleReset || handleReset;
            handler();
        }}
    ];
    
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.id = btn.id;
        button.className = `control-btn ${btn.class || ''}`;
        button.textContent = btn.label;
        button.addEventListener('click', btn.action);
        container.appendChild(button);
    });
    
    return container;
}

// Обновление текста кнопок управления
function updateControlButtonsLabels() {
    const toggleRunBtn = document.getElementById('toggle-run-control');
    if (toggleRunBtn) {
        const isRunning = (window.simulator && window.simulator.isRunning) || 
                         (panelState.simulationState && panelState.simulationState.isRunning);
        toggleRunBtn.textContent = isRunning ? 'Остановить' : 'Запустить';
    }
}

// Обновление статуса подключения
function updateConnectionStatus() {
    const statusDiv = document.createElement('div');
    statusDiv.className = `connection-status ${panelState.wsConnected ? 'connected' : 'disconnected'}`;
    
    const indicator = document.createElement('span');
    indicator.className = `status-indicator ${panelState.wsConnected ? 'connected' : 'disconnected'}`;
    
    const text = document.createElement('span');
    text.textContent = panelState.wsConnected 
        ? `Подключено | Сессия: ${panelState.sessionId || 'N/A'} | Шаг: ${panelState.simulationState.currentStep}`
        : 'Не подключено';
    
    statusDiv.appendChild(indicator);
    statusDiv.appendChild(text);
    
    return statusDiv;
}

// Обработчики событий
// Эти функции могут быть переопределены в simulation-integration.js
function handleToggleRun() {
    panelState.simulationState.isRunning = !panelState.simulationState.isRunning;
    updateRunButton();
    console.log('Toggle run:', panelState.simulationState.isRunning);
    // Логика запуска/остановки симуляции будет добавлена в simulation-integration.js
}

function handlePrevStep() {
    if (panelState.simulationState.currentStep > 0) {
        panelState.simulationState.currentStep--;
        updateConnectionStatusDisplay();
    }
    console.log('Prev step:', panelState.simulationState.currentStep);
    // Логика перехода к предыдущему шагу будет добавлена в simulation-integration.js
}

function handleNextStep() {
    panelState.simulationState.currentStep++;
    updateConnectionStatusDisplay();
    console.log('Next step:', panelState.simulationState.currentStep);
    // Логика перехода к следующему шагу будет добавлена в simulation-integration.js
}

function handleReset() {
    panelState.simulationState.currentStep = 0;
    panelState.simulationState.isRunning = false;
    updateRunButton();
    updateConnectionStatusDisplay();
    console.log('Reset simulation');
    // Логика сброса симуляции будет добавлена в simulation-integration.js
}

function handleGoHome() {
    // Очищаем сохраненное состояние симуляции из localStorage
    // чтобы при создании новой сессии не показывалось старое состояние
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('bb84_simulation_state');
    }
    
    // Также очищаем sessionStorage на случай, если там есть данные
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('sessionData');
    }
    
    window.location.href = 'index.html';
}

// Обновление кнопки запуска
function updateRunButton() {
    if (!elements.toggleRunBtn || !elements.playIcon || !elements.pauseIcon) {
        return;
    }
    
    const isRunning = (window.simulator && window.simulator.isRunning) || 
                      panelState.simulationState.isRunning;
    
    if (isRunning) {
        elements.toggleRunBtn.classList.remove('stopped');
        elements.toggleRunBtn.classList.add('running');
        if (elements.playIcon) elements.playIcon.style.display = 'none';
        if (elements.pauseIcon) elements.pauseIcon.style.display = 'block';
        elements.toggleRunBtn.title = 'Остановить';
    } else {
        elements.toggleRunBtn.classList.remove('running');
        elements.toggleRunBtn.classList.add('stopped');
        if (elements.playIcon) elements.playIcon.style.display = 'block';
        if (elements.pauseIcon) elements.pauseIcon.style.display = 'none';
        elements.toggleRunBtn.title = 'Запустить';
    }
    
    if (typeof updateControlButtonsLabels === 'function') {
        updateControlButtonsLabels();
    }
}

// Обновление отображения статуса подключения
function updateConnectionStatusDisplay() {
    if (elements.connectionStatusContainer) {
        const newStatus = updateConnectionStatus();
        elements.connectionStatusContainer.innerHTML = '';
        elements.connectionStatusContainer.appendChild(newStatus);
    }
}
// Получение размеров свернутой панели
function getCollapsedPanelDimensions() {
    // Эти размеры должны соответствовать CSS стилям для .panel-container.collapsed
    return {
        width: 300, // Ширина свернутой панели
        height: 60   // Высота свернутой панели
    };
}

// Инициализация панели
function initPanel() {
    initElements();
    
    // Загружаем конфиг из localStorage, если есть
    // Но проверяем, что значения корректны, иначе используем значения по умолчанию
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('bb84_simulation_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.config && typeof parsed.config === 'object') {
                    // Объединяем сохраненный конфиг с дефолтным, чтобы гарантировать наличие всех полей
                    panelState.config = {
                        ...panelState.config, // Дефолтные значения
                        ...parsed.config     // Сохраненные значения (перезаписывают дефолтные)
                    };
                    
                    // ВАЖНО: Проверяем, что max_eve_check_errors не равен некорректному значению
                    // Если значение отсутствует или некорректно, используем значение по умолчанию (2)
                    // Также сбрасываем значение, если оно равно 5 (старое некорректное значение)
                    if (panelState.config.max_eve_check_errors === undefined || 
                        panelState.config.max_eve_check_errors === null || 
                        isNaN(Number(panelState.config.max_eve_check_errors)) ||
                        panelState.config.max_eve_check_errors === 5) {
                        console.log('Сбрасываем max_eve_check_errors на значение по умолчанию (2)');
                        panelState.config.max_eve_check_errors = 2;
                    }
                    
                    console.log('Config loaded from localStorage:', panelState.config);
                }
            } catch (e) {
                console.error('Ошибка при загрузке конфига из localStorage:', e);
            }
        }
    }
    
    // Инициализация позиции (панель изначально свернута)
    // Устанавливаем начальное состояние перед расчетом позиции
    updatePanelVisibility();
    
    // Ждем, пока панель примет правильный размер
    setTimeout(() => {
        const padding = 16;
        const collapsedDimensions = getCollapsedPanelDimensions();
        
        // Устанавливаем в правый нижний угол
        const initialX = window.innerWidth - padding - collapsedDimensions.width;
        const initialY = window.innerHeight - padding - collapsedDimensions.height;
        
        updatePosition(initialX, initialY, false);
        clampPosition(false);
        
        // Сохраняем начальную позицию свернутой панели
        panelState.collapsedPosition.x = panelState.position.x;
        panelState.collapsedPosition.y = panelState.position.y;
    }, 50);

    
    // Создание полей конфигурации
    configFields.forEach(field => {
        const fieldElement = createConfigField(field);
        elements.configFieldsContainer.appendChild(fieldElement);
    });
    
    // Создание кнопок управления
    const controlButtons = createControlButtons();
    elements.controlButtonsContainer.appendChild(controlButtons);
    
    // Создание статуса подключения
    const connectionStatus = updateConnectionStatus();
    elements.connectionStatusContainer.appendChild(connectionStatus);
    
    // Обновляем статус после небольшой задержки, чтобы он обновился после создания симулятора
    // Это нужно для отображения правильного шага при загрузке страницы
    setTimeout(() => {
        if (typeof updateConnectionStatusDisplay === 'function') {
            updateConnectionStatusDisplay();
        }
    }, 250);
    
    // Установка начального состояния (уже установлено выше)
    updateRunButton();
    
    // Обработчики событий
    elements.dragHandle.addEventListener('mousedown', startDrag);
    elements.panelContainer.addEventListener('mousedown', (e) => {
        // Перетаскивание работает только в свернутом состоянии или при клике на фон
        if (panelState.isCollapsed) {
            if (e.target.closest('.icon-btn') && e.target.closest('.icon-btn') !== elements.expandBtn) {
                return; // Не перетаскивать при клике на кнопки
            }
            startDrag(e);
        }
    });
    
    elements.collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCollapse();
    });
    
    elements.expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCollapse();
    });
    
    elements.toggleRunBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleToggleRun();
    });
    
    elements.prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePrevStep();
    });
    
    elements.nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleNextStep();
    });
    
    elements.resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleReset();
    });
    
    elements.goHomeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleGoHome();
    });
    
    // Обработка изменения размера окна
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            clampPosition(true); // Плавная анимация при изменении размера окна
            // Обновляем сохраненную позицию свернутой панели, если панель свернута
            if (panelState.isCollapsed) {
                panelState.collapsedPosition.x = panelState.position.x;
                panelState.collapsedPosition.y = panelState.position.y;
            }
        }, 100);
    });
}

// Делаем функцию updateRunButton доступной глобально
window.updateRunButton = updateRunButton;

// Экспортируем panelState в window для доступа из других модулей
window.panelState = panelState;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', initPanel);

