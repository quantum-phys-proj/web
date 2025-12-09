
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


function updatePosition(x, y, smooth = false) {
    
    if (panelState.isAnimating && smooth) {
        return;
    }
    
    panelState.position.x = x;
    panelState.position.y = y;
    
    if (smooth) {
        panelState.isAnimating = true;
        elements.floatingPanel.style.transition = 'left 0.3s ease, top 0.3s ease';
        
        
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


function clampPosition(smooth = false) {
    const padding = 16;
    const dimensions = getPanelDimensions();
    const maxX = Math.max(padding, window.innerWidth - dimensions.width - padding);
    const maxY = Math.max(padding, window.innerHeight - dimensions.height - padding);
    
    const clampedX = Math.min(Math.max(padding, panelState.position.x), maxX);
    const clampedY = Math.min(Math.max(padding, panelState.position.y), maxY);
    
    
    if (clampedX !== panelState.position.x || clampedY !== panelState.position.y) {
        updatePosition(clampedX, clampedY, smooth);
    }
}

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


function handleDrag(event) {
    if (!panelState.isDragging) return;
    
    const deltaX = event.clientX - panelState.dragStart.x;
    const deltaY = event.clientY - panelState.dragStart.y;
    
    let newX = panelState.offsetStart.x + deltaX;
    let newY = panelState.offsetStart.y + deltaY;
    
    
    const padding = 16;
    const dimensions = getPanelDimensions();
    const maxX = window.innerWidth - dimensions.width - padding;
    const maxY = window.innerHeight - dimensions.height - padding;
    
    newX = Math.min(Math.max(padding, newX), maxX);
    newY = Math.min(Math.max(padding, newY), maxY);
    
    updatePosition(newX, newY, false);
}


function stopDrag() {
    if (!panelState.isDragging) return;
    
    panelState.isDragging = false;
    clampPosition(false); 
    
    
    if (panelState.isCollapsed) {
        panelState.collapsedPosition.x = panelState.position.x;
        panelState.collapsedPosition.y = panelState.position.y;
    }
    
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
}


function toggleCollapse() {
    const currentX = panelState.position.x;
    const currentY = panelState.position.y;
    const wasCollapsed = panelState.isCollapsed;
    
    
    if (wasCollapsed) {
        
        panelState.collapsedPosition.x = currentX;
        panelState.collapsedPosition.y = currentY;
        
        
        panelState.isCollapsed = false;
        
        
        updatePanelVisibility();
        
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                
                const padding = 16;
            const dimensions = getPanelDimensions();
                
                
                const collapsedDimensions = {
                    width: 300, 
                    height: 60   
                };
                
                
                const collapsedX = panelState.collapsedPosition.x;
                const collapsedY = panelState.collapsedPosition.y;
                
                let newX = collapsedX;
                let newY = collapsedY;
                
                
                if (collapsedX + dimensions.width > window.innerWidth - padding) {
                    
                    
                    if (collapsedX + collapsedDimensions.width > window.innerWidth - padding - 10) {
                        newX = window.innerWidth - dimensions.width - padding;
                    }
                    
                    else {
                        newX = Math.max(padding, window.innerWidth - dimensions.width - padding);
                    }
                }
                
                
                if (collapsedY + dimensions.height > window.innerHeight - padding) {
                    
                    
                    if (collapsedY + collapsedDimensions.height > window.innerHeight - padding - 10) {
                        newY = window.innerHeight - dimensions.height - padding;
            }
                    
                    else {
                        newY = Math.max(padding, window.innerHeight - dimensions.height - padding);
                    }
                }
                
                
                if (collapsedX < padding) {
                    newX = padding;
            }
            
                
                if (collapsedY < padding) {
                    newY = padding;
                }
                
                
            if (newX !== currentX || newY !== currentY) {
                updatePosition(newX, newY, true);
            }
            });
        });
    } 
    
    else {
        
        const restoreX = panelState.collapsedPosition.x;
        const restoreY = panelState.collapsedPosition.y;
        
        
        panelState.isCollapsed = true;
        
        
        updatePanelVisibility();
        
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                
                updatePosition(restoreX, restoreY, true);
            });
        });
    }
}


function updatePanelVisibility() {
    if (panelState.isCollapsed) {
        elements.panelContainer.classList.remove('expanded');
        elements.panelContainer.classList.add('collapsed');
    } else {
        elements.panelContainer.classList.remove('collapsed');
        elements.panelContainer.classList.add('expanded');
    }
}


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


function updateConfig(key, value) {
    const oldValue = panelState.config[key];
    panelState.config[key] = value;
    console.log('Config updated:', panelState.config);
    
    
    if (window.simulator) {
        const canApply = window.simulator.canApplyConfigChange(key, oldValue, value);
        
        if (canApply) {
            
            window.simulator.applyConfigChange(key, value);
            window.simulator.saveState();
        } else {
            
            if (typeof window.showConfigChangeNotification === 'function') {
                window.showConfigChangeNotification(key, value, oldValue);
            } else {
                console.warn('Изменение конфигурации не может быть применено:', key, value);
            }
        }
    } else {
        
        if (typeof localStorage !== 'undefined') {
            const stateToSave = {
                config: panelState.config
            };
            localStorage.setItem('bb84_simulation_state', JSON.stringify(stateToSave));
        }
    }
}


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


function updateControlButtonsLabels() {
    const toggleRunBtn = document.getElementById('toggle-run-control');
    if (toggleRunBtn) {
        const isRunning = (window.simulator && window.simulator.isRunning) || 
                         (panelState.simulationState && panelState.simulationState.isRunning);
        toggleRunBtn.textContent = isRunning ? 'Остановить' : 'Запустить';
    }
}


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



function handleToggleRun() {
    panelState.simulationState.isRunning = !panelState.simulationState.isRunning;
    updateRunButton();
    console.log('Toggle run:', panelState.simulationState.isRunning);
    
}

function handlePrevStep() {
    if (panelState.simulationState.currentStep > 0) {
        panelState.simulationState.currentStep--;
        updateConnectionStatusDisplay();
    }
    console.log('Prev step:', panelState.simulationState.currentStep);
    
}

function handleNextStep() {
    panelState.simulationState.currentStep++;
    updateConnectionStatusDisplay();
    console.log('Next step:', panelState.simulationState.currentStep);
    
}

function handleReset() {
    panelState.simulationState.currentStep = 0;
    panelState.simulationState.isRunning = false;
    updateRunButton();
    updateConnectionStatusDisplay();
    console.log('Reset simulation');
    
}

function handleGoHome() {
    
    
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('bb84_simulation_state');
    }
    
    
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('sessionData');
    }
    
    window.location.href = 'index.html';
}


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


function updateConnectionStatusDisplay() {
    if (elements.connectionStatusContainer) {
        const newStatus = updateConnectionStatus();
        elements.connectionStatusContainer.innerHTML = '';
        elements.connectionStatusContainer.appendChild(newStatus);
    }
}

function getCollapsedPanelDimensions() {
    
    return {
        width: 300, 
        height: 60   
    };
}


function initPanel() {
    initElements();
    
    
    
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('bb84_simulation_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.config && typeof parsed.config === 'object') {
                    
                    panelState.config = {
                        ...panelState.config, 
                        ...parsed.config     
                    };
                    
                    
                    
                    
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
    
    
    
    updatePanelVisibility();
    
    
    setTimeout(() => {
        const padding = 16;
        const collapsedDimensions = getCollapsedPanelDimensions();
        
        
        const initialX = window.innerWidth - padding - collapsedDimensions.width;
        const initialY = window.innerHeight - padding - collapsedDimensions.height;
        
        updatePosition(initialX, initialY, false);
        clampPosition(false);
        
        
        panelState.collapsedPosition.x = panelState.position.x;
        panelState.collapsedPosition.y = panelState.position.y;
    }, 50);

    
    
    configFields.forEach(field => {
        const fieldElement = createConfigField(field);
        elements.configFieldsContainer.appendChild(fieldElement);
    });
    
    
    const controlButtons = createControlButtons();
    elements.controlButtonsContainer.appendChild(controlButtons);
    
    
    const connectionStatus = updateConnectionStatus();
    elements.connectionStatusContainer.appendChild(connectionStatus);
    
    
    
    setTimeout(() => {
        if (typeof updateConnectionStatusDisplay === 'function') {
            updateConnectionStatusDisplay();
        }
    }, 250);
    
    
    updateRunButton();
    
    
    elements.dragHandle.addEventListener('mousedown', startDrag);
    elements.panelContainer.addEventListener('mousedown', (e) => {
        
        if (panelState.isCollapsed) {
            if (e.target.closest('.icon-btn') && e.target.closest('.icon-btn') !== elements.expandBtn) {
                return; 
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
    
    
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            clampPosition(true); 
            
            if (panelState.isCollapsed) {
                panelState.collapsedPosition.x = panelState.position.x;
                panelState.collapsedPosition.y = panelState.position.y;
            }
        }, 100);
    });
}


window.updateRunButton = updateRunButton;


window.panelState = panelState;


document.addEventListener('DOMContentLoaded', initPanel);

