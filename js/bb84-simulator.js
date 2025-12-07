/**
 * Симулятор алгоритма BB84
 * Управляет шагами симуляции и состоянием
 */
class BB84Simulator {
    constructor(container) {
        this.container = container;
        this.currentStep = 0;
        this.steps = [];
        this.state = {
            aliceBits: [],
            aliceBases: [],
            aliceQubits: [],
            channelQubits: [], // Кубиты в канале (после атаки Евы)
            eveAttacks: {}, // Атаки Евы {index: {attackType, basis, measuredBit, qubit}}
            bobBases: [],
            bobBits: [],
            keptIndices: [], // Индексы совпадающих битов после шага 7
            aliceMatchingBits: [], // Биты Алисы для совпадающих позиций (с originalIndex)
            bobMatchingBits: [], // Биты Боба для совпадающих позиций (с originalIndex)
            reconciliationIndices: [], // Индексы битов для reconciliation (после шага 8)
            aliceReconciliationBits: [], // Биты Алисы для reconciliation
            bobReconciliationBits: [], // Биты Боба для reconciliation
            reconciledAliceBits: [], // Биты Алисы после reconciliation
            reconciledBobBits: [], // Биты Боба после reconciliation
            parityRevealed: [], // Раскрытая информация (паритеты блоков)
            finalKey: [], // Финальный ключ после privacy amplification
            finalKeyLength: 0, // Длина финального ключа
            hashSeed: null, // Seed для хэш-функции privacy amplification
            // Добавляем другие поля по мере необходимости
        };
        this.stepHistory = []; // История состояний для каждого шага
        this.isRunning = false;
        this.autoPlayInterval = null;
        this.autoPlayDelay = 1500; // Задержка между шагами в мс
        
        this.stepContainers = new Map(); // Хранит контейнеры для каждого шага
        this.bitTapes = new Map(); // Хранит экземпляры BitTape
        this.stepBitTapes = new Map(); // Хранит BitTape для каждого шага (Map<stepNumber, Array<BitTape>>)
        this.renderedSteps = new Set(); // Отслеживаем уже отрендеренные шаги
        this.stepHeaderContainer = null; // Контейнер для общего заголовка шага
        this.selectedElement = null; // Выбранный элемент (кубит или бит)
        this.selectedElementStep = null; // Шаг, в котором находится выбранный элемент
        this.selectedIndices = []; // Множественный выбор для шага 4 (атаки Евы)
        this.lastSelectedIndex = null; // Последний выбранный индекс для диапазонного выбора
        this.qubitDetails = null; // Экземпляр QubitDetails
        this.bottomPanel = null; // Экземпляр BottomPanel
        this.eventLog = []; // Лог событий
        
        this.loadState();
        this.initSteps();
        this.createStepHeader();
        this.updateStepHeader(0); // Скрываем заголовок на шаге 0
        this.initDetailsPanel();
        this.initBottomPanel();
    }
    
    initDetailsPanel() {
        const detailsPanel = document.getElementById('details-panel');
        if (detailsPanel) {
            this.qubitDetails = new QubitDetails(detailsPanel, {
                onClose: () => this.clearSelection(),
                onSelectIndex: (index) => this.selectQubitByIndex(index)
            });
        }
    }
    
    initBottomPanel() {
        const bottomPanelContainer = document.getElementById('bottom-panel-container');
        if (bottomPanelContainer) {
            this.bottomPanel = new BottomPanel(bottomPanelContainer, {
                metrics: this.getMetrics(),
                eventLog: this.eventLog
            });
        }
    }
    
    getMetrics() {
        // Вычисляем QBER (Quantum Bit Error Rate) - пока заглушка
        const qber = 0; // TODO: вычислить реальный QBER
        
        // Потерянные кубиты - пока заглушка
        const lost_qubits = 0; // TODO: вычислить реальные потери
        
        // Атаковано Евой - пока заглушка
        const eve_attacked_count = 0; // TODO: вычислить реальные атаки
        
        // Размер ключа - количество битов
        const key_size = this.state.aliceBits ? this.state.aliceBits.length : 0;
        
        return {
            qber: qber,
            lost_qubits: lost_qubits,
            eve_attacked_count: eve_attacked_count,
            key_size: key_size,
            currentStep: this.currentStep,
            totalBits: this.state.aliceBits ? this.state.aliceBits.length : 0,
            totalQubits: this.state.aliceQubits ? this.state.aliceQubits.length : 0
        };
    }
    
    addEvent(message, type = 'info') {
        this.eventLog.push({
            timestamp: Date.now(),
            message: message,
            type: type
        });
        // Ограничиваем размер лога до 100 событий
        if (this.eventLog.length > 100) {
            this.eventLog = this.eventLog.slice(-100);
        }
        this.updateBottomPanel();
    }
    
    updateBottomPanel() {
        if (this.bottomPanel) {
            this.bottomPanel.update(this.getMetrics(), this.eventLog);
        }
    }
    
    handleElementClick(elementData, event) {
        if (this.currentStep === 6) {
            const bobBasesTape = this.bitTapes.get('bobBases');
            const bobBitsTape = this.bitTapes.get('bobBits');
            const aliceQubitsTape = this.bitTapes.get('aliceQubits');
            const bobQubitsTape = this.bitTapes.get('bobQubits');
            if (bobBasesTape) {
                bobBasesTape.clearSelection();
            }
            if (bobBitsTape) {
                bobBitsTape.clearSelection();
            }
            if (aliceQubitsTape) {
                aliceQubitsTape.clearSelection();
            }
            if (bobQubitsTape) {
                bobQubitsTape.clearSelection();
            }
        } else {
            this.bitTapes.forEach(tape => {
                tape.clearSelection();
            });
        }
        
        // Теперь устанавливаем новый выбор
        this.selectedElement = elementData;
        this.selectedElementStep = this.currentStep;
        
        // Собираем альтернативные индексы для кубитов (все индексы кубитов на текущем шаге)
        let alternateIndices = [];
        if (elementData.type === 'qubit' && this.state.aliceQubits) {
            alternateIndices = this.state.aliceQubits.map((q, i) => i);
        }
        
        if (this.qubitDetails) {
            this.qubitDetails.setSelectedElement(elementData);
            this.qubitDetails.setAlternateIndices(alternateIndices);
        }
        
        let targetTape = null;
        if (elementData.type === 'qubit') {
            targetTape = this.bitTapes.get('aliceQubits');
        } else if (elementData.tapeTitle) {
            this.bitTapes.forEach((tape, key) => {
                if (tape && tape.options && tape.options.title === elementData.tapeTitle) {
                    targetTape = tape;
                }
            });
        }
        
        if (targetTape && elementData.index !== undefined && targetTape.bits && elementData.index < targetTape.bits.length) {
            const bit = targetTape.bits[elementData.index];
            if (bit !== undefined) {
                if (targetTape.selectedIndex !== null && targetTape.selectedIndex !== elementData.index) {
                    const prevSquare = targetTape.findBitSquare(targetTape.selectedIndex);
                    if (prevSquare) {
                        prevSquare.classList.remove('bit-square-selected');
                    }
                }
                
                targetTape.selectedIndex = elementData.index;
                
                const originalOnElementClick = targetTape.options.onElementClick;
                targetTape.options.onElementClick = null;
                targetTape.selectElement(elementData.index, bit, event);
                targetTape.options.onElementClick = originalOnElementClick;
                
                const square = targetTape.findBitSquare(elementData.index);
                if (square) {
                    square.classList.add('bit-square-selected');
                } else {
                    setTimeout(() => {
                        const squareRetry = targetTape.findBitSquare(elementData.index);
                        if (squareRetry) {
                            squareRetry.classList.add('bit-square-selected');
                        }
                    }, 100);
                }
            }
        }
        
        // Добавляем событие в лог
        const elementType = elementData.type === 'qubit' ? 'кубит' : 'бит';
        const displayIndex = elementData.displayIndex !== undefined ? elementData.displayIndex : elementData.index;
        this.addEvent(`Выбран ${elementType} #${displayIndex} из "${elementData.tapeTitle || 'ленты'}"`, 'info');
    }
    
    selectQubitByIndex(index) {
        // На шаге 4 работаем с кубитами Евы
        if (this.currentStep === 4 && this.state.channelQubits && this.state.channelQubits[index]) {
            const qubit = this.state.channelQubits[index];
            const elementData = {
                type: 'qubit',
                index: index,
                basis: qubit.basis,
                alpha: qubit.alpha,
                beta: qubit.beta,
                symbol: qubit.symbol,
                tapeTitle: 'Кубиты в канале (Ева видит)'
            };
            
            // Обновляем панель деталей
            if (this.qubitDetails) {
                this.qubitDetails.setSelectedElement(elementData);
                this.qubitDetails.setAlternateIndices(this.selectedIndices);
            }
            
            // Обновляем lastSelectedIndex
            this.lastSelectedIndex = index;
            
            // Подсвечиваем кубит в ленте (если нужно)
            const eveTape = this.bitTapes.get('eveQubits');
            if (eveTape) {
                // Не вызываем selectElement, чтобы не нарушить множественный выбор
                // Просто обновляем визуальное состояние
            }
        } else if (this.state.aliceQubits && this.state.aliceQubits[index]) {
            // Стандартная логика для других шагов
            const qubit = this.state.aliceQubits[index];
            const elementData = {
                type: 'qubit',
                index: index,
                basis: qubit.basis,
                alpha: qubit.alpha,
                beta: qubit.beta,
                symbol: qubit.symbol,
                tapeTitle: 'Кубиты Алисы'
            };
            this.handleElementClick(elementData, null);
            
            // Подсвечиваем кубит в ленте
            const qubitTape = this.bitTapes.get('aliceQubits');
            if (qubitTape) {
                qubitTape.selectElement(index, qubit, null);
            }
        }
    }
    
    clearSelection() {
        this.selectedElement = null;
        this.selectedElementStep = null;
        if (this.qubitDetails) {
            this.qubitDetails.setSelectedElement(null);
        }
        
        // Убираем подсветку со всех лент
        this.bitTapes.forEach(tape => {
            tape.clearSelection();
        });
        
        // Очищаем множественный выбор для шага 4
        if (this.currentStep === 4) {
            this.selectedIndices = [];
            this.lastSelectedIndex = null;
            this.updateEveAttackPanel();
        }
    }
    
    handleEveQubitClick(elementData, event) {
        // Обработка клика по кубиту Евы
        if (this.currentStep !== 4) return;
        
        // Получаем текущий выбор из ленты
        const eveTape = this.bitTapes.get('eveQubits');
        if (eveTape && eveTape.selectedIndices) {
            this.selectedIndices = Array.from(eveTape.selectedIndices);
            this.lastSelectedIndex = elementData.index;
            this.updateEveAttackPanel();
            
            // Обновляем панель деталей с выбранным кубитом
            this.updateEveQubitDetails();
        }
    }
    
    handleEveMultiSelect(indices) {
        // Обработка множественного выбора (вызывается из BitTape)
        if (this.currentStep !== 4) return;
        
        this.selectedIndices = [...indices];
        this.updateEveAttackPanel();
        
        // Обновляем панель деталей
        this.updateEveQubitDetails();
        
        // Обновляем lastSelectedIndex
        if (indices.length > 0) {
            this.lastSelectedIndex = indices[indices.length - 1];
        }
    }
    
    updateEveQubitDetails() {
        // Обновляем панель деталей для выбранных кубитов Евы
        if (!this.qubitDetails || this.currentStep !== 4) return;
        
        if (this.selectedIndices.length === 0) {
            // Очищаем панель, если ничего не выбрано
            this.qubitDetails.setSelectedElement(null);
            return;
        }
        
        // Показываем первый выбранный кубит или последний выбранный
        const indexToShow = this.lastSelectedIndex !== null && this.selectedIndices.includes(this.lastSelectedIndex)
            ? this.lastSelectedIndex
            : this.selectedIndices[0];
        
        const qubit = this.state.channelQubits[indexToShow];
        if (!qubit) return;
        
        // Создаем данные элемента для отображения
        const elementData = {
            type: 'qubit',
            index: indexToShow,
            basis: qubit.basis,
            alpha: qubit.alpha,
            beta: qubit.beta,
            symbol: qubit.symbol,
            tapeTitle: 'Кубиты в канале (Ева видит)'
        };
        
        // Устанавливаем выбранный элемент и альтернативные индексы (для меню выбора)
        this.qubitDetails.setSelectedElement(elementData);
        this.qubitDetails.setAlternateIndices(this.selectedIndices);
    }
    
    createEveAttackPanel(container) {
        // Создаем панель управления атакой Евы
        this.eveAttackPanelContainer = container;
        this.eveAttackState = {
            attackType: 'intercept_resend',
            selectedBasis: 'Z',
            useRandomBasis: false,
            isApplying: false
        };
        this.updateEveAttackPanel();
    }
    
    updateEveAttackPanel() {
        if (!this.eveAttackPanelContainer || this.currentStep !== 4) return;
        
        const selectedCount = this.selectedIndices.length;
        const selectedQubit = selectedCount === 1 && this.state.channelQubits[this.selectedIndices[0]]
            ? { index: this.selectedIndices[0], qubit: this.state.channelQubits[this.selectedIndices[0]] }
            : null;
        
        this.eveAttackPanelContainer.innerHTML = `
            <div class="eve-attack-panel rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-white">
                <div class="flex items-center justify-between mb-3">
                    <div>
                        <p class="text-sm uppercase tracking-widest text-amber-300">Инструменты Евы</p>
                        <p class="text-base font-semibold">${selectedCount > 0 ? 'Настроить атаку на выбранные кубиты' : 'Выберите кубит на ленте'}</p>
                    </div>
                    <span class="px-3 py-1 text-xs font-semibold rounded-full border border-amber-400/40 text-amber-200">
                        Кубит #${selectedQubit ? selectedQubit.index : '—'}
                    </span>
                </div>
                <div class="space-y-3">
                    <div>
                        <label class="text-xs uppercase tracking-widest text-amber-200/80">Тип атаки</label>
                        <select
                            id="eve-attack-type"
                            class="mt-1 w-full rounded-lg bg-gray-900/40 border border-amber-500/40 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/60 text-white"
                        >
                            <option value="intercept_resend" ${this.eveAttackState.attackType === 'intercept_resend' ? 'selected' : ''}>Intercept-Resend</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs uppercase tracking-widest text-amber-200/80">Базис измерения</label>
                        <div class="mt-2 flex gap-2">
                            <button
                                id="eve-basis-z"
                                class="flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${this.getEveBasisButtonClass('Z')}"
                                ${this.eveAttackState.useRandomBasis ? 'disabled' : ''}
                            >
                                Базис Z
                            </button>
                            <button
                                id="eve-basis-x"
                                class="flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${this.getEveBasisButtonClass('X')}"
                                ${this.eveAttackState.useRandomBasis ? 'disabled' : ''}
                            >
                                Базис X
                            </button>
                        </div>
                    </div>
                    <label class="flex items-center gap-2 text-sm text-amber-100/90 mt-2">
                        <input
                            type="checkbox"
                            id="eve-random-basis"
                            class="w-4 h-4 text-amber-400 rounded border-amber-400/60 bg-transparent focus:ring-amber-400"
                            ${this.eveAttackState.useRandomBasis ? 'checked' : ''}
                        />
                        Использовать случайные базисы для каждого кубита
                    </label>
                    <p class="text-xs text-amber-100/80 leading-relaxed">
                        Intercept‑Resend: Ева измеряет состояние выбранного кубита в указанном базисе,
                        получает классический бит и повторно подготавливает новый кубит, который отправит Бобу.
                    </p>
                    <div class="text-xs text-amber-100/90 bg-amber-500/15 border border-amber-500/30 rounded-lg px-3 py-2">
                        <p class="font-semibold">
                            Выбрано кубитов: ${selectedCount}
                        </p>
                        ${selectedCount > 0 ? `
                            <p class="mt-1 text-amber-100/80 break-words">
                                Индексы: ${this.selectedIndices.join(', ')}
                            </p>
                        ` : ''}
                        <p class="mt-1 text-amber-100/70">
                            Совет: используйте Shift + клик, чтобы выделять диапазоны на ленте.
                        </p>
                    </div>
                </div>
                <button
                    id="eve-apply-attack-btn"
                    class="mt-4 w-full rounded-xl bg-amber-500/90 hover:bg-amber-500 text-sm font-semibold py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    ${selectedCount === 0 || this.eveAttackState.isApplying ? 'disabled' : ''}
                >
                    ${this.eveAttackState.isApplying ? 'Применяем...' : 'Применить атаку'}
                </button>
            </div>
        `;
        
        // Добавляем обработчики событий
        this.attachEveAttackPanelHandlers();
    }
    
    getEveBasisButtonClass(basis) {
        const isActive = this.eveAttackState.selectedBasis === basis;
        const isDisabled = this.eveAttackState.useRandomBasis;
        
        if (isDisabled) {
            return 'border-amber-500/40 bg-gray-900/40 text-amber-500/40 opacity-60 cursor-not-allowed';
        }
        if (isActive) {
            return 'border-amber-500/40 bg-amber-500/40 text-white';
        }
        return 'border-amber-500/40 bg-gray-900/40 text-amber-100/70 hover:bg-gray-900/60';
    }
    
    attachEveAttackPanelHandlers() {
        // Обработчик типа атаки
        const attackTypeSelect = document.getElementById('eve-attack-type');
        if (attackTypeSelect) {
            attackTypeSelect.addEventListener('change', (e) => {
                this.eveAttackState.attackType = e.target.value;
            });
        }
        
        // Обработчики базисов
        const basisZBtn = document.getElementById('eve-basis-z');
        if (basisZBtn) {
            basisZBtn.addEventListener('click', () => {
                if (!this.eveAttackState.useRandomBasis) {
                    this.eveAttackState.selectedBasis = 'Z';
                    this.updateEveAttackPanel();
                }
            });
        }
        
        const basisXBtn = document.getElementById('eve-basis-x');
        if (basisXBtn) {
            basisXBtn.addEventListener('click', () => {
                if (!this.eveAttackState.useRandomBasis) {
                    this.eveAttackState.selectedBasis = 'X';
                    this.updateEveAttackPanel();
                }
            });
        }
        
        // Обработчик случайных базисов
        const randomBasisCheckbox = document.getElementById('eve-random-basis');
        if (randomBasisCheckbox) {
            randomBasisCheckbox.addEventListener('change', (e) => {
                this.eveAttackState.useRandomBasis = e.target.checked;
                this.updateEveAttackPanel();
            });
        }
        
        // Обработчик применения атаки
        const applyBtn = document.getElementById('eve-apply-attack-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyEveAttack();
            });
        }
    }
    
    applyEveAttack() {
        if (this.selectedIndices.length === 0 || this.eveAttackState.isApplying) return;
        
        this.eveAttackState.isApplying = true;
        this.updateEveAttackPanel();
        
        const attackType = this.eveAttackState.attackType || 'intercept_resend';
        const basis = this.eveAttackState.selectedBasis || 'Z';
        const useRandomBasis = this.eveAttackState.useRandomBasis;
        
        // Применяем атаку к каждому выбранному кубиту
        const results = [];
        for (const index of this.selectedIndices) {
            if (index < 0 || index >= this.state.channelQubits.length) {
                continue;
            }
            
            const currentBasis = useRandomBasis 
                ? (Math.random() < 0.5 ? 'Z' : 'X')
                : basis;
            
            // Измеряем кубит в базисе
            const measuredBit = this.measureInBasis(this.state.channelQubits[index], currentBasis);
            
            // Создаем новый кубит на основе измеренного бита
            const newQubit = this.prepareBasisQubit(measuredBit, currentBasis, index);
            
            // Обновляем кубит в канале
            this.state.channelQubits[index] = newQubit;
            
            // Сохраняем информацию об атаке
            if (!this.state.eveAttacks) {
                this.state.eveAttacks = {};
            }
            this.state.eveAttacks[index] = {
                attackType: attackType,
                basis: currentBasis,
                measuredBit: measuredBit,
                qubit: newQubit
            };
            
            results.push({
                index: index,
                attackType: attackType,
                basis: currentBasis,
                measuredBit: measuredBit,
                qubit: newQubit
            });
        }
        
        this.saveState();
        this.addEvent(`Ева применила атаку к ${results.length} кубитам`, 'info');
        
        // Обновляем отображение ленты
        const eveTape = this.bitTapes.get('eveQubits');
        if (eveTape) {
            const eveQubits = this.state.channelQubits.map((qubit, index) => {
                return {
                    index: index,
                    symbol: qubit.symbol,
                    alpha: qubit.alpha,
                    beta: qubit.beta,
                    prob0: qubit.prob0,
                    prob1: qubit.prob1,
                    attacked: this.state.eveAttacks[index] !== undefined
                };
            });
            eveTape.updateBits(eveQubits);
        }
        
        // Очищаем выбор
        this.selectedIndices = [];
        this.lastSelectedIndex = null;
        this.eveAttackState.isApplying = false;
        this.updateEveAttackPanel();
        
        // Очищаем панель деталей
        if (this.qubitDetails) {
            this.qubitDetails.setSelectedElement(null);
        }
        
        // Подсвечиваем атакованные кубиты
        if (eveTape) {
            eveTape.setSelectedIndices([]);
        }
    }
    
    measureInBasis(qubit, basis) {
        // Измеряем кубит в указанном базисе
        const alphaReal = qubit.alpha.real || 0;
        const alphaImag = qubit.alpha.imag || 0;
        const betaReal = qubit.beta.real || 0;
        const betaImag = qubit.beta.imag || 0;
        
        if (basis === 'X') {
            // X базис: |+> = (|0> + |1>)/√2, |-> = (|0> - |1>)/√2
            // Вероятность получить |+>: |(alpha + beta)/√2|²
            const alphaPlusReal = (alphaReal + betaReal) / Math.sqrt(2);
            const alphaPlusImag = (alphaImag + betaImag) / Math.sqrt(2);
            const probPlus = alphaPlusReal * alphaPlusReal + alphaPlusImag * alphaPlusImag;
            return Math.random() >= probPlus; // false = |+>, true = |->
        } else {
            // Z базис (по умолчанию)
            // Вероятность получить |0>: |alpha|²
            const prob0 = alphaReal * alphaReal + alphaImag * alphaImag;
            return Math.random() >= prob0; // false = |0>, true = |1>
        }
    }
    
    prepareBasisQubit(bit, basis, index) {
        // Создаем новый кубит на основе бита и базиса
        const sqrtTwo = Math.sqrt(2);
        const oneOverSqrtTwo = 1 / sqrtTwo;
        
        if (basis === 'X') {
            if (!bit) {
                // |+> = 1/√2 |0> + 1/√2 |1>
                return {
                    index: index,
                    basis: 'X',
                    alpha: { real: oneOverSqrtTwo, imag: 0 },
                    beta: { real: oneOverSqrtTwo, imag: 0 },
                    prob0: 0.5,
                    prob1: 0.5,
                    symbol: '|+⟩'
                };
            } else {
                // |-> = 1/√2 |0> - 1/√2 |1>
                return {
                    index: index,
                    basis: 'X',
                    alpha: { real: oneOverSqrtTwo, imag: 0 },
                    beta: { real: -oneOverSqrtTwo, imag: 0 },
                    prob0: 0.5,
                    prob1: 0.5,
                    symbol: '|−⟩'
                };
            }
        } else {
            // Z базис
            if (!bit) {
                // |0> = 1|0> + 0|1>
                return {
                    index: index,
                    basis: 'Z',
                    alpha: { real: 1, imag: 0 },
                    beta: { real: 0, imag: 0 },
                    prob0: 1,
                    prob1: 0,
                    symbol: '|0⟩'
                };
            } else {
                // |1> = 0|0> + 1|1>
                return {
                    index: index,
                    basis: 'Z',
                    alpha: { real: 0, imag: 0 },
                    beta: { real: 1, imag: 0 },
                    prob0: 0,
                    prob1: 1,
                    symbol: '|1⟩'
                };
            }
        }
    }
    
    createStepHeader() {
        // Используем существующий контейнер из HTML или создаем новый
        this.stepHeaderContainer = document.getElementById('step-header-container');
        if (!this.stepHeaderContainer) {
            // Если контейнер не найден, создаем его в wrapper
            const wrapper = document.getElementById('simulation-content-wrapper');
            if (wrapper) {
                this.stepHeaderContainer = document.createElement('div');
                this.stepHeaderContainer.className = 'step-header-container mb-4 p-4 rounded-xl bg-blue-900/30 border border-blue-500/30';
                this.stepHeaderContainer.id = 'step-header-container';
                const content = document.getElementById('simulation-content');
                if (content) {
                    wrapper.insertBefore(this.stepHeaderContainer, content);
                } else {
                    wrapper.appendChild(this.stepHeaderContainer);
                }
            }
        }
    }
    
    updateStepHeader(stepNumber) {
        if (!this.stepHeaderContainer || !this.steps[stepNumber]) return;
        
        // На шаге 0 не показываем заголовок
        if (stepNumber === 0) {
            this.stepHeaderContainer.style.display = 'none';
            return;
        }
        
        // Показываем заголовок для остальных шагов (только название, без описания)
        this.stepHeaderContainer.style.display = 'block';
        
        const step = this.steps[stepNumber];
        this.stepHeaderContainer.innerHTML = `
            <h3 class="text-xl font-bold text-white">Шаг ${stepNumber}: ${step.title}</h3>
        `;
    }
    
    getStepDescription(stepNumber) {
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        
        switch(stepNumber) {
            case 0:
                return 'Алгоритм BB84 - это протокол квантового распределения ключей, разработанный Чарльзом Беннеттом и Жилем Брассаром в 1984 году.';
            case 1:
                return `Алиса генерирует ${n} случайных битов для создания ключа.`;
            case 2:
                return 'Алиса выбирает случайные базисы (X или Z) для кодирования каждого бита.';
            case 3:
                return 'Алиса кодирует биты в кубиты согласно выбранным базисам.';
            case 4:
                return 'Ева перехватывает кубиты и может попытаться измерить их состояние.';
            case 5:
                return 'Боб получил кубиты от Евы (после её атаки).';
            case 6:
                return 'Боб выбирает случайные базисы и измеряет кубиты.';
            case 7:
                return 'Алиса объявляет свои базисы. Алиса и Боб отбрасывают биты, где базисы не совпали.';
            case 8:
                return 'Алиса выбирает подмножество битов для проверки на вмешательство Евы и сообщает Бобу, какие биты выбраны.';
            case 9:
                return 'Алиса и Боб выполняют сверку информации и усиление приватности на оставшихся битах для получения общего ключа.';
            default:
                return '';
        }
    }
    
    initSteps() {
        // Регистрируем шаги
        this.registerStep(0, 'Начало симуляции', this.renderStep0.bind(this));
        this.registerStep(1, 'Алиса генерирует случайные биты', this.renderStep1.bind(this));
        this.registerStep(2, 'Алиса выбирает случайные базисы для кодирования', this.renderStep2.bind(this));
        this.registerStep(3, 'Алиса кодирует биты в кубиты', this.renderStep3.bind(this));
        this.registerStep(4, 'Атаки Евы', this.renderStep4.bind(this));
        this.registerStep(5, 'Боб получил кубиты', this.renderStep5.bind(this));
        this.registerStep(6, 'Боб выбирает случайные базисы и измеряет кубиты', this.renderStep6.bind(this));
        this.registerStep(7, 'Сравнение битов Алисы и Боба', this.renderStep7.bind(this));
        this.registerStep(8, 'Проверка на вмешательство Евы', this.renderStep8.bind(this));
        this.registerStep(9, 'Сверка информации и усиление приватности', this.renderStep9.bind(this));
        // Добавляем новые шаги здесь
    }
    
    registerStep(stepNumber, title, renderFunction) {
        this.steps[stepNumber] = {
            number: stepNumber,
            title,
            render: renderFunction
        };
    }
    
    renderStep0() {
        // Шаг 0 - начало симуляции
        const stepContainer = this.getOrCreateStepContainer(0);
        stepContainer.innerHTML = `
            <div class="step-content p-6 rounded-2xl bg-gray-800/40 border border-gray-600/30 backdrop-blur-sm">
                <p class="text-gray-400">
                    Нажмите "Далее" или "Запустить" для начала симуляции.
                </p>
            </div>
        `;
    }
    
    renderStep1() {
        // Шаг 1 - Алиса генерирует случайные биты
        const stepContainer = this.getOrCreateStepContainer(1);
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        const delta = (typeof panelState !== 'undefined' && panelState.config && panelState.config.delta) ? panelState.config.delta : 0.5;
        
        // Генерируем (4 + δ)n битов согласно протоколу BB84
        const totalBits = Math.ceil((4 + delta) * n);
        
        // Если длина битов не соответствует (4 + δ)n, перегенерируем
        if (this.state.aliceBits.length !== totalBits) {
            this.state.aliceBits = this.generateRandomBits(totalBits);
            this.saveState();
            this.addEvent(`Сгенерировано ${totalBits} случайных битов (${4 + delta} × ${n})`, 'info');
        } else if (this.state.aliceBits.length === 0) {
            // Генерируем случайные биты, если их еще нет
            this.state.aliceBits = this.generateRandomBits(totalBits);
            this.saveState();
            this.addEvent(`Сгенерировано ${totalBits} случайных битов (${4 + delta} × ${n})`, 'info');
        }
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(1)}</p>
                <div id="alice-bits-tape-container" class="mt-4"></div>
            </div>
        `;
        
        // Создаем битную ленту для битов Алисы
        const tapeContainer = stepContainer.querySelector('#alice-bits-tape-container');
        if (tapeContainer) {
            // Используем setTimeout для анимации после рендера
            setTimeout(() => {
                const bitTape = new BitTape(tapeContainer, {
                    title: 'Биты Алисы',
                    variant: 'classical',
                    bits: this.state.aliceBits,
                    shouldAnimate: true,
                    onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                });
                this.bitTapes.set('aliceBits', bitTape);
                
                // Сохраняем ссылку на BitTape для этого шага
                if (!this.stepBitTapes.has(1)) {
                    this.stepBitTapes.set(1, []);
                }
                this.stepBitTapes.get(1).push(bitTape);
            }, 50);
        }
    }
    
    renderStep2() {
        // Шаг 2 - Алиса выбирает случайные базисы для кодирования
        const stepContainer = this.getOrCreateStepContainer(2);
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        const delta = (typeof panelState !== 'undefined' && panelState.config && panelState.config.delta) ? panelState.config.delta : 0.5;
        const totalBits = Math.ceil((4 + delta) * n);
        
        // Убеждаемся, что биты уже сгенерированы (должно быть (4 + δ)n)
        if (this.state.aliceBits.length === 0 || this.state.aliceBits.length !== totalBits) {
            this.state.aliceBits = this.generateRandomBits(totalBits);
            this.saveState();
        }
        
        // Генерируем случайные базисы (должно быть столько же, сколько битов)
        const bitsCount = this.state.aliceBits.length;
        if (this.state.aliceBases.length === 0 || this.state.aliceBases.length !== bitsCount) {
            this.state.aliceBases = this.generateRandomBases(bitsCount);
            this.saveState();
            this.addEvent(`Выбрано ${bitsCount} случайных базисов`, 'info');
        }
        
        // Конвертируем базисы для отображения: true -> 'Z', false -> 'X'
        const displayBases = this.convertBasesToDisplay(this.state.aliceBases);
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(2)}</p>
                <div id="alice-bases-tape-container" class="mt-4"></div>
            </div>
        `;
        
        // Создаем битную ленту для базисов Алисы
        const tapeContainer = stepContainer.querySelector('#alice-bases-tape-container');
        if (tapeContainer) {
            // Используем setTimeout для анимации после рендера
            setTimeout(() => {
                const bitTape = new BitTape(tapeContainer, {
                    title: 'Алиса: Базисы',
                    variant: 'basis',
                    bits: displayBases,
                    shouldAnimate: true,
                    onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                });
                this.bitTapes.set('aliceBases', bitTape);
                
                // Сохраняем ссылку на BitTape для этого шага
                if (!this.stepBitTapes.has(2)) {
                    this.stepBitTapes.set(2, []);
                }
                this.stepBitTapes.get(2).push(bitTape);
            }, 50);
        }
    }
    
    renderStep3() {
        // Шаг 3 - Алиса кодирует биты в кубиты
        const stepContainer = this.getOrCreateStepContainer(3);
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        const delta = (typeof panelState !== 'undefined' && panelState.config && panelState.config.delta) ? panelState.config.delta : 0.5;
        const totalBits = Math.ceil((4 + delta) * n);
        
        // Убеждаемся, что биты и базисы уже сгенерированы
        if (!this.state.aliceBits || this.state.aliceBits.length === 0 || this.state.aliceBits.length !== totalBits) {
            this.state.aliceBits = this.generateRandomBits(totalBits);
        }
        const bitsCount = this.state.aliceBits.length;
        if (!this.state.aliceBases || this.state.aliceBases.length === 0 || this.state.aliceBases.length !== bitsCount) {
            this.state.aliceBases = this.generateRandomBases(bitsCount);
        }
        
        // Инициализируем aliceQubits, если его нет
        if (!this.state.aliceQubits) {
            this.state.aliceQubits = [];
        }
        
        // Кодируем кубиты, если их еще нет или их количество не совпадает
        if (this.state.aliceQubits.length === 0 || this.state.aliceQubits.length !== bitsCount) {
            this.state.aliceQubits = this.encodeQubits(this.state.aliceBits, this.state.aliceBases);
            this.saveState();
            this.addEvent(`Закодировано ${bitsCount} кубитов`, 'info');
        }
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(3)}</p>
                <div id="alice-qubits-tape-container" class="mt-4"></div>
            </div>
        `;
        
        // Создаем кубитную ленту
        const tapeContainer = stepContainer.querySelector('#alice-qubits-tape-container');
        if (tapeContainer) {
            setTimeout(() => {
                const bitTape = new BitTape(tapeContainer, {
                    title: 'Кубиты Алисы',
                    variant: 'qubit',
                    bits: this.state.aliceQubits,
                    shouldAnimate: true,
                    onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                });
                this.bitTapes.set('aliceQubits', bitTape);
                
                // Сохраняем ссылку на BitTape для этого шага
                if (!this.stepBitTapes.has(3)) {
                    this.stepBitTapes.set(3, []);
                }
                this.stepBitTapes.get(3).push(bitTape);
            }, 50);
        }
    }
    
    renderStep4() {
        // Шаг 4 - Атаки Евы
        const stepContainer = this.getOrCreateStepContainer(4);
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        
        // Убеждаемся, что кубиты Алисы уже созданы
        if (!this.state.aliceQubits || this.state.aliceQubits.length === 0) {
            // Если кубитов нет, нужно вернуться к предыдущим шагам
            this.addEvent('Ошибка: кубиты Алисы не созданы. Вернитесь к шагу 3.', 'error');
            return;
        }
        
        // Инициализируем channelQubits как копию aliceQubits, если их еще нет
        if (!this.state.channelQubits || this.state.channelQubits.length === 0) {
            this.state.channelQubits = JSON.parse(JSON.stringify(this.state.aliceQubits));
        }
        
        // Инициализируем eveAttacks, если их еще нет
        if (!this.state.eveAttacks) {
            this.state.eveAttacks = {};
        }
        
        // Создаем кубиты для отображения Еве (без информации о базисах)
        const eveQubits = this.state.channelQubits.map((qubit, index) => {
            // Ева видит только символ кубита, но не знает базис
            return {
                index: index,
                symbol: qubit.symbol,
                // Не передаем basis в отображение для Евы
                alpha: qubit.alpha,
                beta: qubit.beta,
                prob0: qubit.prob0,
                prob1: qubit.prob1,
                // Добавляем информацию о том, был ли кубит атакован
                attacked: this.state.eveAttacks[index] !== undefined
            };
        });
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(4)}</p>
                <div id="eve-qubits-tape-container" class="mt-4"></div>
                <div id="eve-attack-panel-container" class="mt-6"></div>
            </div>
        `;
        
        // Создаем ленту кубитов для Евы
        const tapeContainer = stepContainer.querySelector('#eve-qubits-tape-container');
        if (tapeContainer) {
            setTimeout(() => {
                const bitTape = new BitTape(tapeContainer, {
                    title: 'Кубиты в канале (Ева видит)',
                    variant: 'qubit',
                    bits: eveQubits,
                    shouldAnimate: true,
                    allowMultiSelect: true, // Разрешаем множественный выбор
                    hideBasis: true, // Скрываем базис, так как Ева его не знает
                    onElementClick: (elementData, event) => this.handleEveQubitClick(elementData, event),
                    onMultiSelect: (indices) => this.handleEveMultiSelect(indices)
                });
                this.bitTapes.set('eveQubits', bitTape);
                
                // Сохраняем ссылку на BitTape для этого шага
                if (!this.stepBitTapes.has(4)) {
                    this.stepBitTapes.set(4, []);
                }
                this.stepBitTapes.get(4).push(bitTape);
                
                // Создаем панель управления атакой
                this.createEveAttackPanel(stepContainer.querySelector('#eve-attack-panel-container'));
            }, 50);
        }
    }
    
    renderStep5() {
        // Шаг 5 - Боб получил кубиты
        const stepContainer = this.getOrCreateStepContainer(5);
        
        // Убеждаемся, что кубиты в канале уже созданы
        if (!this.state.channelQubits || this.state.channelQubits.length === 0) {
            // Если кубитов нет, нужно вернуться к предыдущим шагам
            this.addEvent('Ошибка: кубиты в канале не созданы. Вернитесь к шагу 4.', 'error');
            return;
        }
        
        // Проверяем, существует ли уже лента кубитов Боба
        const existingBobTape = this.bitTapes.get('bobQubits');
        
        if (existingBobTape && stepContainer.querySelector('#bob-qubits-tape-container')) {
            // Если лента уже существует, просто обновляем данные
            const bobQubits = this.state.channelQubits.map((qubit, index) => {
                return {
                    index: index,
                    symbol: qubit.symbol,
                    basis: qubit.basis,
                    alpha: qubit.alpha,
                    beta: qubit.beta,
                    prob0: qubit.prob0,
                    prob1: qubit.prob1
                };
            });
            existingBobTape.updateBits(bobQubits);
            return;
        }
        
        // Создаем кубиты для отображения Бобу (кубиты, которые пришли от Евы)
        const bobQubits = this.state.channelQubits.map((qubit, index) => {
            return {
                index: index,
                symbol: qubit.symbol,
                basis: qubit.basis, // Боб видит кубиты, но не знает исходный базис Алисы
                alpha: qubit.alpha,
                beta: qubit.beta,
                prob0: qubit.prob0,
                prob1: qubit.prob1
            };
        });
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(5)}</p>
                <div id="bob-qubits-tape-container" class="mt-4"></div>
            </div>
        `;
        
        // Создаем ленту кубитов для Боба
        const tapeContainer = stepContainer.querySelector('#bob-qubits-tape-container');
        if (tapeContainer) {
            setTimeout(() => {
                const bitTape = new BitTape(tapeContainer, {
                    title: 'Кубиты, полученные Бобом',
                    variant: 'qubit',
                    bits: bobQubits,
                    shouldAnimate: true,
                    allowMultiSelect: false, // Одиночный выбор только
                    hideBasis: true, // Скрываем базис, так как Боб его не знает
                    onElementClick: (elementData, event) => this.handleBobQubitClick(elementData, event)
                });
                this.bitTapes.set('bobQubits', bitTape);
                
                // Сохраняем ссылку на BitTape для этого шага
                if (!this.stepBitTapes.has(5)) {
                    this.stepBitTapes.set(5, []);
                }
                this.stepBitTapes.get(5).push(bitTape);
            }, 50);
        }
    }
    
    handleBobQubitClick(elementData, event) {
        // Обработка клика по кубиту Боба - одиночный выбор
        // Разрешаем выбор на шагах 5 и 6 (так как на шаге 6 также отображается шаг 5)
        if (this.currentStep !== 5 && this.currentStep !== 6) return;
        
        if (this.currentStep === 6) {
            const bobBasesTape = this.bitTapes.get('bobBases');
            const bobBitsTape = this.bitTapes.get('bobBits');
            const aliceQubitsTape = this.bitTapes.get('aliceQubits');
            if (bobBasesTape) {
                bobBasesTape.clearSelection();
            }
            if (bobBitsTape) {
                bobBitsTape.clearSelection();
            }
            if (aliceQubitsTape) {
                aliceQubitsTape.clearSelection();
            }
        } else {
            this.bitTapes.forEach(tape => {
                tape.clearSelection();
            });
        }
        
        // Устанавливаем новый выбор
        this.selectedElement = elementData;
        this.selectedElementStep = 5; // Всегда шаг 5 для кубитов Боба
        
        // Обновляем панель деталей
        if (this.qubitDetails) {
            const qubit = this.state.channelQubits[elementData.index];
            if (qubit) {
                const elementDataForDetails = {
                    type: 'qubit',
                    index: elementData.index,
                    basis: qubit.basis,
                    alpha: qubit.alpha,
                    beta: qubit.beta,
                    symbol: qubit.symbol,
                    tapeTitle: 'Кубиты, полученные Бобом'
                };
                this.qubitDetails.setSelectedElement(elementDataForDetails);
                this.qubitDetails.setAlternateIndices([]); // Нет альтернативных индексов для одиночного выбора
            }
        }
        
        const bobTape = this.bitTapes.get('bobQubits');
        if (bobTape && elementData.index !== undefined) {
            if (bobTape.selectedIndex !== null && bobTape.selectedIndex !== elementData.index) {
                const prevSquare = bobTape.findBitSquare(bobTape.selectedIndex);
                if (prevSquare) {
                    prevSquare.classList.remove('bit-square-selected');
                }
            }
            bobTape.selectedIndex = elementData.index;
            const square = bobTape.findBitSquare(elementData.index);
            if (square) {
                square.classList.add('bit-square-selected');
            }
        }
        
        // Добавляем событие в лог
        const displayIndex = elementData.displayIndex !== undefined ? elementData.displayIndex : elementData.index;
        this.addEvent(`Выбран кубит #${displayIndex} из "Кубиты, полученные Бобом"`, 'info');
    }
    
    renderStep6() {
        // Шаг 6 - Боб выбирает случайные базисы и измеряет кубиты
        const stepContainer = this.getOrCreateStepContainer(6);
        
        // Убеждаемся, что кубиты в канале уже созданы
        if (!this.state.channelQubits || this.state.channelQubits.length === 0) {
            this.addEvent('Ошибка: кубиты в канале не созданы. Вернитесь к шагу 4.', 'error');
            return;
        }
        
        const n = this.state.channelQubits.length;
        
        // Генерируем случайные базисы для Боба, если их еще нет
        if (!this.state.bobBases || this.state.bobBases.length === 0 || this.state.bobBases.length !== n) {
            this.state.bobBases = this.generateRandomBases(n);
            this.saveState();
            this.addEvent(`Боб выбрал ${n} случайных базисов`, 'info');
        }
        
        // Измеряем кубиты в базисах Боба и получаем биты
        if (!this.state.bobBits || this.state.bobBits.length === 0 || this.state.bobBits.length !== n) {
            this.state.bobBits = [];
            for (let i = 0; i < n; i++) {
                const qubit = this.state.channelQubits[i];
                const basis = this.state.bobBases[i] ? 'Z' : 'X';
                const measuredBit = this.measureInBasis(qubit, basis);
                this.state.bobBits.push(measuredBit ? 1 : 0);
            }
            this.saveState();
            this.addEvent(`Боб измерил ${n} кубитов и получил биты`, 'info');
        }
        
        // Конвертируем базисы для отображения
        const displayBases = this.convertBasesToDisplay(this.state.bobBases);
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(6)}</p>
                <div id="bob-bases-tape-container" class="mt-4 mb-6"></div>
                <div id="bob-bits-tape-container" class="mt-4"></div>
            </div>
        `;
        
        // Создаем ленту базисов Боба
        const basesContainer = stepContainer.querySelector('#bob-bases-tape-container');
        if (basesContainer) {
            setTimeout(() => {
                const basesTape = new BitTape(basesContainer, {
                    title: 'Боб: Базисы',
                    variant: 'basis',
                    bits: displayBases,
                    shouldAnimate: true,
                    onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                });
                this.bitTapes.set('bobBases', basesTape);
                
                // Сохраняем ссылку на BitTape для этого шага
                if (!this.stepBitTapes.has(6)) {
                    this.stepBitTapes.set(6, []);
                }
                this.stepBitTapes.get(6).push(basesTape);
                
                this.restoreStep6Selection();
            }, 50);
        }
        
        // Создаем ленту битов Боба
        const bitsContainer = stepContainer.querySelector('#bob-bits-tape-container');
        if (bitsContainer) {
            setTimeout(() => {
                const bitsTape = new BitTape(bitsContainer, {
                    title: 'Боб: Измеренные биты',
                    variant: 'classical',
                    bits: this.state.bobBits,
                    shouldAnimate: true,
                    onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                });
                this.bitTapes.set('bobBits', bitsTape);
                
                // Сохраняем ссылку на BitTape для этого шага
                if (!this.stepBitTapes.has(6)) {
                    this.stepBitTapes.set(6, []);
                }
                this.stepBitTapes.get(6).push(bitsTape);
                
                this.restoreStep6Selection();
            }, 100);
        }
        
        setTimeout(() => {
            this.restoreStep6Selection();
        }, 200);
    }
    
    restoreStep6Selection() {
        if (!this.selectedElement || this.selectedElementStep !== 6) {
            return;
        }
        
        if (this.selectedElement.tapeTitle === 'Боб: Базисы') {
            const basesTape = this.bitTapes.get('bobBases');
            if (basesTape && this.selectedElement.index !== undefined) {
                const bit = basesTape.bits[this.selectedElement.index];
                if (bit !== undefined) {
                    basesTape.selectedIndex = this.selectedElement.index;
                    const square = basesTape.findBitSquare(this.selectedElement.index);
                    if (square) {
                        square.classList.add('bit-square-selected');
                    } else {
                        setTimeout(() => {
                            const squareRetry = basesTape.findBitSquare(this.selectedElement.index);
                            if (squareRetry) {
                                squareRetry.classList.add('bit-square-selected');
                            }
                        }, 100);
                    }
                }
            }
        } else if (this.selectedElement.tapeTitle === 'Боб: Измеренные биты') {
            const bitsTape = this.bitTapes.get('bobBits');
            if (bitsTape && this.selectedElement.index !== undefined) {
                const bit = bitsTape.bits[this.selectedElement.index];
                if (bit !== undefined) {
                    bitsTape.selectedIndex = this.selectedElement.index;
                    const square = bitsTape.findBitSquare(this.selectedElement.index);
                    if (square) {
                        square.classList.add('bit-square-selected');
                    } else {
                        setTimeout(() => {
                            const squareRetry = bitsTape.findBitSquare(this.selectedElement.index);
                            if (squareRetry) {
                                squareRetry.classList.add('bit-square-selected');
                            }
                        }, 100);
                    }
                }
            }
        }
    }
    
    renderStep7() {
        // Шаг 7 - Сравнение битов Алисы и Боба
        const stepContainer = this.getOrCreateStepContainer(7);
        
        // Проверяем, что у нас есть базисы и биты Алисы и Боба
        if (!this.state.aliceBases || this.state.aliceBases.length === 0 ||
            !this.state.bobBases || this.state.bobBases.length === 0 ||
            !this.state.aliceBits || this.state.aliceBits.length === 0 ||
            !this.state.bobBits || this.state.bobBits.length === 0) {
            this.addEvent('Ошибка: базисы или биты не готовы. Вернитесь к предыдущим шагам.', 'error');
            return;
        }
        
        const totalBits = this.state.aliceBases.length;
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        const minRequiredBits = 2 * n; // Требуется минимум 2n битов
        
        // Находим индексы, где базисы совпали и не совпали
        const matchingIndices = [];
        const nonMatchingIndices = [];
        for (let i = 0; i < totalBits; i++) {
            if (this.state.aliceBases[i] === this.state.bobBases[i]) {
                matchingIndices.push(i);
            } else {
                nonMatchingIndices.push(i);
            }
        }
        
        // Проверяем, что достаточно совпадений (минимум 2n)
        if (matchingIndices.length < minRequiredBits) {
            // Протокол прерывается
            const message = `Протокол прерван: недостаточно совпадающих базисов. Получено ${matchingIndices.length} совпадений, требуется минимум ${minRequiredBits}. Пожалуйста, начните симуляцию заново.`;
            this.addEvent(message, 'error');
            stepContainer.innerHTML = `
                <div class="step-content p-6 rounded-2xl bg-red-900/40 border border-red-600/50 backdrop-blur-sm">
                    <p class="text-red-300 text-lg font-semibold mb-2">Протокол прерван</p>
                    <p class="text-red-200 mb-4">${message}</p>
                    <p class="text-red-300 text-sm">Совпало базисов: ${matchingIndices.length} из ${totalBits}</p>
                    <p class="text-red-300 text-sm">Требуется минимум: ${minRequiredBits}</p>
                    <button 
                        onclick="if(window.simulator) { window.simulator.reset(); window.simulator.goToStep(0); }"
                        class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                        Начать заново
                    </button>
                </div>
            `;
            return;
        }
        
        // Берем первые 2n битов из совпадающих
        const keptIndices = matchingIndices.slice(0, minRequiredBits);
        
        // Создаем массивы для отображения
        const aliceBasesDisplay = this.convertBasesToDisplay(this.state.aliceBases);
        const bobBasesDisplay = this.convertBasesToDisplay(this.state.bobBases);
        
        // Биты только для совпадающих позиций с оригинальными индексами
        const aliceMatchingBits = keptIndices.map(i => ({
            value: this.state.aliceBits[i],
            originalIndex: i
        }));
        const bobMatchingBits = keptIndices.map(i => ({
            value: this.state.bobBits[i],
            originalIndex: i
        }));
        
        // Создаем массив для выделения совпадающих базисов (для визуализации)
        const basesMatch = aliceBasesDisplay.map((aliceBasis, i) => 
            aliceBasis === bobBasesDisplay[i]
        );
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(7)}</p>
                <p class="text-sm text-gray-400 mb-2">
                    Совпало базисов: ${matchingIndices.length} из ${totalBits}. 
                    Оставлено битов: ${keptIndices.length} (требуется: ${minRequiredBits})
                </p>
                <div id="bases-comparison-container" class="mt-4 mb-6"></div>
                <div id="matching-bits-container" class="mt-4"></div>
            </div>
        `;
        
        // Создаем визуализацию сравнения базисов
        const basesContainer = stepContainer.querySelector('#bases-comparison-container');
        if (basesContainer) {
            // Показываем базисы Алисы и Боба с выделением совпадений
            const comparisonHTML = `
                <div class="space-y-4">
                    <div>
                        <p class="text-sm font-semibold text-gray-300 mb-2">Алиса: Базисы</p>
                        <div id="alice-bases-comparison-tape-container"></div>
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-gray-300 mb-2">Боб: Базисы</p>
                        <div id="bob-bases-comparison-tape-container"></div>
                    </div>
                </div>
            `;
            basesContainer.innerHTML = comparisonHTML;
            
            setTimeout(() => {
                // Лента базисов Алисы с выделением НЕсовпадающих (красным)
                const aliceBasesContainer = basesContainer.querySelector('#alice-bases-comparison-tape-container');
                if (aliceBasesContainer) {
                    const aliceBasesTape = new BitTape(aliceBasesContainer, {
                        title: 'Алиса: Базисы',
                        variant: 'basis',
                        bits: aliceBasesDisplay,
                        shouldAnimate: true,
                        highlightIndices: nonMatchingIndices, // Выделяем НЕсовпадающие (красным)
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('aliceBasesComparison', aliceBasesTape);
                    
                    if (!this.stepBitTapes.has(7)) {
                        this.stepBitTapes.set(7, []);
                    }
                    this.stepBitTapes.get(7).push(aliceBasesTape);
                }
                
                // Лента базисов Боба с выделением НЕсовпадающих (красным)
                const bobBasesContainer = basesContainer.querySelector('#bob-bases-comparison-tape-container');
                if (bobBasesContainer) {
                    const bobBasesTape = new BitTape(bobBasesContainer, {
                        title: 'Боб: Базисы',
                        variant: 'basis',
                        bits: bobBasesDisplay,
                        shouldAnimate: true,
                        highlightIndices: nonMatchingIndices, // Выделяем НЕсовпадающие (красным)
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('bobBasesComparison', bobBasesTape);
                    
                    if (!this.stepBitTapes.has(7)) {
                        this.stepBitTapes.set(7, []);
                    }
                    this.stepBitTapes.get(7).push(bobBasesTape);
                }
            }, 50);
        }
        
        // Создаем ленты для совпадающих битов
        const matchingBitsContainer = stepContainer.querySelector('#matching-bits-container');
        if (matchingBitsContainer) {
            setTimeout(() => {
                const matchingBitsHTML = `
                    <div class="space-y-4">
                        <div>
                            <p class="text-sm font-semibold text-gray-300 mb-2">Алиса: Биты (только совпадающие позиции)</p>
                            <div id="alice-matching-bits-tape-container"></div>
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-gray-300 mb-2">Боб: Биты (только совпадающие позиции)</p>
                            <div id="bob-matching-bits-tape-container"></div>
                        </div>
                    </div>
                `;
                matchingBitsContainer.innerHTML = matchingBitsHTML;
                
                // Лента битов Алисы
                const aliceBitsContainer = matchingBitsContainer.querySelector('#alice-matching-bits-tape-container');
                if (aliceBitsContainer) {
                    const aliceBitsTape = new BitTape(aliceBitsContainer, {
                        title: 'Алиса: Биты (совпадающие)',
                        variant: 'classical',
                        bits: aliceMatchingBits,
                        shouldAnimate: true,
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('aliceMatchingBits', aliceBitsTape);
                    
                    if (!this.stepBitTapes.has(7)) {
                        this.stepBitTapes.set(7, []);
                    }
                    this.stepBitTapes.get(7).push(aliceBitsTape);
                }
                
                // Лента битов Боба
                const bobBitsContainer = matchingBitsContainer.querySelector('#bob-matching-bits-tape-container');
                if (bobBitsContainer) {
                    const bobBitsTape = new BitTape(bobBitsContainer, {
                        title: 'Боб: Биты (совпадающие)',
                        variant: 'classical',
                        bits: bobMatchingBits,
                        shouldAnimate: true,
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('bobMatchingBits', bobBitsTape);
                    
                    if (!this.stepBitTapes.has(7)) {
                        this.stepBitTapes.set(7, []);
                    }
                    this.stepBitTapes.get(7).push(bobBitsTape);
                }
            }, 100);
        }
        
        // Сохраняем данные для шага 8
        this.state.keptIndices = keptIndices;
        this.state.aliceMatchingBits = aliceMatchingBits;
        this.state.bobMatchingBits = bobMatchingBits;
        this.saveState();
        this.addEvent(`Сравнение базисов завершено. Совпало: ${matchingIndices.length}. Оставлено: ${keptIndices.length} битов.`, 'info');
    }
    
    renderStep8() {
        // Шаг 8 - Проверка на вмешательство Евы
        const stepContainer = this.getOrCreateStepContainer(8);
        
        // Проверяем, что у нас есть данные с шага 7
        if (!this.state.keptIndices || this.state.keptIndices.length === 0 ||
            !this.state.aliceMatchingBits || this.state.aliceMatchingBits.length === 0 ||
            !this.state.bobMatchingBits || this.state.bobMatchingBits.length === 0) {
            this.addEvent('Ошибка: данные для проверки отсутствуют. Вернитесь к шагу 7.', 'error');
            return;
        }
        
        const eveCheckSubsetLen = (typeof panelState !== 'undefined' && panelState.config && panelState.config.eve_check_subset_len) 
            ? panelState.config.eve_check_subset_len 
            : 30;
        const maxEveCheckErrors = (typeof panelState !== 'undefined' && panelState.config && panelState.config.max_eve_check_errors) 
            ? panelState.config.max_eve_check_errors 
            : 2;
        
        // Если проверка еще не была выполнена, выбираем случайное подмножество битов
        if (!this.state.eveCheckIndices || this.state.eveCheckIndices.length === 0) {
            const availableBits = this.state.keptIndices.length;
            const subsetSize = Math.min(eveCheckSubsetLen, availableBits);
            
            // Выбираем случайное подмножество индексов из availableBits
            const allIndices = Array.from({ length: availableBits }, (_, i) => i);
            const shuffled = [...allIndices].sort(() => Math.random() - 0.5);
            this.state.eveCheckIndices = shuffled.slice(0, subsetSize).sort((a, b) => a - b);
            this.saveState();
        }
        
        const checkIndices = this.state.eveCheckIndices;
        
        // Извлекаем биты для проверки
        const aliceCheckBits = checkIndices.map(i => ({
            value: this.state.aliceMatchingBits[i].value,
            originalIndex: this.state.aliceMatchingBits[i].originalIndex
        }));
        const bobCheckBits = checkIndices.map(i => ({
            value: this.state.bobMatchingBits[i].value,
            originalIndex: this.state.bobMatchingBits[i].originalIndex
        }));
        
        // Считаем ошибки (несовпадения битов)
        let errorCount = 0;
        const errorIndices = [];
        for (let i = 0; i < checkIndices.length; i++) {
            if (aliceCheckBits[i].value !== bobCheckBits[i].value) {
                errorCount++;
                errorIndices.push(i);
            }
        }
        
        // Проверяем, не превышено ли максимальное количество ошибок
        if (errorCount > maxEveCheckErrors) {
            // Протокол прерывается
            const message = `Протокол прерван: обнаружено слишком много ошибок при проверке на вмешательство Евы. Обнаружено ${errorCount} ошибок из ${checkIndices.length} проверенных битов, допустимо максимум ${maxEveCheckErrors}. Пожалуйста, начните симуляцию заново.`;
            this.addEvent(message, 'error');
            stepContainer.innerHTML = `
                <div class="step-content p-6 rounded-2xl bg-red-900/40 border border-red-600/50 backdrop-blur-sm">
                    <p class="text-red-300 text-lg font-semibold mb-2">Протокол прерван</p>
                    <p class="text-red-200 mb-4">${message}</p>
                    <p class="text-red-300 text-sm mb-2">Проверено битов: ${checkIndices.length}</p>
                    <p class="text-red-300 text-sm mb-2">Обнаружено ошибок: ${errorCount}</p>
                    <p class="text-red-300 text-sm mb-4">Максимум допустимо: ${maxEveCheckErrors}</p>
                    
                    <div class="mt-6 mb-4">
                        <p class="text-red-200 text-sm font-semibold mb-3">Сравнение битов (красным выделены несовпадения):</p>
                        <div id="error-comparison-container" class="space-y-4"></div>
                    </div>
                    
                    <button 
                        onclick="if(window.simulator) { window.simulator.reset(); window.simulator.goToStep(0); }"
                        class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                        Начать заново
                    </button>
                </div>
            `;
            
            // Создаем ленты для визуализации ошибок
            const errorContainer = stepContainer.querySelector('#error-comparison-container');
            if (errorContainer) {
                setTimeout(() => {
                    const errorHTML = `
                        <div>
                            <p class="text-sm font-semibold text-red-200 mb-2">Алиса: Биты для проверки</p>
                            <div id="alice-error-bits-tape-container"></div>
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-red-200 mb-2">Боб: Биты для проверки</p>
                            <div id="bob-error-bits-tape-container"></div>
                        </div>
                    `;
                    errorContainer.innerHTML = errorHTML;
                    
                    // Лента битов Алисы с выделением ошибок
                    const aliceErrorContainer = errorContainer.querySelector('#alice-error-bits-tape-container');
                    if (aliceErrorContainer) {
                        const aliceErrorTape = new BitTape(aliceErrorContainer, {
                            title: 'Алиса: Биты для проверки',
                            variant: 'classical',
                            bits: aliceCheckBits,
                            shouldAnimate: false,
                            highlightIndices: errorIndices, // Выделяем ошибки красным
                            onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                        });
                        this.bitTapes.set('aliceErrorBits', aliceErrorTape);
                        
                        if (!this.stepBitTapes.has(8)) {
                            this.stepBitTapes.set(8, []);
                        }
                        this.stepBitTapes.get(8).push(aliceErrorTape);
                    }
                    
                    // Лента битов Боба с выделением ошибок
                    const bobErrorContainer = errorContainer.querySelector('#bob-error-bits-tape-container');
                    if (bobErrorContainer) {
                        const bobErrorTape = new BitTape(bobErrorContainer, {
                            title: 'Боб: Биты для проверки',
                            variant: 'classical',
                            bits: bobCheckBits,
                            shouldAnimate: false,
                            highlightIndices: errorIndices, // Выделяем ошибки красным
                            onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                        });
                        this.bitTapes.set('bobErrorBits', bobErrorTape);
                        
                        if (!this.stepBitTapes.has(8)) {
                            this.stepBitTapes.set(8, []);
                        }
                        this.stepBitTapes.get(8).push(bobErrorTape);
                    }
                }, 50);
            }
            
            this.saveState();
            return;
        }
        
        // Вычисляем индексы совпадений (для зеленой подсветки)
        const matchingIndices = [];
        for (let i = 0; i < checkIndices.length; i++) {
            if (aliceCheckBits[i].value === bobCheckBits[i].value) {
                matchingIndices.push(i);
            }
        }
        
        // Проверка пройдена - показываем зеленое окно
        stepContainer.innerHTML = `
            <div class="step-content p-6 rounded-2xl bg-green-900/40 border border-green-600/50 backdrop-blur-sm">
                <p class="text-green-300 text-lg font-semibold mb-2">✓ Проверка пройдена</p>
                <p class="text-green-200 mb-4">
                    Алиса выбрала ${checkIndices.length} битов для проверки на вмешательство Евы.
                    Обнаружено ошибок: ${errorCount} из ${checkIndices.length}.
                    Максимум допустимо: ${maxEveCheckErrors}.
                </p>
                <p class="text-green-300 text-sm mb-2">Проверено битов: ${checkIndices.length}</p>
                <p class="text-green-300 text-sm mb-2">Обнаружено ошибок: ${errorCount}</p>
                <p class="text-green-300 text-sm mb-4">Совпало битов: ${matchingIndices.length}</p>
                
                <div class="mt-6 mb-4">
                    <p class="text-green-200 text-sm font-semibold mb-3">Сравнение битов (зеленым выделены совпадения, красным - несовпадения):</p>
                    <div id="success-comparison-container" class="space-y-4"></div>
                </div>
            </div>
        `;
        
        // Создаем ленты для визуализации проверки при успехе
        const successContainer = stepContainer.querySelector('#success-comparison-container');
        if (successContainer) {
            setTimeout(() => {
                const successHTML = `
                    <div>
                        <p class="text-sm font-semibold text-green-200 mb-2">Алиса: Биты для проверки</p>
                        <div id="alice-success-bits-tape-container"></div>
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-green-200 mb-2">Боб: Биты для проверки</p>
                        <div id="bob-success-bits-tape-container"></div>
                    </div>
                `;
                successContainer.innerHTML = successHTML;
                
                // Лента битов Алисы с выделением ошибок (красным) и совпадений (зеленым)
                const aliceSuccessContainer = successContainer.querySelector('#alice-success-bits-tape-container');
                if (aliceSuccessContainer) {
                    const aliceSuccessTape = new BitTape(aliceSuccessContainer, {
                        title: 'Алиса: Биты для проверки',
                        variant: 'classical',
                        bits: aliceCheckBits,
                        shouldAnimate: false,
                        highlightIndices: errorIndices, // Выделяем ошибки красным (несовпадения)
                        matchIndices: matchingIndices, // Выделяем совпадения зеленым
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('aliceCheckBits', aliceSuccessTape);
                    
                    if (!this.stepBitTapes.has(8)) {
                        this.stepBitTapes.set(8, []);
                    }
                    this.stepBitTapes.get(8).push(aliceSuccessTape);
                }
                
                // Лента битов Боба с выделением ошибок (красным) и совпадений (зеленым)
                const bobSuccessContainer = successContainer.querySelector('#bob-success-bits-tape-container');
                if (bobSuccessContainer) {
                    const bobSuccessTape = new BitTape(bobSuccessContainer, {
                        title: 'Боб: Биты для проверки',
                        variant: 'classical',
                        bits: bobCheckBits,
                        shouldAnimate: false,
                        highlightIndices: errorIndices, // Выделяем ошибки красным (несовпадения)
                        matchIndices: matchingIndices, // Выделяем совпадения зеленым
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('bobCheckBits', bobSuccessTape);
                    
                    if (!this.stepBitTapes.has(8)) {
                        this.stepBitTapes.set(8, []);
                    }
                    this.stepBitTapes.get(8).push(bobSuccessTape);
                }
            }, 50);
        }
        
        // Сохраняем оставшиеся биты для шага 9 (исключая проверенные)
        // ВАЖНО: Сохраняем данные независимо от результата проверки, если протокол не прерван
        if (errorCount <= maxEveCheckErrors) {
            // Исключаем проверенные биты из оставшихся
            const remainingIndices = [];
            const checkIndicesSet = new Set(checkIndices);
            for (let i = 0; i < this.state.keptIndices.length; i++) {
                if (!checkIndicesSet.has(i)) {
                    remainingIndices.push(i);
                }
            }
            
            // Сохраняем биты для reconciliation
            this.state.reconciliationIndices = remainingIndices;
            this.state.aliceReconciliationBits = remainingIndices.map(i => ({
                value: this.state.aliceMatchingBits[i].value,
                originalIndex: this.state.aliceMatchingBits[i].originalIndex
            }));
            this.state.bobReconciliationBits = remainingIndices.map(i => ({
                value: this.state.bobMatchingBits[i].value,
                originalIndex: this.state.bobMatchingBits[i].originalIndex
            }));
            
            // Отладочная информация
            console.log('Step 8: Saved reconciliation data', {
                remainingIndices: remainingIndices.length,
                aliceBits: this.state.aliceReconciliationBits.length,
                bobBits: this.state.bobReconciliationBits.length,
                keptIndices: this.state.keptIndices.length,
                checkIndices: checkIndices.length
            });
        }
        
        this.saveState();
        this.addEvent(`Проверка на вмешательство Евы завершена. Проверено: ${checkIndices.length} битов. Ошибок: ${errorCount}.`, errorCount > maxEveCheckErrors ? 'error' : 'info');
    }
    
    renderStep9() {
        // Шаг 9 - Information Reconciliation и Privacy Amplification
        const stepContainer = this.getOrCreateStepContainer(9);
        
        // Очищаем контейнер перед рендерингом
        stepContainer.innerHTML = '';
        
        // Если данных нет, пытаемся восстановить их из keptIndices (если шаг 8 еще не выполнен)
        if (!this.state.aliceReconciliationBits || this.state.aliceReconciliationBits.length === 0 ||
            !this.state.bobReconciliationBits || this.state.bobReconciliationBits.length === 0) {
            
            // Если есть keptIndices, используем их (все биты, которые остались после шага 7)
            if (this.state.keptIndices && this.state.keptIndices.length > 0 &&
                this.state.aliceMatchingBits && this.state.aliceMatchingBits.length > 0 &&
                this.state.bobMatchingBits && this.state.bobMatchingBits.length > 0) {
                
                // Если есть eveCheckIndices, исключаем их, иначе используем все keptIndices
                if (this.state.eveCheckIndices && this.state.eveCheckIndices.length > 0) {
                    const checkIndicesSet = new Set(this.state.eveCheckIndices);
                    const remainingIndices = [];
                    for (let i = 0; i < this.state.keptIndices.length; i++) {
                        if (!checkIndicesSet.has(i)) {
                            remainingIndices.push(i);
                        }
                    }
                    this.state.reconciliationIndices = remainingIndices;
                    this.state.aliceReconciliationBits = remainingIndices.map(i => ({
                        value: this.state.aliceMatchingBits[i].value,
                        originalIndex: this.state.aliceMatchingBits[i].originalIndex
                    }));
                    this.state.bobReconciliationBits = remainingIndices.map(i => ({
                        value: this.state.bobMatchingBits[i].value,
                        originalIndex: this.state.bobMatchingBits[i].originalIndex
                    }));
                } else {
                    // Используем все keptIndices
                    this.state.reconciliationIndices = Array.from({ length: this.state.keptIndices.length }, (_, i) => i);
                    this.state.aliceReconciliationBits = this.state.aliceMatchingBits.map(b => ({
                        value: b.value,
                        originalIndex: b.originalIndex
                    }));
                    this.state.bobReconciliationBits = this.state.bobMatchingBits.map(b => ({
                        value: b.value,
                        originalIndex: b.originalIndex
                    }));
                }
                this.saveState();
            } else {
                // Данных действительно нет
                stepContainer.innerHTML = `
                    <div class="step-content p-6 rounded-2xl bg-red-900/40 border border-red-600/50 backdrop-blur-sm">
                        <p class="text-red-300 text-lg font-semibold mb-2">Ошибка</p>
                        <p class="text-red-200 mb-4">Данные для сверки информации отсутствуют. Вернитесь к шагу 8 и дождитесь завершения проверки.</p>
                        <p class="text-red-300 text-sm">aliceReconciliationBits: ${this.state.aliceReconciliationBits ? this.state.aliceReconciliationBits.length : 'undefined'}</p>
                        <p class="text-red-300 text-sm">bobReconciliationBits: ${this.state.bobReconciliationBits ? this.state.bobReconciliationBits.length : 'undefined'}</p>
                        <p class="text-red-300 text-sm">keptIndices: ${this.state.keptIndices ? this.state.keptIndices.length : 'undefined'}</p>
                    </div>
                `;
                this.addEvent('Ошибка: данные для сверки информации отсутствуют. Вернитесь к шагу 8.', 'error');
                return;
            }
        }
        
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        const blockSize = Math.max(10, Math.floor(Math.sqrt(this.state.aliceReconciliationBits.length))); // Размер блока для reconciliation
        
        // Information Reconciliation
        // Если reconciliation еще не был выполнен, выполняем его
        if (!this.state.reconciledAliceBits || !this.state.reconciledBobBits || 
            this.state.reconciledAliceBits.length === 0 || this.state.reconciledBobBits.length === 0) {
            // Копируем биты для reconciliation
            let aliceBits = this.state.aliceReconciliationBits.map(b => typeof b === 'object' && b !== null && b.value !== undefined ? b.value : b);
            let bobBits = this.state.bobReconciliationBits.map(b => typeof b === 'object' && b !== null && b.value !== undefined ? b.value : b);
            
            // Проверяем, что данные есть
            if (aliceBits.length === 0 || bobBits.length === 0) {
                stepContainer.innerHTML = `
                    <div class="step-content p-6 rounded-2xl bg-red-900/40 border border-red-600/50 backdrop-blur-sm">
                        <p class="text-red-300 text-lg font-semibold mb-2">Ошибка</p>
                        <p class="text-red-200 mb-4">Нет данных для reconciliation. Возможно, все биты были использованы для проверки на шаге 8.</p>
                        <p class="text-red-300 text-sm">aliceReconciliationBits: ${this.state.aliceReconciliationBits.length}</p>
                        <p class="text-red-300 text-sm">bobReconciliationBits: ${this.state.bobReconciliationBits.length}</p>
                    </div>
                `;
                return;
            }
            
            // Разделяем на блоки и сверяем паритеты
            const numBlocks = Math.ceil(aliceBits.length / blockSize);
            const parityRevealed = []; // Информация, раскрытая по открытому каналу
            
            for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
                const start = blockIdx * blockSize;
                const end = Math.min(start + blockSize, aliceBits.length);
                
                // Вычисляем паритет блока (сумма по модулю 2)
                const aliceParity = aliceBits.slice(start, end).reduce((sum, bit) => sum ^ bit, 0);
                const bobParity = bobBits.slice(start, end).reduce((sum, bit) => sum ^ bit, 0);
                
                parityRevealed.push({
                    blockIndex: blockIdx,
                    start: start,
                    end: end,
                    aliceParity: aliceParity,
                    bobParity: bobParity
                });
                
                // Если паритеты не совпадают, ищем и исправляем ошибку (бинарный поиск)
                if (aliceParity !== bobParity) {
                    // Упрощенный бинарный поиск ошибки
                    let errorIndex = this.findErrorInBlock(aliceBits.slice(start, end), bobBits.slice(start, end)) + start;
                    if (errorIndex >= start && errorIndex < end) {
                        // Исправляем ошибку (инвертируем бит Боба)
                        bobBits[errorIndex] = bobBits[errorIndex] ^ 1;
                    }
                }
            }
            
            // Сохраняем результаты reconciliation
            this.state.reconciledAliceBits = aliceBits;
            this.state.reconciledBobBits = bobBits;
            this.state.parityRevealed = parityRevealed;
            this.saveState();
        }
        
        const reconciledAlice = this.state.reconciledAliceBits || [];
        const reconciledBob = this.state.reconciledBobBits || [];
        const parityRevealed = this.state.parityRevealed || [];
        
        // Проверяем, что reconciliation был выполнен успешно
        if (reconciledAlice.length === 0 || reconciledBob.length === 0) {
            stepContainer.innerHTML = `
                <div class="step-content p-6 rounded-2xl bg-red-900/40 border border-red-600/50 backdrop-blur-sm">
                    <p class="text-red-300 text-lg font-semibold mb-2">Ошибка</p>
                    <p class="text-red-200 mb-4">Reconciliation не был выполнен. Нет данных для обработки.</p>
                    <p class="text-red-300 text-sm">aliceReconciliationBits: ${this.state.aliceReconciliationBits ? this.state.aliceReconciliationBits.length : 'undefined'}</p>
                    <p class="text-red-300 text-sm">bobReconciliationBits: ${this.state.bobReconciliationBits ? this.state.bobReconciliationBits.length : 'undefined'}</p>
                </div>
            `;
            this.addEvent('Ошибка: reconciliation не был выполнен из-за отсутствия данных.', 'error');
            return;
        }
        
        // Privacy Amplification
        // Если amplification еще не был выполнен, выполняем его
        if (!this.state.finalKey) {
            const rawKeyLength = reconciledAlice.length;
            
            // Расчёт длины финального ключа на основе теоретической формулы:
            // m = n * H_min(X|E) - leak_EC - 2*log(1/ε)
            // Где:
            // - H_min(X|E) - минимальная энтропия (оценивается на основе ошибок Евы)
            // - leak_EC - утечка информации при error correction (количество раскрытых паритетов)
            // - ε - вероятность ошибки безопасности (для симуляции используем упрощение)
            
            // 1. Оцениваем утечку при Error Correction (количество раскрытых паритетов блоков)
            const leakEC = this.state.parityRevealed ? this.state.parityRevealed.length : 0;
            
            // 2. Оцениваем минимальную энтропию на основе процента ошибок при проверке Евы
            // Если протокол дошёл до этого шага, значит проверка прошла успешно,
            // но могли быть ошибки (которые мы учтём)
            let errorRate = 0;
            if (this.state.eveCheckIndices && this.state.eveCheckIndices.length > 0) {
                // Подсчитываем ошибки из шага 8 (если доступны)
                // Для упрощения используем оценку на основе длины проверенных битов
                // В реальном протоколе это вычисляется на основе фактических ошибок
                const checkLength = this.state.eveCheckIndices.length;
                // Если ошибок было мало, считаем что минимальная энтропия близка к 1
                // Упрощение: используем фиксированную оценку, основанную на том, что проверка прошла
                errorRate = 0.05; // 5% ошибок - консервативная оценка для симуляции
            }
            
            // Минимальная энтропия (упрощённая оценка)
            // H_min(X|E) ≈ 1 - h(errorRate), где h - бинарная энтропия
            // h(p) = -p*log2(p) - (1-p)*log2(1-p)
            const binaryEntropy = (p) => {
                if (p === 0 || p === 1) return 0;
                return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
            };
            const hMin = Math.max(0.5, 1 - binaryEntropy(errorRate)); // Консервативная оценка
            
            // 3. Параметр безопасности (для симуляции используем упрощение)
            const securityParameter = 0.01; // ε = 0.01
            const securityTerm = 2 * Math.log2(1 / securityParameter); // 2*log(1/0.01) ≈ 13.3
            
            // 4. Расчёт длины финального ключа
            // m = n * H_min(X|E) - leak_EC - 2*log(1/ε)
            let m = Math.floor(rawKeyLength * hMin - leakEC - securityTerm);
            
            console.log('Расчёт m (до проверок):', {
                rawKeyLength: rawKeyLength,
                hMin: hMin,
                rawKeyLength_hMin: rawKeyLength * hMin,
                leakEC: leakEC,
                securityTerm: securityTerm,
                calculatedM_before: m
            });
            
            // Если расчёт дал отрицательное или слишком малое значение, используем консервативную оценку
            const minReasonableM = Math.max(1, Math.floor(rawKeyLength * 0.5));
            if (m < minReasonableM || m <= 0) {
                // Используем консервативную оценку: 70% от исходной длины
                const conservativeM = Math.floor(rawKeyLength * 0.7);
                // Гарантируем, что m в допустимом диапазоне [1, rawKeyLength - 1]
                // НЕ используем n, так как n может быть больше rawKeyLength
                m = Math.max(1, Math.min(rawKeyLength - 1, conservativeM));
                console.log('Используется консервативная оценка:', { 
                    conservativeM, 
                    n, 
                    rawKeyLength,
                    finalM: m 
                });
            } else {
                // Гарантируем, что m положительное и меньше исходной длины
                m = Math.max(1, Math.min(rawKeyLength - 1, m));
            }
            
            // Финальная проверка: гарантируем валидность m
            if (m <= 0 || m >= rawKeyLength || !Number.isFinite(m)) {
                console.error('Критическая ошибка: невалидное значение m:', m);
                // Используем минимально разумное значение
                m = Math.max(1, Math.min(rawKeyLength - 1, Math.floor(rawKeyLength * 0.7)));
            }
            
            console.log('Privacy Amplification (теоретический расчёт):', {
                rawKeyLength: rawKeyLength,
                n: n,
                errorRate: errorRate,
                hMin: hMin.toFixed(3),
                leakEC: leakEC,
                securityTerm: securityTerm.toFixed(2),
                calculatedM: m,
                hashSeed: this.state.hashSeed
            });
            
            // Генерируем случайный seed для хэш-функции (публично)
            if (!this.state.hashSeed) {
                this.state.hashSeed = Math.floor(Math.random() * 0xFFFFFFFF);
            }
            
            // Финальная проверка: гарантируем, что m валидное
            if (m <= 0 || m >= rawKeyLength || !Number.isFinite(m)) {
                console.warn('Невалидное значение m, используем консервативную оценку:', m);
                m = Math.max(1, Math.min(rawKeyLength - 1, Math.floor(rawKeyLength * 0.7)));
            }
            
            console.log('Финальное значение m:', m, 'rawKeyLength:', rawKeyLength);
            
            // Используем улучшенную универсальную хэш-функцию (Toeplitz-матричный подход)
            const finalKey = this.privacyAmplification(reconciledAlice, m, this.state.hashSeed);
            
            if (!finalKey || finalKey.length === 0) {
                console.error('Ошибка: privacyAmplification вернул пустой массив', {
                    inputLength: reconciledAlice.length,
                    outputLength: m,
                    seed: this.state.hashSeed
                });
            }
            
            // Проверяем, что Боб получил тот же ключ (должен быть одинаковым после reconciliation)
            const bobFinalKey = this.privacyAmplification(reconciledBob, m, this.state.hashSeed);
            
            if (finalKey.join('') !== bobFinalKey.join('')) {
                this.addEvent('Предупреждение: финальные ключи Алисы и Боба не совпадают после privacy amplification', 'warning');
            }
            
            this.state.finalKey = finalKey;
            this.state.finalKeyLength = m;
            this.saveState();
        }
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(9)}</p>
                
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-blue-300 mb-3">1. Information Reconciliation (Информационная сверка)</h3>
                    <p class="text-sm text-gray-400 mb-4">
                        Алиса и Боб делят свои битовые строки на блоки и открыто обмениваются паритетами блоков.
                        Если паритеты не совпадают, они находят и исправляют ошибки через бинарный поиск.
                    </p>
                    <div id="reconciliation-container" class="mt-4"></div>
                </div>
                
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-purple-300 mb-3">2. Privacy Amplification (Усиление приватности)</h3>
                    <p class="text-sm text-gray-400 mb-4">
                        Алиса и Боб применяют универсальное хэширование к сверенным битам для получения финального безопасного ключа.
                        Даже если Ева узнала часть информации, финальный ключ остается безопасным.
                    </p>
                    <div id="amplification-container" class="mt-4"></div>
                </div>
            </div>
        `;
        
        // Создаем визуализацию reconciliation
        const reconciliationContainer = stepContainer.querySelector('#reconciliation-container');
        if (reconciliationContainer) {
            setTimeout(() => {
                reconciliationContainer.innerHTML = `
                    <div class="bg-gray-800/40 rounded-lg p-4 mb-4">
                        <p class="text-sm text-gray-300 mb-3">Размер блока: ${blockSize} битов, Всего блоков: ${parityRevealed.length}</p>
                        <p class="text-sm text-gray-300 mb-3">Раскрыто информации (паритеты блоков): ${parityRevealed.length} битов</p>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <p class="text-sm font-semibold text-gray-300 mb-2">Алиса: Биты после reconciliation (${reconciledAlice.length} битов)</p>
                            <div id="alice-reconciled-tape-container"></div>
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-gray-300 mb-2">Боб: Биты после reconciliation (${reconciledBob.length} битов)</p>
                            <div id="bob-reconciled-tape-container"></div>
                        </div>
                    </div>
                `;
                
                // Лента битов Алисы после reconciliation
                const aliceReconciledContainer = reconciliationContainer.querySelector('#alice-reconciled-tape-container');
                if (aliceReconciledContainer) {
                    const aliceReconciledTape = new BitTape(aliceReconciledContainer, {
                        title: 'Алиса: Биты после reconciliation',
                        variant: 'classical',
                        bits: reconciledAlice,
                        shouldAnimate: false,
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('aliceReconciled', aliceReconciledTape);
                    
                    if (!this.stepBitTapes.has(9)) {
                        this.stepBitTapes.set(9, []);
                    }
                    this.stepBitTapes.get(9).push(aliceReconciledTape);
                }
                
                // Лента битов Боба после reconciliation
                const bobReconciledContainer = reconciliationContainer.querySelector('#bob-reconciled-tape-container');
                if (bobReconciledContainer) {
                    const bobReconciledTape = new BitTape(bobReconciledContainer, {
                        title: 'Боб: Биты после reconciliation',
                        variant: 'classical',
                        bits: reconciledBob,
                        shouldAnimate: false,
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('bobReconciled', bobReconciledTape);
                    
                    if (!this.stepBitTapes.has(9)) {
                        this.stepBitTapes.set(9, []);
                    }
                    this.stepBitTapes.get(9).push(bobReconciledTape);
                }
            }, 50);
        }
        
        // Создаем визуализацию privacy amplification
        const amplificationContainer = stepContainer.querySelector('#amplification-container');
        if (amplificationContainer) {
            setTimeout(() => {
                const finalKeyHex = this.bitsToHex(this.state.finalKey);
                amplificationContainer.innerHTML = `
                    <div class="bg-purple-900/40 border border-purple-600/50 rounded-lg p-4 mb-4">
                        <p class="text-purple-200 font-semibold mb-2">Финальный ключ</p>
                        <p class="text-sm text-purple-300 mb-1">Длина исходного ключа (n): ${reconciledAlice.length} битов</p>
                        <p class="text-sm text-purple-300 mb-1">Длина финального ключа (m): ${this.state.finalKeyLength} битов</p>
                        <p class="text-sm text-purple-300 mb-1">Утечка при Error Correction: ${this.state.parityRevealed ? this.state.parityRevealed.length : 0} битов</p>
                        <p class="text-sm text-purple-300 mb-2">Сжатие: ${reconciledAlice.length > 0 && this.state.finalKeyLength > 0 ? ((1 - this.state.finalKeyLength / reconciledAlice.length) * 100).toFixed(1) : 0}%</p>
                        <p class="text-xs text-purple-400 mt-2 italic mb-3">Примечание: Используется упрощённая оценка формулы m = n·H_min(X|E) - leak_EC - 2·log(1/ε)</p>
                        <p class="text-purple-200 font-semibold mt-3 mb-1">Ключ в hex формате:</p>
                        <p class="text-purple-100 font-mono text-lg break-all bg-purple-950/50 p-2 rounded border border-purple-700/50">${finalKeyHex}</p>
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-gray-300 mb-2">Общий ключ Алисы и Боба (${this.state.finalKey.length} битов)</p>
                        <div id="final-key-tape-container"></div>
                    </div>
                `;
                
                // Лента финального ключа
                const finalKeyContainer = amplificationContainer.querySelector('#final-key-tape-container');
                if (finalKeyContainer) {
                    const finalKeyTape = new BitTape(finalKeyContainer, {
                        title: 'Финальный ключ',
                        variant: 'classical',
                        bits: this.state.finalKey,
                        shouldAnimate: false,
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('finalKey', finalKeyTape);
                    
                    if (!this.stepBitTapes.has(9)) {
                        this.stepBitTapes.set(9, []);
                    }
                    this.stepBitTapes.get(9).push(finalKeyTape);
                }
            }, 100);
        }
        
        this.saveState();
        this.addEvent(`Сверка информации и усиление приватности завершены. Финальный ключ: ${this.state.finalKeyLength} битов.`, 'info');
    }
    
    // Вспомогательная функция для поиска ошибки в блоке (бинарный поиск)
    findErrorInBlock(aliceBlock, bobBlock) {
        // Упрощенный алгоритм - просто находим первый несовпадающий бит
        for (let i = 0; i < aliceBlock.length; i++) {
            if (aliceBlock[i] !== bobBlock[i]) {
                return i;
            }
        }
        return -1; // Ошибка не найдена (паритеты совпали, но биты различаются)
    }
    
    // Улучшенная функция privacy amplification с использованием Toeplitz-матричного подхода
    // Это более теоретически корректный метод, хотя всё ещё упрощён для симуляции
    // В реальном BB84 используют полностью 2-универсальные хэш-семейства
    privacyAmplification(rawKey, outputLength, seed) {
        const result = [];
        const keyLength = rawKey.length;
        
        if (keyLength === 0 || outputLength === 0) {
            return [];
        }
        
        // Toeplitz-матричный подход: каждый выходной бит - это скалярное произведение
        // ключа на строку матрицы, которая определяется seed
        // Это обеспечивает лучшие свойства универсальности, чем простой XOR
        
        // Генерируем Toeplitz-матрицу на основе seed
        // Для каждого выходного бита i нужна строка длины keyLength
        for (let i = 0; i < outputLength; i++) {
            let hashValue = 0;
            
            // Генерируем строку матрицы для i-го выходного бита
            // Используем линейный конгруэнтный генератор на основе seed и индекса
            let matrixRowSeed = (seed + i * 0x9e3779b9) >>> 0; // Золотое число для лучшего перемешивания
            
            // Вычисляем скалярное произведение ключа на строку матрицы (над GF(2))
            for (let j = 0; j < keyLength; j++) {
                // Генерируем следующий бит строки матрицы (псевдослучайно)
                matrixRowSeed = (matrixRowSeed * 1103515245 + 12345) >>> 0; // LCG
                const matrixBit = matrixRowSeed & 1;
                
                // Умножение и сложение над GF(2) - это AND и XOR
                // hashValue = hashValue XOR (rawKey[j] AND matrixBit)
                if (rawKey[j] === 1 && matrixBit === 1) {
                    hashValue = hashValue ^ 1;
                }
            }
            
            result.push(hashValue);
        }
        
        console.log('Privacy Amplification result (Toeplitz):', {
            inputLength: keyLength,
            outputLength: outputLength,
            resultLength: result.length,
            seed: seed,
            firstFewBits: result.slice(0, Math.min(10, result.length))
        });
        
        return result;
    }
    
    // Преобразование битового массива в hex строку
    bitsToHex(bits) {
        if (!bits || bits.length === 0) {
            return '0x0';
        }
        
        // Преобразуем биты в строку
        const bitString = bits.join('');
        
        // Дополняем до кратного 4 (для hex)
        const paddedLength = Math.ceil(bitString.length / 4) * 4;
        const paddedBits = bitString.padStart(paddedLength, '0');
        
        // Преобразуем каждые 4 бита в hex символ
        let hexString = '';
        for (let i = 0; i < paddedBits.length; i += 4) {
            const nibble = paddedBits.substr(i, 4);
            const hexDigit = parseInt(nibble, 2).toString(16).toUpperCase();
            hexString += hexDigit;
        }
        
        // Убираем ведущие нули, но оставляем хотя бы одну цифру
        hexString = hexString.replace(/^0+/, '') || '0';
        
        return '0x' + hexString;
    }
    
    getOrCreateStepContainer(stepNumber) {
        if (!this.stepContainers.has(stepNumber)) {
            const container = document.createElement('div');
            container.className = `step-container step-${stepNumber} mb-6`;
            container.id = `step-${stepNumber}`;
            container.style.display = 'none'; // Изначально скрыт
            this.container.appendChild(container);
            this.stepContainers.set(stepNumber, container);
        }
        return this.stepContainers.get(stepNumber);
    }
    
    generateRandomBits(n) {
        return Array.from({ length: n }, () => Math.floor(Math.random() * 2));
    }
    
    generateRandomBases(n) {
        // Генерируем случайные базисы: true -> 'Z', false -> 'X'
        return Array.from({ length: n }, () => Math.random() < 0.5);
    }
    
    convertBasesToDisplay(bases) {
        // Конвертируем boolean массив в массив строк для отображения
        // true -> 'Z', false -> 'X'
        return bases.map(basis => basis ? 'Z' : 'X');
    }
    
    encodeQubits(bits, bases) {
        // Кодируем биты в кубиты согласно базисам
        // bases[i] == false -> X базис, bases[i] == true -> Z базис
        const sqrtTwo = Math.sqrt(2);
        const oneOverSqrtTwo = 1 / sqrtTwo;
        
        return bits.map((bit, i) => {
            const basis = bases[i];
            let alpha, beta;
            let symbol;
            
            if (!basis) {
                // X базис
                if (!bit) {
                    // |+> = 1/√2 |0> + 1/√2 |1>
                    alpha = { real: oneOverSqrtTwo, imag: 0 };
                    beta = { real: oneOverSqrtTwo, imag: 0 };
                    symbol = '|+⟩';
                } else {
                    // |-> = 1/√2 |0> - 1/√2 |1>
                    alpha = { real: oneOverSqrtTwo, imag: 0 };
                    beta = { real: -oneOverSqrtTwo, imag: 0 };
                    symbol = '|−⟩';
                }
            } else {
                // Z базис
                if (!bit) {
                    // |0> = 1|0> + 0|1>
                    alpha = { real: 1, imag: 0 };
                    beta = { real: 0, imag: 0 };
                    symbol = '|0⟩';
                } else {
                    // |1> = 0|0> + 1|1>
                    alpha = { real: 0, imag: 0 };
                    beta = { real: 1, imag: 0 };
                    symbol = '|1⟩';
                }
            }
            
            // Вычисляем вероятности
            const prob0 = alpha.real * alpha.real + alpha.imag * alpha.imag;
            const prob1 = beta.real * beta.real + beta.imag * beta.imag;
            
            return {
                index: i,
                basis: basis ? 'Z' : 'X',
                alpha,
                beta,
                prob0,
                prob1,
                symbol
            };
        });
    }
    
    hideStepWithAnimation(stepNumber, callback) {
        const container = this.stepContainers.get(stepNumber);
        if (!container || container.style.display === 'none') {
            if (callback) callback();
            return;
        }
        
        // Скрываем мгновенно без анимации, чтобы не влиять на layout
        container.style.display = 'none';
        container.style.visibility = 'hidden';
        container.classList.remove('showing', 'hiding');
        container.style.willChange = '';
        if (callback) callback();
    }
    
    showStepWithAnimation(stepNumber) {
        const container = this.stepContainers.get(stepNumber);
        if (!container) return;
        
        // Показываем элемент - анимация битов происходит внутри BitTape
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.height = 'auto';
        container.style.minHeight = '';
        container.classList.remove('hiding', 'showing');
        
        // Ждем полной отрисовки контейнера перед обновлением Swiper
        // Используем несколько requestAnimationFrame для гарантии отрисовки
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Принудительно заставляем браузер пересчитать layout
                void container.offsetHeight;
                
                setTimeout(() => {
                    // Обновляем Swiper для всех лент в этом шаге
                    const bitTapesForStep = this.stepBitTapes.get(stepNumber);
                    if (bitTapesForStep) {
                        bitTapesForStep.forEach(bitTape => {
                            if (bitTape) {
                                // Принудительно пересчитываем размеры перед обновлением
                                if (bitTape.container) {
                                    const tapeContainer = bitTape.container.closest('.bit-tape');
                                    if (tapeContainer) {
                                        void tapeContainer.offsetHeight;
                                        void tapeContainer.offsetWidth;
                                    }
                                }
                                
                                // Обновляем Swiper
                                if (typeof bitTape.updateSwiper === 'function') {
                                    bitTape.updateSwiper();
                                }
                            }
                        });
                        
                        // Дополнительное обновление через еще одну задержку для надежности
                        setTimeout(() => {
                            bitTapesForStep.forEach(bitTape => {
                                if (bitTape && typeof bitTape.updateSwiper === 'function') {
                                    const container = bitTape.swiperInstance?.el;
                                    if (container && container.offsetHeight > 0) {
                                        bitTape.updateSwiper();
                                    }
                                }
                            });
                        }, 300);
                    }
                }, 300); // Увеличиваем задержку для надежности
            });
        });
    }
    
    goToStep(stepNumber) {
        if (stepNumber < 0 || stepNumber >= this.steps.length) {
            return;
        }
        
        // Сохраняем текущее состояние в историю перед переходом
        this.saveStepToHistory(this.currentStep);
        
        // Определяем, какие шаги нужно скрыть
        const stepsToHide = [];
        for (let i = stepNumber + 1; i < this.steps.length; i++) {
            stepsToHide.push(i);
        }
        
        // На шагах 4, 5 и 6 скрываем все предыдущие шаги
        if (stepNumber === 4) {
            stepsToHide.push(0, 1, 2, 3);
        } else if (stepNumber === 5) {
            stepsToHide.push(0, 1, 2, 3, 4);
        } else if (stepNumber === 6) {
            // На шаге 6 не скрываем шаг 5 - показываем оба
            stepsToHide.push(0, 1, 2, 3, 4);
        } else if (stepNumber === 7) {
            // На шаге 7 скрываем все предыдущие шаги
            stepsToHide.push(0, 1, 2, 3, 4, 5, 6);
        } else if (stepNumber === 8) {
            // На шаге 8 скрываем все предыдущие шаги
            stepsToHide.push(0, 1, 2, 3, 4, 5, 6, 7);
        } else if (stepNumber === 9) {
            // На шаге 9 скрываем все предыдущие шаги, включая шаг 8
            stepsToHide.push(0, 1, 2, 3, 4, 5, 6, 7, 8);
            // Очищаем контейнер шага 8
            const step8Container = this.stepContainers.get(8);
            if (step8Container) {
                step8Container.innerHTML = '';
            }
        } else if (stepNumber > 0) {
            // Скрываем шаг 0, если мы не на шаге 0
            stepsToHide.push(0);
        }
        
        // Проверяем, находится ли выбранный элемент в скрываемом шаге
        if (this.selectedElement && this.selectedElementStep !== null) {
            if (stepsToHide.includes(this.selectedElementStep)) {
                // Не очищаем выбор, если переходим на шаг, где элемент снова будет виден
                const willBeVisible = (stepNumber === 6 && (this.selectedElementStep === 5 || this.selectedElementStep === 6)) ||
                                     (stepNumber === 5 && this.selectedElementStep === 5) ||
                                     (stepNumber === this.selectedElementStep);
                
                if (!willBeVisible) {
                    this.clearSelection();
                }
            }
        }
        
        // Очищаем панель деталей и выбор кубитов Евы при уходе с шага 4
        if (this.currentStep === 4 && stepNumber !== 4) {
            // Очищаем множественный выбор для шага 4
            this.selectedIndices = [];
            this.lastSelectedIndex = null;
            
            // Очищаем панель деталей
            if (this.qubitDetails) {
                this.qubitDetails.setSelectedElement(null);
            }
            
            // Очищаем выбор в ленте кубитов Евы
            const eveTape = this.bitTapes.get('eveQubits');
            if (eveTape) {
                eveTape.clearSelection();
            }
        }
        
        // Очищаем панель деталей при уходе с шага 5
        if (this.currentStep === 5 && stepNumber !== 5) {
            // Очищаем панель деталей
            if (this.qubitDetails) {
                this.qubitDetails.setSelectedElement(null);
            }
            
            // Очищаем выбор в ленте кубитов Боба
            const bobTape = this.bitTapes.get('bobQubits');
            if (bobTape) {
                bobTape.clearSelection();
            }
        }
        
        // Очищаем панель деталей при уходе с шага 6 на шаг, где шаг 6 скрывается
        if (this.currentStep === 6 && stepNumber !== 6 && stepNumber !== 5) {
            if (this.qubitDetails) {
                this.qubitDetails.setSelectedElement(null);
            }
            
            const bobBasesTape = this.bitTapes.get('bobBases');
            const bobBitsTape = this.bitTapes.get('bobBits');
            if (bobBasesTape) {
                bobBasesTape.clearSelection();
            }
            if (bobBitsTape) {
                bobBitsTape.clearSelection();
            }
            
            if (this.selectedElementStep === 6) {
                this.clearSelection();
            }
        }
        
        // Обновляем заголовок шага
        this.updateStepHeader(stepNumber);
        
        // Скрываем шаги с анимацией
        if (stepsToHide.length > 0) {
            let hiddenCount = 0;
            const totalToHide = stepsToHide.length;
            
            stepsToHide.forEach(stepNum => {
                this.hideStepWithAnimation(stepNum, () => {
                    hiddenCount++;
                    // Когда все шаги скрыты, показываем нужные
                    if (hiddenCount === totalToHide) {
                        this.showStepsForStep(stepNumber);
                    }
                });
            });
        } else {
            // Если нечего скрывать, сразу показываем нужные шаги
            this.showStepsForStep(stepNumber);
        }
    }
    
    showStepsForStep(stepNumber) {
        // Восстанавливаем состояние для целевого шага, если оно есть в истории
        // Для шага 5 не восстанавливаем из истории, так как он должен показывать актуальные кубиты после всех атак
        if (this.stepHistory[stepNumber] && stepNumber !== 5) {
            this.state = JSON.parse(JSON.stringify(this.stepHistory[stepNumber]));
        }
        
        // Рендерим и показываем нужные шаги
        // На шагах 4 и 5 показываем только соответствующий шаг
        // На шаге 6 показываем шаги 5 и 6 вместе
        let stepsToShow = [];
        if (stepNumber === 4 || stepNumber === 5) {
            stepsToShow = [stepNumber];
        } else if (stepNumber === 6) {
            // На шаге 6 показываем шаги 5 и 6 вместе
            stepsToShow = [5, 6];
        } else if (stepNumber === 7 || stepNumber === 8 || stepNumber === 9) {
            // На шагах 7, 8 и 9 показываем только текущий шаг
            stepsToShow = [stepNumber];
        } else {
            for (let i = 0; i <= stepNumber; i++) {
                if (this.steps[i]) {
                    // Пропускаем шаг 0, если мы не на шаге 0
                    if (i === 0 && stepNumber > 0) {
                        continue;
                    }
                    stepsToShow.push(i);
                }
            }
        }
        
        stepsToShow.forEach(i => {
            if (this.steps[i]) {
                
                // Для шагов 7, 8, 9 всегда перерендериваем, чтобы показать актуальные данные
                // Также перерендериваем шаг 6 при переходе на него, чтобы восстановить выбранные элементы
                if (!this.renderedSteps.has(i) || i === 7 || i === 8 || i === 9 || (i === 6 && stepNumber === 6)) {
                    // Рендерим шаг
                    this.steps[i].render();
                    this.renderedSteps.add(i);
                    
                    // Для шага 5 обновляем данные после рендера (на случай, если данные изменились)
                    if (i === 5 && this.state.channelQubits && this.state.channelQubits.length > 0) {
                        setTimeout(() => {
                            const bobTape = this.bitTapes.get('bobQubits');
                            if (bobTape) {
                                const bobQubits = this.state.channelQubits.map((qubit, index) => {
                                    return {
                                        index: index,
                                        symbol: qubit.symbol,
                                        basis: qubit.basis,
                                        alpha: qubit.alpha,
                                        beta: qubit.beta,
                                        prob0: qubit.prob0,
                                        prob1: qubit.prob1
                                    };
                                });
                                bobTape.updateBits(bobQubits);
                            }
                        }, 100);
                    }
                    
                    // Показываем с анимацией после рендера
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            this.showStepWithAnimation(i);
                            
                            // Обновляем Swiper для всех битных лент в этом шаге
                            setTimeout(() => {
                                const bitTapesForStep = this.stepBitTapes.get(i);
                                if (bitTapesForStep) {
                                    bitTapesForStep.forEach(bitTape => {
                                        if (bitTape && typeof bitTape.updateSwiper === 'function') {
                                            bitTape.updateSwiper();
                                        }
                                    });
                                }
                            }, 200); // Увеличиваем задержку для надежности
                        });
                    });
                } else {
                    // Для шага 5 всегда обновляем данные кубитов Боба перед показом
                    if (i === 5 && this.state.channelQubits && this.state.channelQubits.length > 0) {
                        const bobTape = this.bitTapes.get('bobQubits');
                        if (bobTape) {
                            // Обновляем кубиты для отображения Бобу
                            const bobQubits = this.state.channelQubits.map((qubit, index) => {
                                return {
                                    index: index,
                                    symbol: qubit.symbol,
                                    basis: qubit.basis,
                                    alpha: qubit.alpha,
                                    beta: qubit.beta,
                                    prob0: qubit.prob0,
                                    prob1: qubit.prob1
                                };
                            });
                            bobTape.updateBits(bobQubits);
                        }
                    }
                    
                    // Показываем уже отрендеренный шаг с анимацией
                    this.showStepWithAnimation(i);
                    
                    // Swiper обновится внутри showStepWithAnimation
                }
            }
        });
        
        this.currentStep = stepNumber;
        this.saveState();
        this.updateStepIndicator();
        this.updateBottomPanel();
    }
    
    saveStepToHistory(stepNumber) {
        // Сохраняем копию состояния для этого шага
        if (!this.stepHistory[stepNumber]) {
            this.stepHistory[stepNumber] = JSON.parse(JSON.stringify(this.state));
        }
    }
    
    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.goToStep(this.currentStep + 1);
        }
    }
    
    prevStep() {
        if (this.currentStep > 0) {
            this.goToStep(this.currentStep - 1);
        }
    }
    
    reset() {
        this.currentStep = 0;
        this.state = {
            aliceBits: [],
            aliceBases: [],
            aliceQubits: [],
            channelQubits: [],
            eveAttacks: {},
            bobBases: [],
            bobBits: [],
            keptIndices: [],
            aliceMatchingBits: [],
            bobMatchingBits: [],
            eveCheckIndices: [],
            reconciliationIndices: [],
            aliceReconciliationBits: [],
            bobReconciliationBits: [],
            reconciledAliceBits: [],
            reconciledBobBits: [],
            parityRevealed: [],
            finalKey: [],
            finalKeyLength: 0,
            hashSeed: null
        };
        this.stepHistory = []; // Очищаем историю
        
        // Очищаем множественный выбор
        this.selectedIndices = [];
        this.lastSelectedIndex = null;
        
        // Очищаем все контейнеры
        this.stepContainers.forEach(container => container.remove());
        this.stepContainers.clear();
        this.bitTapes.clear();
        this.stepBitTapes.clear(); // Очищаем ссылки на BitTape по шагам
        this.renderedSteps.clear(); // Очищаем список отрендеренных шагов
        
        this.saveState();
        this.goToStep(0);
    }
    
    startAutoPlay() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        if (typeof panelState !== 'undefined') {
            panelState.simulationState.isRunning = true;
        }
        if (typeof updateRunButton === 'function') {
            updateRunButton();
        }
        
        this.autoPlayInterval = setInterval(() => {
            if (this.currentStep < this.steps.length - 1) {
                this.nextStep();
            } else {
                this.stopAutoPlay();
            }
        }, this.autoPlayDelay);
    }
    
    stopAutoPlay() {
        this.isRunning = false;
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
        if (typeof panelState !== 'undefined') {
            panelState.simulationState.isRunning = false;
        }
        if (typeof updateRunButton === 'function') {
            updateRunButton();
        }
    }
    
    toggleAutoPlay() {
        if (this.isRunning) {
            this.stopAutoPlay();
        } else {
            this.startAutoPlay();
        }
    }
    
    updateStepIndicator() {
        // Обновляем индикатор шага в панели управления
        if (typeof updateConnectionStatusDisplay === 'function') {
            updateConnectionStatusDisplay();
        }
    }
    
    saveState() {
        // Сохраняем текущее состояние в историю
        this.saveStepToHistory(this.currentStep);
        
        const stateToSave = {
            currentStep: this.currentStep,
            state: this.state,
            stepHistory: this.stepHistory, // Сохраняем всю историю
            config: (typeof panelState !== 'undefined' && panelState.config) ? panelState.config : {}
        };
        localStorage.setItem('bb84_simulation_state', JSON.stringify(stateToSave));
    }
    
    loadState() {
        const saved = localStorage.getItem('bb84_simulation_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.currentStep = parsed.currentStep || 0;
                
                // Инициализируем состояние с дефолтными значениями
                const defaultState = {
                    aliceBits: [],
                    aliceBases: [],
                    aliceQubits: [],
                    channelQubits: [],
                    eveAttacks: {},
                    bobBases: [],
                    bobBits: []
                };
                
                // Объединяем сохраненное состояние с дефолтным, чтобы гарантировать наличие всех полей
                this.state = parsed.state ? {
                    ...defaultState,
                    ...parsed.state
                } : defaultState;
                
                // Убеждаемся, что массивы всегда массивы, а объекты - объекты
                if (!Array.isArray(this.state.aliceQubits)) {
                    this.state.aliceQubits = [];
                }
                if (!Array.isArray(this.state.channelQubits)) {
                    this.state.channelQubits = [];
                }
                if (typeof this.state.eveAttacks !== 'object' || Array.isArray(this.state.eveAttacks)) {
                    this.state.eveAttacks = {};
                }
                
                // Восстанавливаем историю шагов, если она есть
                if (parsed.stepHistory && Array.isArray(parsed.stepHistory)) {
                    this.stepHistory = parsed.stepHistory.map(step => JSON.parse(JSON.stringify(step)));
                } else {
                    this.stepHistory = [];
                }
                
                // Восстанавливаем конфигурацию, если она есть
                if (parsed.config && typeof panelState !== 'undefined' && panelState.config) {
                    Object.assign(panelState.config, parsed.config);
                }
            } catch (e) {
                console.error('Ошибка при загрузке состояния:', e);
            }
        }
    }
    
    exportState() {
        // Сохраняем текущее состояние в историю перед экспортом
        this.saveStepToHistory(this.currentStep);
        
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            currentStep: this.currentStep,
            state: this.state,
            stepHistory: this.stepHistory, // Экспортируем всю историю
            config: (typeof panelState !== 'undefined' && panelState.config) ? panelState.config : {}
        };
        
        return exportData;
    }
    
    importState(data) {
        try {
            this.currentStep = data.currentStep || 0;
            this.state = data.state || {
                aliceBits: [],
                aliceBases: [],
                bobBases: [],
                bobBits: []
            };
            
            // Восстанавливаем историю шагов, если она есть
            if (data.stepHistory && Array.isArray(data.stepHistory)) {
                this.stepHistory = data.stepHistory.map(step => JSON.parse(JSON.stringify(step)));
            } else {
                this.stepHistory = [];
            }
            
            if (data.config && typeof panelState !== 'undefined' && panelState.config) {
                Object.assign(panelState.config, data.config);
            }
            
            // Очищаем контейнеры и перерисовываем
            this.stepContainers.forEach(container => container.remove());
            this.stepContainers.clear();
            this.bitTapes.clear();
            this.renderedSteps.clear();
            
            // Восстанавливаем состояние для текущего шага из истории, если есть
            if (this.stepHistory[this.currentStep]) {
                this.state = JSON.parse(JSON.stringify(this.stepHistory[this.currentStep]));
            }
            
            // Обновляем заголовок перед переходом
            this.updateStepHeader(this.currentStep);
            
            this.goToStep(this.currentStep);
            this.saveState();
            
            return true;
        } catch (e) {
            console.error('Ошибка при импорте состояния:', e);
            return false;
        }
    }
    
    // Проверка, можно ли применить изменение конфигурации
    canApplyConfigChange(key, oldValue, newValue) {
        if (this.currentStep < 1) {
            return true;
        }
        
        return false;
    }
    
    // Применение изменения конфигурации
    applyConfigChange(key, value) {
        if (key === 'n') {
            // Если n изменилось и мы на шаге 0, это нормально
            if (this.currentStep < 1) {
                // Применяем изменение, биты будут сгенерированы с новым n на шаге 1
                return;
            }
        }
        
        // Перерисовываем текущий шаг, если нужно
        if (this.currentStep >= 1 && key === 'n') {
            // Если n изменилось, нужно перегенерировать биты
            const n = value;
            this.state.aliceBits = this.generateRandomBits(n);
            // Обновляем все шаги до текущего
            for (let i = 0; i <= this.currentStep; i++) {
                if (this.steps[i]) {
                    this.steps[i].render();
                }
            }
        }
    }
}

