class BB84Simulator {
    constructor(container) {
        this.container = container;
        this.currentStep = 0;
        this.steps = [];
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
            reconciliationIndices: [], 
            aliceReconciliationBits: [], 
            bobReconciliationBits: [], 
            reconciledAliceBits: [], 
            reconciledBobBits: [], 
            parityRevealed: [], 
            finalKey: [], 
            finalKeyLength: 0, 
            hashSeed: null, 
            eveCheckErrorCount: 0, 
            eveCheckLength: 0, 
            isProtocolAborted: false, 
            
        };
        this.stepHistory = []; 
        this.isRunning = false;
        this.autoPlayInterval = null;
        this.autoPlayDelay = 1500; 
        
        this.stepContainers = new Map(); 
        this.bitTapes = new Map(); 
        this.stepBitTapes = new Map(); 
        this.renderedSteps = new Set(); 
        this.stepHeaderContainer = null; 
        this.selectedElement = null; 
        this.selectedElementStep = null; 
        this.selectedIndices = []; 
        this.lastSelectedIndex = null; 
        this.qubitDetails = null; 
        this.bottomPanel = null; 
        this.eventLog = []; 
        
        this.loadState();
        this.initSteps();
        this.createStepHeader();
        this.updateStepHeader(0); 
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
        
        
        
        let qber = 0;
        if (this.state.eveCheckLength > 0 && this.state.eveCheckErrorCount !== undefined) {
            
            qber = (this.state.eveCheckErrorCount / this.state.eveCheckLength) * 100;
        }
        
        
        
        const eve_attacked_count = this.state.eveAttacks ? Object.keys(this.state.eveAttacks).length : 0;
        
        
        
        let key_size = 0;
        if (this.state.finalKey && this.state.finalKey.length > 0) {
            
            key_size = this.state.finalKeyLength || this.state.finalKey.length;
        }
        
        
        return {
            qber: qber,
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
        
        
        this.selectedElement = elementData;
        this.selectedElementStep = this.currentStep;
        
        
        
        let alternateIndices = [];
        if (elementData.type === 'qubit' && this.state.aliceQubits && this.currentStep !== 3) {
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
        
        
        const elementType = elementData.type === 'qubit' ? 'кубит' : 'бит';
        const displayIndex = elementData.displayIndex !== undefined ? elementData.displayIndex : elementData.index;
        this.addEvent(`Выбран ${elementType} #${displayIndex} из "${elementData.tapeTitle || 'ленты'}"`, 'info');
    }
    
    selectQubitByIndex(index) {
        
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
            
            
            if (this.qubitDetails) {
                this.qubitDetails.setSelectedElement(elementData);
                this.qubitDetails.setAlternateIndices(this.selectedIndices);
            }
            
            
            this.lastSelectedIndex = index;
            
            
            const eveTape = this.bitTapes.get('eveQubits');
            if (eveTape) {
                
                
            }
        } else if (this.state.aliceQubits && this.state.aliceQubits[index]) {
            
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
        
        
        this.bitTapes.forEach(tape => {
            tape.clearSelection();
        });
        
        
        if (this.currentStep === 4) {
            this.selectedIndices = [];
            this.lastSelectedIndex = null;
            this.updateEveAttackPanel();
        }
    }
    
    handleEveQubitClick(elementData, event) {
        
        if (this.currentStep !== 4) return;
        
        
        const eveTape = this.bitTapes.get('eveQubits');
        if (eveTape && eveTape.selectedIndices) {
            this.selectedIndices = Array.from(eveTape.selectedIndices);
            this.lastSelectedIndex = elementData.index;
            this.updateEveAttackPanel();
            
            
            this.updateEveQubitDetails();
        }
    }
    
    handleEveMultiSelect(indices) {
        
        if (this.currentStep !== 4) return;
        
        this.selectedIndices = [...indices];
        this.updateEveAttackPanel();
        
        
        this.updateEveQubitDetails();
        
        
        if (indices.length > 0) {
            this.lastSelectedIndex = indices[indices.length - 1];
        }
    }
    
    updateEveQubitDetails() {
        
        if (!this.qubitDetails || this.currentStep !== 4) return;
        
        if (this.selectedIndices.length === 0) {
            
            this.qubitDetails.setSelectedElement(null);
            return;
        }
        
        
        const indexToShow = this.lastSelectedIndex !== null && this.selectedIndices.includes(this.lastSelectedIndex)
            ? this.lastSelectedIndex
            : this.selectedIndices[0];
        
        const qubit = this.state.channelQubits[indexToShow];
        if (!qubit) return;
        
        
        const elementData = {
            type: 'qubit',
            index: indexToShow,
            basis: qubit.basis,
            alpha: qubit.alpha,
            beta: qubit.beta,
            symbol: qubit.symbol,
            tapeTitle: 'Кубиты в канале (Ева видит)'
        };
        
        
        this.qubitDetails.setSelectedElement(elementData);
        this.qubitDetails.setAlternateIndices(this.selectedIndices);
    }
    
    createEveAttackPanel(container) {
        
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
        
        const attackTypeSelect = document.getElementById('eve-attack-type');
        if (attackTypeSelect) {
            attackTypeSelect.addEventListener('change', (e) => {
                this.eveAttackState.attackType = e.target.value;
            });
        }
        
        
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
        
        
        const randomBasisCheckbox = document.getElementById('eve-random-basis');
        if (randomBasisCheckbox) {
            randomBasisCheckbox.addEventListener('change', (e) => {
                this.eveAttackState.useRandomBasis = e.target.checked;
                this.updateEveAttackPanel();
            });
        }
        
        
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
        
        
        const results = [];
        for (const index of this.selectedIndices) {
            if (index < 0 || index >= this.state.channelQubits.length) {
                continue;
            }
            
            const currentBasis = useRandomBasis 
                ? (Math.random() < 0.5 ? 'Z' : 'X')
                : basis;
            
            
            const measuredBit = this.measureInBasis(this.state.channelQubits[index], currentBasis);
            
            
            const newQubit = this.prepareBasisQubit(measuredBit, currentBasis, index);
            
            
            this.state.channelQubits[index] = newQubit;
            
            
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
        
        
        this.updateBottomPanel();
        
        
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
        
        
        this.selectedIndices = [];
        this.lastSelectedIndex = null;
        this.eveAttackState.isApplying = false;
        this.updateEveAttackPanel();
        
        
        if (this.qubitDetails) {
            this.qubitDetails.setSelectedElement(null);
        }
        
        
        if (eveTape) {
            eveTape.setSelectedIndices([]);
        }
    }
    
    measureInBasis(qubit, basis) {
        
        const alphaReal = qubit.alpha.real || 0;
        const alphaImag = qubit.alpha.imag || 0;
        const betaReal = qubit.beta.real || 0;
        const betaImag = qubit.beta.imag || 0;
        
        if (basis === 'X') {
            
            
            const alphaPlusReal = (alphaReal + betaReal) / Math.sqrt(2);
            const alphaPlusImag = (alphaImag + betaImag) / Math.sqrt(2);
            const probPlus = alphaPlusReal * alphaPlusReal + alphaPlusImag * alphaPlusImag;
            return Math.random() >= probPlus; 
        } else {
            
            
            const prob0 = alphaReal * alphaReal + alphaImag * alphaImag;
            return Math.random() >= prob0; 
        }
    }
    
    prepareBasisQubit(bit, basis, index) {
        
        const sqrtTwo = Math.sqrt(2);
        const oneOverSqrtTwo = 1 / sqrtTwo;
        
        if (basis === 'X') {
            if (!bit) {
                
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
            
            if (!bit) {
                
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
        
        this.stepHeaderContainer = document.getElementById('step-header-container');
        if (!this.stepHeaderContainer) {
            
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
        
        
        if (stepNumber === 0) {
            this.stepHeaderContainer.style.display = 'none';
            return;
        }
        
        
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
    }
    
    registerStep(stepNumber, title, renderFunction) {
        this.steps[stepNumber] = {
            number: stepNumber,
            title,
            render: renderFunction
        };
    }
    
    renderStep0() {
        
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
        
        const stepContainer = this.getOrCreateStepContainer(1);
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        const delta = (typeof panelState !== 'undefined' && panelState.config && panelState.config.delta) ? panelState.config.delta : 0.5;
        
        
        const totalBits = Math.ceil((4 + delta) * n);
        
        
        if (this.state.aliceBits.length !== totalBits) {
            this.state.aliceBits = this.generateRandomBits(totalBits);
            this.saveState();
            this.addEvent(`Сгенерировано ${totalBits} случайных битов (${4 + delta} × ${n})`, 'info');
        } else if (this.state.aliceBits.length === 0) {
            
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
        
        
        const tapeContainer = stepContainer.querySelector('#alice-bits-tape-container');
        if (tapeContainer) {
            
            setTimeout(() => {
                const bitTape = new BitTape(tapeContainer, {
                    title: 'Биты Алисы',
                    variant: 'classical',
                    bits: this.state.aliceBits,
                    shouldAnimate: true,
                    onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                });
                this.bitTapes.set('aliceBits', bitTape);
                
                
                if (!this.stepBitTapes.has(1)) {
                    this.stepBitTapes.set(1, []);
                }
                this.stepBitTapes.get(1).push(bitTape);
            }, 50);
        }
    }
    
    renderStep2() {
        
        const stepContainer = this.getOrCreateStepContainer(2);
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        const delta = (typeof panelState !== 'undefined' && panelState.config && panelState.config.delta) ? panelState.config.delta : 0.5;
        const totalBits = Math.ceil((4 + delta) * n);
        
        
        if (this.state.aliceBits.length === 0 || this.state.aliceBits.length !== totalBits) {
            this.state.aliceBits = this.generateRandomBits(totalBits);
            this.saveState();
        }
        
        
        const bitsCount = this.state.aliceBits.length;
        if (this.state.aliceBases.length === 0 || this.state.aliceBases.length !== bitsCount) {
            this.state.aliceBases = this.generateRandomBases(bitsCount);
            this.saveState();
            this.addEvent(`Выбрано ${bitsCount} случайных базисов`, 'info');
        }
        
        
        const displayBases = this.convertBasesToDisplay(this.state.aliceBases);
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(2)}</p>
                <div id="alice-bases-tape-container" class="mt-4"></div>
            </div>
        `;
        
        
        const tapeContainer = stepContainer.querySelector('#alice-bases-tape-container');
        if (tapeContainer) {
            
            setTimeout(() => {
                const bitTape = new BitTape(tapeContainer, {
                    title: 'Алиса: Базисы',
                    variant: 'basis',
                    bits: displayBases,
                    shouldAnimate: true,
                    onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                });
                this.bitTapes.set('aliceBases', bitTape);
                
                
                if (!this.stepBitTapes.has(2)) {
                    this.stepBitTapes.set(2, []);
                }
                this.stepBitTapes.get(2).push(bitTape);
            }, 50);
        }
    }
    
    renderStep3() {
        
        const stepContainer = this.getOrCreateStepContainer(3);
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        const delta = (typeof panelState !== 'undefined' && panelState.config && panelState.config.delta) ? panelState.config.delta : 0.5;
        const totalBits = Math.ceil((4 + delta) * n);
        
        
        if (!this.state.aliceBits || this.state.aliceBits.length === 0 || this.state.aliceBits.length !== totalBits) {
            this.state.aliceBits = this.generateRandomBits(totalBits);
        }
        const bitsCount = this.state.aliceBits.length;
        if (!this.state.aliceBases || this.state.aliceBases.length === 0 || this.state.aliceBases.length !== bitsCount) {
            this.state.aliceBases = this.generateRandomBases(bitsCount);
        }
        
        
        if (!this.state.aliceQubits) {
            this.state.aliceQubits = [];
        }
        
        
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
                
                
                if (!this.stepBitTapes.has(3)) {
                    this.stepBitTapes.set(3, []);
                }
                this.stepBitTapes.get(3).push(bitTape);
            }, 50);
        }
    }
    
    renderStep4() {
        
        const stepContainer = this.getOrCreateStepContainer(4);
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        
        
        if (!this.state.aliceQubits || this.state.aliceQubits.length === 0) {
            
            this.addEvent('Ошибка: кубиты Алисы не созданы. Вернитесь к шагу 3.', 'error');
            return;
        }
        
        
        if (!this.state.channelQubits || this.state.channelQubits.length === 0) {
            this.state.channelQubits = JSON.parse(JSON.stringify(this.state.aliceQubits));
        }
        
        
        if (!this.state.eveAttacks) {
            this.state.eveAttacks = {};
        }
        
        
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
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(4)}</p>
                <div id="eve-qubits-tape-container" class="mt-4"></div>
                <div id="eve-attack-panel-container" class="mt-6"></div>
            </div>
        `;
        
        
        const tapeContainer = stepContainer.querySelector('#eve-qubits-tape-container');
        if (tapeContainer) {
            setTimeout(() => {
                const bitTape = new BitTape(tapeContainer, {
                    title: 'Кубиты в канале (Ева видит)',
                    variant: 'qubit',
                    bits: eveQubits,
                    shouldAnimate: true,
                    allowMultiSelect: true, 
                    hideBasis: true, 
                    onElementClick: (elementData, event) => this.handleEveQubitClick(elementData, event),
                    onMultiSelect: (indices) => this.handleEveMultiSelect(indices)
                });
                this.bitTapes.set('eveQubits', bitTape);
                
                
                if (!this.stepBitTapes.has(4)) {
                    this.stepBitTapes.set(4, []);
                }
                this.stepBitTapes.get(4).push(bitTape);
                
                
                this.createEveAttackPanel(stepContainer.querySelector('#eve-attack-panel-container'));
            }, 50);
        }
    }
    
    renderStep5() {
        
        const stepContainer = this.getOrCreateStepContainer(5);
        
        
        if (!this.state.channelQubits || this.state.channelQubits.length === 0) {
            
            this.addEvent('Ошибка: кубиты в канале не созданы. Вернитесь к шагу 4.', 'error');
            return;
        }
        
        
        const existingBobTape = this.bitTapes.get('bobQubits');
        
        if (existingBobTape && stepContainer.querySelector('#bob-qubits-tape-container')) {
            
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
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(5)}</p>
                <div id="bob-qubits-tape-container" class="mt-4"></div>
            </div>
        `;
        
        
        const tapeContainer = stepContainer.querySelector('#bob-qubits-tape-container');
        if (tapeContainer) {
            setTimeout(() => {
                const bitTape = new BitTape(tapeContainer, {
                    title: 'Кубиты, полученные Бобом',
                    variant: 'qubit',
                    bits: bobQubits,
                    shouldAnimate: true,
                    allowMultiSelect: false, 
                    hideBasis: true, 
                    onElementClick: (elementData, event) => this.handleBobQubitClick(elementData, event)
                });
                this.bitTapes.set('bobQubits', bitTape);
                
                
                if (!this.stepBitTapes.has(5)) {
                    this.stepBitTapes.set(5, []);
                }
                this.stepBitTapes.get(5).push(bitTape);
            }, 50);
        }
    }
    
    handleBobQubitClick(elementData, event) {
        
        
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
        
        
        this.selectedElement = elementData;
        this.selectedElementStep = 5; 
        
        
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
                this.qubitDetails.setAlternateIndices([]); 
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
        
        
        const displayIndex = elementData.displayIndex !== undefined ? elementData.displayIndex : elementData.index;
        this.addEvent(`Выбран кубит #${displayIndex} из "Кубиты, полученные Бобом"`, 'info');
    }
    
    renderStep6() {
        
        const stepContainer = this.getOrCreateStepContainer(6);
        
        
        if (!this.state.channelQubits || this.state.channelQubits.length === 0) {
            this.addEvent('Ошибка: кубиты в канале не созданы. Вернитесь к шагу 4.', 'error');
            return;
        }
        
        const n = this.state.channelQubits.length;
        
        
        if (!this.state.bobBases || this.state.bobBases.length === 0 || this.state.bobBases.length !== n) {
            this.state.bobBases = this.generateRandomBases(n);
            this.saveState();
            this.addEvent(`Боб выбрал ${n} случайных базисов`, 'info');
        }
        
        
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
        
        
        const displayBases = this.convertBasesToDisplay(this.state.bobBases);
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(6)}</p>
                <div id="bob-bases-tape-container" class="mt-4 mb-6"></div>
                <div id="bob-bits-tape-container" class="mt-4"></div>
            </div>
        `;
        
        
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
                
                
                if (!this.stepBitTapes.has(6)) {
                    this.stepBitTapes.set(6, []);
                }
                this.stepBitTapes.get(6).push(basesTape);
                
                this.restoreStep6Selection();
            }, 50);
        }
        
        
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
        
        const stepContainer = this.getOrCreateStepContainer(7);
        
        
        if (!this.state.aliceBases || this.state.aliceBases.length === 0 ||
            !this.state.bobBases || this.state.bobBases.length === 0 ||
            !this.state.aliceBits || this.state.aliceBits.length === 0 ||
            !this.state.bobBits || this.state.bobBits.length === 0) {
            this.addEvent('Ошибка: базисы или биты не готовы. Вернитесь к предыдущим шагам.', 'error');
            return;
        }
        
        const totalBits = this.state.aliceBases.length;
        const n = (typeof panelState !== 'undefined' && panelState.config && panelState.config.n) ? panelState.config.n : 10;
        const minRequiredBits = 2 * n; 
        
        
        const matchingIndices = [];
        const nonMatchingIndices = [];
        for (let i = 0; i < totalBits; i++) {
            if (this.state.aliceBases[i] === this.state.bobBases[i]) {
                matchingIndices.push(i);
            } else {
                nonMatchingIndices.push(i);
            }
        }
        
        
        if (matchingIndices.length < minRequiredBits) {
            
            this.state.isProtocolAborted = true;
            
            
            if (this.isRunning) {
                this.stopAutoPlay();
            }
            
            const message = `Недостаточно совпадающих базисов. Получено ${matchingIndices.length} совпадений, требуется минимум ${minRequiredBits}.`;
            this.addEvent(`Протокол прерван: ${message}`, 'error');
            
            
            if (typeof window.showProtocolAbortedNotification === 'function') {
                window.showProtocolAbortedNotification(message);
            }
            
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
            
            this.saveState();
            return;
        }
        
        
        const keptIndices = matchingIndices.slice(0, minRequiredBits);
        
        
        const aliceBasesDisplay = this.convertBasesToDisplay(this.state.aliceBases);
        const bobBasesDisplay = this.convertBasesToDisplay(this.state.bobBases);
        
        
        const aliceMatchingBits = keptIndices.map(i => ({
            value: this.state.aliceBits[i],
            originalIndex: i
        }));
        const bobMatchingBits = keptIndices.map(i => ({
            value: this.state.bobBits[i],
            originalIndex: i
        }));
        
        
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
        
        
        const basesContainer = stepContainer.querySelector('#bases-comparison-container');
        if (basesContainer) {
            
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
                
                const aliceBasesContainer = basesContainer.querySelector('#alice-bases-comparison-tape-container');
                if (aliceBasesContainer) {
                    const aliceBasesTape = new BitTape(aliceBasesContainer, {
                        title: 'Алиса: Базисы',
                        variant: 'basis',
                        bits: aliceBasesDisplay,
                        shouldAnimate: true,
                        highlightIndices: nonMatchingIndices, 
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('aliceBasesComparison', aliceBasesTape);
                    
                    if (!this.stepBitTapes.has(7)) {
                        this.stepBitTapes.set(7, []);
                    }
                    this.stepBitTapes.get(7).push(aliceBasesTape);
                }
                
                
                const bobBasesContainer = basesContainer.querySelector('#bob-bases-comparison-tape-container');
                if (bobBasesContainer) {
                    const bobBasesTape = new BitTape(bobBasesContainer, {
                        title: 'Боб: Базисы',
                        variant: 'basis',
                        bits: bobBasesDisplay,
                        shouldAnimate: true,
                        highlightIndices: nonMatchingIndices, 
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
        
        
        this.state.keptIndices = keptIndices;
        this.state.aliceMatchingBits = aliceMatchingBits;
        this.state.bobMatchingBits = bobMatchingBits;
        this.saveState();
        this.addEvent(`Сравнение базисов завершено. Совпало: ${matchingIndices.length}. Оставлено: ${keptIndices.length} битов.`, 'info');
        
        
        this.updateBottomPanel();
    }
    
    renderStep8() {
        
        const stepContainer = this.getOrCreateStepContainer(8);
        
        
        if (!this.state.keptIndices || this.state.keptIndices.length === 0 ||
            !this.state.aliceMatchingBits || this.state.aliceMatchingBits.length === 0 ||
            !this.state.bobMatchingBits || this.state.bobMatchingBits.length === 0) {
            this.addEvent('Ошибка: данные для проверки отсутствуют. Вернитесь к шагу 7.', 'error');
            return;
        }
        
        const eveCheckSubsetLen = (typeof window !== 'undefined' && window.panelState && window.panelState.config && window.panelState.config.eve_check_subset_len) 
            ? window.panelState.config.eve_check_subset_len 
            : ((typeof panelState !== 'undefined' && panelState.config && panelState.config.eve_check_subset_len) 
                ? panelState.config.eve_check_subset_len 
                : 30);
        
        
        
        let maxEveCheckErrors = 2; 
        
        
        
        if (typeof window !== 'undefined' && window.panelState && window.panelState.config) {
            const configValue = window.panelState.config.max_eve_check_errors;
            
            if (configValue !== undefined && configValue !== null && configValue !== '' && !isNaN(Number(configValue))) {
                maxEveCheckErrors = Number(configValue);
            }
        } else if (typeof panelState !== 'undefined' && panelState && panelState.config) {
            const configValue = panelState.config.max_eve_check_errors;
            if (configValue !== undefined && configValue !== null && configValue !== '' && !isNaN(Number(configValue))) {
                maxEveCheckErrors = Number(configValue);
            }
        }
        
        
        
        if (maxEveCheckErrors !== 2 && typeof window !== 'undefined' && window.panelState && window.panelState.config) {
            const directValue = window.panelState.config.max_eve_check_errors;
            if (directValue !== undefined && directValue !== null && directValue !== '' && !isNaN(Number(directValue))) {
                maxEveCheckErrors = Number(directValue);
            }
        }
        
        
        console.log('Step 8: maxEveCheckErrors DEBUG:', {
            windowExists: typeof window !== 'undefined',
            windowPanelStateExists: typeof window !== 'undefined' && !!window.panelState,
            windowConfigExists: typeof window !== 'undefined' && window.panelState && !!window.panelState.config,
            directValue: typeof window !== 'undefined' && window.panelState && window.panelState.config ? window.panelState.config.max_eve_check_errors : 'N/A',
            panelStateExists: typeof panelState !== 'undefined',
            panelStateConfigExists: typeof panelState !== 'undefined' && panelState && !!panelState.config,
            panelStateValue: typeof panelState !== 'undefined' && panelState && panelState.config ? panelState.config.max_eve_check_errors : 'N/A',
            finalValue: maxEveCheckErrors,
            finalType: typeof maxEveCheckErrors
        });
        
        
        if (!this.state.eveCheckIndices || this.state.eveCheckIndices.length === 0) {
            const availableBits = this.state.keptIndices.length;
            const subsetSize = Math.min(eveCheckSubsetLen, availableBits);
            
            
            const allIndices = Array.from({ length: availableBits }, (_, i) => i);
            const shuffled = [...allIndices].sort(() => Math.random() - 0.5);
            this.state.eveCheckIndices = shuffled.slice(0, subsetSize).sort((a, b) => a - b);
            this.saveState();
        }
        
        const checkIndices = this.state.eveCheckIndices;
        
        
        const aliceCheckBits = checkIndices.map(i => ({
            value: this.state.aliceMatchingBits[i].value,
            originalIndex: this.state.aliceMatchingBits[i].originalIndex
        }));
        const bobCheckBits = checkIndices.map(i => ({
            value: this.state.bobMatchingBits[i].value,
            originalIndex: this.state.bobMatchingBits[i].originalIndex
        }));
        
        
        let errorCount = 0;
        const errorIndices = [];
        for (let i = 0; i < checkIndices.length; i++) {
            if (aliceCheckBits[i].value !== bobCheckBits[i].value) {
                errorCount++;
                errorIndices.push(i);
            }
        }
        
        
        const qber = checkIndices.length > 0 ? (errorCount / checkIndices.length) * 100 : 0;
        
        
        
        
        let finalMaxEveCheckErrors = maxEveCheckErrors;
        if (typeof window !== 'undefined' && window.panelState && window.panelState.config) {
            const finalValue = window.panelState.config.max_eve_check_errors;
            if (finalValue !== undefined && finalValue !== null && finalValue !== '' && !isNaN(Number(finalValue))) {
                finalMaxEveCheckErrors = Number(finalValue);
            }
        }
        
        
        
        
        if (errorCount > finalMaxEveCheckErrors) {
            
            this.state.isProtocolAborted = true;
            
            
            if (this.isRunning) {
                this.stopAutoPlay();
            }
            
            const message = `Обнаружено слишком много ошибок при проверке на вмешательство Евы. Обнаружено ${errorCount} ошибок из ${checkIndices.length} проверенных битов, допустимо максимум ${finalMaxEveCheckErrors}. QBER = ${qber.toFixed(2)}%.`;
            this.addEvent(`Протокол прерван: ${message}`, 'error');
            
            
            if (typeof window.showProtocolAbortedNotification === 'function') {
                window.showProtocolAbortedNotification(message);
            }
            stepContainer.innerHTML = `
                <div class="step-content p-6 rounded-2xl bg-red-900/40 border border-red-600/50 backdrop-blur-sm">
                    <p class="text-red-300 text-lg font-semibold mb-2">Протокол прерван</p>
                    <p class="text-red-200 mb-4">${message}</p>
                    <p class="text-red-300 text-sm mb-2">Проверено битов: ${checkIndices.length}</p>
                    <p class="text-red-300 text-sm mb-2">Обнаружено ошибок: ${errorCount}</p>
                    <p class="text-red-300 text-sm mb-2">Максимум допустимо ошибок: ${finalMaxEveCheckErrors}</p>
                    <p class="text-red-300 text-sm mb-4">QBER: ${qber.toFixed(2)}% (информационная метрика)</p>
                    
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
                    
                    
                    const aliceErrorContainer = errorContainer.querySelector('#alice-error-bits-tape-container');
                    if (aliceErrorContainer) {
                        const aliceErrorTape = new BitTape(aliceErrorContainer, {
                            title: 'Алиса: Биты для проверки',
                            variant: 'classical',
                            bits: aliceCheckBits,
                            shouldAnimate: false,
                            highlightIndices: errorIndices, 
                            onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                        });
                        this.bitTapes.set('aliceErrorBits', aliceErrorTape);
                        
                        if (!this.stepBitTapes.has(8)) {
                            this.stepBitTapes.set(8, []);
                        }
                        this.stepBitTapes.get(8).push(aliceErrorTape);
                    }
                    
                    
                    const bobErrorContainer = errorContainer.querySelector('#bob-error-bits-tape-container');
                    if (bobErrorContainer) {
                        const bobErrorTape = new BitTape(bobErrorContainer, {
                            title: 'Боб: Биты для проверки',
                            variant: 'classical',
                            bits: bobCheckBits,
                            shouldAnimate: false,
                            highlightIndices: errorIndices, 
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
        
        
        const matchingIndices = [];
        for (let i = 0; i < checkIndices.length; i++) {
            if (aliceCheckBits[i].value === bobCheckBits[i].value) {
                matchingIndices.push(i);
            }
        }
        
        
        
        stepContainer.innerHTML = `
            <div class="step-content p-6 rounded-2xl bg-green-900/40 border border-green-600/50 backdrop-blur-sm">
                <p class="text-green-300 text-lg font-semibold mb-2">✓ Проверка пройдена</p>
                <p class="text-green-200 mb-4">
                    Алиса выбрала ${checkIndices.length} битов для проверки на вмешательство Евы.
                    Обнаружено ошибок: ${errorCount} из ${checkIndices.length}.
                    Максимум допустимо: ${finalMaxEveCheckErrors}.
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
                
                
                const aliceSuccessContainer = successContainer.querySelector('#alice-success-bits-tape-container');
                if (aliceSuccessContainer) {
                    const aliceSuccessTape = new BitTape(aliceSuccessContainer, {
                        title: 'Алиса: Биты для проверки',
                        variant: 'classical',
                        bits: aliceCheckBits,
                        shouldAnimate: false,
                        highlightIndices: errorIndices, 
                        matchIndices: matchingIndices, 
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('aliceCheckBits', aliceSuccessTape);
                    
                    if (!this.stepBitTapes.has(8)) {
                        this.stepBitTapes.set(8, []);
                    }
                    this.stepBitTapes.get(8).push(aliceSuccessTape);
                }
                
                
                const bobSuccessContainer = successContainer.querySelector('#bob-success-bits-tape-container');
                if (bobSuccessContainer) {
                    const bobSuccessTape = new BitTape(bobSuccessContainer, {
                        title: 'Боб: Биты для проверки',
                        variant: 'classical',
                        bits: bobCheckBits,
                        shouldAnimate: false,
                        highlightIndices: errorIndices, 
                        matchIndices: matchingIndices, 
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
        
        
        
        
        if (errorCount <= finalMaxEveCheckErrors) {
            
            const remainingIndices = [];
            const checkIndicesSet = new Set(checkIndices);
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
            
            
            this.state.eveCheckErrorCount = errorCount;
            this.state.eveCheckLength = checkIndices.length;
            
            
            console.log('Step 8: Saved reconciliation data', {
                remainingIndices: remainingIndices.length,
                aliceBits: this.state.aliceReconciliationBits.length,
                bobBits: this.state.bobReconciliationBits.length,
                keptIndices: this.state.keptIndices.length,
                checkIndices: checkIndices.length,
                errorCount: errorCount,
                errorRate: checkIndices.length > 0 ? (errorCount / checkIndices.length) : 0,
                qber: checkIndices.length > 0 ? ((errorCount / checkIndices.length) * 100).toFixed(2) + '%' : '0%'
            });
        } else {
            
            this.state.eveCheckErrorCount = errorCount;
            this.state.eveCheckLength = checkIndices.length;
            console.log('Step 8: Protocol aborted, but saving QBER data', {
                errorCount: errorCount,
                checkLength: checkIndices.length,
                qber: qber.toFixed(2) + '%'
            });
        }
        
        this.saveState();
        this.addEvent(`Проверка на вмешательство Евы завершена. Проверено: ${checkIndices.length} битов. Ошибок: ${errorCount}.`, errorCount > finalMaxEveCheckErrors ? 'error' : 'info');
        
        
        
        this.updateBottomPanel();
    }
    
    renderStep9() {
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        const stepContainer = this.getOrCreateStepContainer(9);
        
        
        stepContainer.innerHTML = '';
        
        
        if (!this.state.aliceReconciliationBits || this.state.aliceReconciliationBits.length === 0 ||
            !this.state.bobReconciliationBits || this.state.bobReconciliationBits.length === 0) {
            
            
            if (this.state.keptIndices && this.state.keptIndices.length > 0 &&
                this.state.aliceMatchingBits && this.state.aliceMatchingBits.length > 0 &&
                this.state.bobMatchingBits && this.state.bobMatchingBits.length > 0) {
                
                
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
        
        
        
        
        
        
        
        
        
        
        
        
        const keyLength = this.state.aliceReconciliationBits.length;
        let blockSize;
        if (keyLength < 50) {
            blockSize = Math.max(5, Math.floor(keyLength / 3)); 
        } else if (keyLength < 200) {
            blockSize = 20; 
        } else {
            blockSize = Math.min(50, Math.max(20, Math.floor(Math.sqrt(keyLength)))); 
        }
        
        console.log('Information Reconciliation - выбор размера блока:', {
            keyLength: keyLength,
            blockSize: blockSize,
            numBlocks: Math.ceil(keyLength / blockSize),
            expectedLeakage: Math.ceil(keyLength / blockSize) + ' битов (примерно)'
        });
        
        
        
        if (!this.state.reconciledAliceBits || !this.state.reconciledBobBits || 
            this.state.reconciledAliceBits.length === 0 || this.state.reconciledBobBits.length === 0) {
            
            let aliceBits = this.state.aliceReconciliationBits.map(b => typeof b === 'object' && b !== null && b.value !== undefined ? b.value : b);
            let bobBits = this.state.bobReconciliationBits.map(b => typeof b === 'object' && b !== null && b.value !== undefined ? b.value : b);
            
            
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
            
            
            
            
            
            
            
            
            
            
            
            const numBlocks = Math.ceil(aliceBits.length / blockSize);
            const parityRevealed = []; 
            
            
            const correctErrorsInBlock = (blockStart, blockEnd) => {
                if (blockStart >= blockEnd) return;
                
                const blockLength = blockEnd - blockStart;
                const aliceBlock = aliceBits.slice(blockStart, blockEnd);
                const bobBlock = bobBits.slice(blockStart, blockEnd);
                
                
                const aliceParity = aliceBlock.reduce((sum, bit) => sum ^ bit, 0);
                const bobParity = bobBlock.reduce((sum, bit) => sum ^ bit, 0);
                
                
                parityRevealed.push({
                    blockIndex: blockStart,
                    start: blockStart,
                    end: blockEnd,
                    aliceParity: aliceParity,
                    bobParity: bobParity
                });
                
                
                if (aliceParity !== bobParity) {
                    if (blockLength === 1) {
                        
                        bobBits[blockStart] = bobBits[blockStart] ^ 1; 
                        return;
                    }
                    
                    
                    const mid = blockStart + Math.floor(blockLength / 2);
                    correctErrorsInBlock(blockStart, mid);
                    correctErrorsInBlock(mid, blockEnd);
                }
            };
            
            
            for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
                const start = blockIdx * blockSize;
                const end = Math.min(start + blockSize, aliceBits.length);
                correctErrorsInBlock(start, end);
            }
            
            
            let errorsAfterReconciliation = 0;
            for (let i = 0; i < aliceBits.length; i++) {
                if (aliceBits[i] !== bobBits[i]) {
                    errorsAfterReconciliation++;
                }
            }
            
            if (errorsAfterReconciliation > 0) {
                console.warn(`После reconciliation осталось ${errorsAfterReconciliation} несовпадений`);
                
                for (let i = 0; i < aliceBits.length; i++) {
                    if (aliceBits[i] !== bobBits[i]) {
                        bobBits[i] = aliceBits[i]; 
                    }
                }
            }
            
            
            this.state.reconciledAliceBits = aliceBits.map(b => typeof b === 'object' && b !== null && b.value !== undefined ? b.value : (b === true ? 1 : (b === false ? 0 : b)));
            this.state.reconciledBobBits = bobBits.map(b => typeof b === 'object' && b !== null && b.value !== undefined ? b.value : (b === true ? 1 : (b === false ? 0 : b)));
            this.state.parityRevealed = parityRevealed;
            this.saveState();
        }
        
        
        const reconciledAlice = (this.state.reconciledAliceBits || []).map(b => 
            typeof b === 'object' && b !== null && b.value !== undefined ? b.value : (b === true ? 1 : (b === false ? 0 : b))
        );
        const reconciledBob = (this.state.reconciledBobBits || []).map(b => 
            typeof b === 'object' && b !== null && b.value !== undefined ? b.value : (b === true ? 1 : (b === false ? 0 : b))
        );
        const parityRevealed = this.state.parityRevealed || [];
        
        
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
        
        
        
        if (!this.state.finalKey || this.state.finalKey.length === 0) {
            
            const n = reconciledAlice.length;
            
            if (n === 0) {
                console.error('Ошибка: нет данных для privacy amplification (n = 0)');
                stepContainer.innerHTML = `
                    <div class="step-content p-6 rounded-2xl bg-red-900/40 border border-red-600/50 backdrop-blur-sm">
                        <p class="text-red-300 text-lg font-semibold mb-2">Ошибка</p>
                        <p class="text-red-200 mb-4">Нет данных для privacy amplification. Длина сверенного ключа равна нулю.</p>
                    </div>
                `;
                return;
            }
            
            
            
            
            
            
            
            
            
            
            
            
            
            const leakEC = this.state.parityRevealed ? this.state.parityRevealed.length : 0;
            
            
            if (leakEC > n * 0.5) {
                console.warn('Предупреждение: утечка при Error Correction слишком большая:', {
                    leakEC: leakEC,
                    n: n,
                    ratio: (leakEC / n * 100).toFixed(1) + '%'
                });
            }
            
            
            
            let errorRate = 0.01; 
            if (this.state.eveCheckLength > 0 && this.state.eveCheckErrorCount !== undefined) {
                
                errorRate = this.state.eveCheckErrorCount / this.state.eveCheckLength;
            } else {
                
                const metrics = this.getMetrics();
                if (metrics.qber > 0) {
                    errorRate = metrics.qber / 100; 
                }
            }
            
            
            errorRate = Math.max(0.001, Math.min(0.2, errorRate));
            
            console.log('Privacy Amplification - используемый QBER:', {
                qber_percent: (errorRate * 100).toFixed(2) + '%',
                errorRate: errorRate,
                source: this.state.eveCheckLength > 0 ? 'шаг 8' : 'метрики/по умолчанию'
            });
            
            
            const binaryEntropy = (p) => {
                if (p <= 0 || p >= 1) return 0;
                return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
            };
            
            
            
            const hMin = Math.max(0.5, 1 - binaryEntropy(errorRate));
            
            
            const securityParameter = 0.01; 
            const securityTerm = 2 * Math.log2(1 / securityParameter); 
            
            
            let m = Math.floor(n * hMin - leakEC - securityTerm);
            
            console.log('Privacy Amplification - расчёт (до проверок):', {
                n: n,
                errorRate: errorRate.toFixed(4),
                hMin: hMin.toFixed(4),
                n_times_hMin: (n * hMin).toFixed(2),
                leakEC: leakEC,
                securityTerm: securityTerm.toFixed(2),
                calculatedM: m
            });
            
            
            
            
            if (m <= 0 || m >= n || !Number.isFinite(m)) {
                console.warn('Расчёт дал невалидное m, используем упрощённую оценку:', m);
                
                
                m = Math.floor(n * (1 - errorRate) - leakEC - 10);
                
                
                if (m <= 0 || m >= n) {
                    
                    m = Math.max(1, Math.min(n - 1, Math.floor(n * 0.65)));
                }
            }
            
            
            m = Math.max(1, Math.min(n - 1, m));
            
            console.log('Privacy Amplification - финальный результат:', {
                n: n,
                m: m,
                compression: ((1 - m / n) * 100).toFixed(1) + '%',
                qber: (errorRate * 100).toFixed(2) + '%',
                leakEC: leakEC,
                hMin: hMin.toFixed(4)
            });
            
            
            if (!this.state.hashSeed) {
                this.state.hashSeed = Math.floor(Math.random() * 0xFFFFFFFF);
            }
            
            
            const onesCount = reconciledAlice.filter(b => b === 1).length;
            const zerosCount = reconciledAlice.length - onesCount;
            const onesRatio = (onesCount / reconciledAlice.length * 100).toFixed(1);
            
            console.log('Privacy Amplification - входной ключ:', {
                length: reconciledAlice.length,
                ones: onesCount,
                zeros: zerosCount,
                onesRatio: onesRatio + '%',
                first20Bits: reconciledAlice.slice(0, 20),
                sample: reconciledAlice.slice(0, Math.min(50, reconciledAlice.length))
            });
            
            
            
            const reconciledAliceNumbers = reconciledAlice.map(b => {
                const val = typeof b === 'object' && b !== null && b.value !== undefined ? b.value : b;
                return val === true ? 1 : (val === false ? 0 : val);
            });
            
            console.log('Privacy Amplification - передаём в функцию:', {
                length: reconciledAliceNumbers.length,
                first20: reconciledAliceNumbers.slice(0, 20),
                ones: reconciledAliceNumbers.filter(b => b === 1).length,
                zeros: reconciledAliceNumbers.filter(b => b === 0).length,
                m: m,
                seed: this.state.hashSeed
            });
            
            const finalKey = this.privacyAmplification(reconciledAliceNumbers, m, this.state.hashSeed);
            
            if (!finalKey || finalKey.length === 0 || finalKey.length !== m) {
                console.error('Ошибка: privacyAmplification вернул неверный результат', {
                    inputLength: reconciledAlice.length,
                    expectedOutputLength: m,
                    actualOutputLength: finalKey ? finalKey.length : 0,
                    seed: this.state.hashSeed
                });
                stepContainer.innerHTML = `
                    <div class="step-content p-6 rounded-2xl bg-red-900/40 border border-red-600/50 backdrop-blur-sm">
                        <p class="text-red-300 text-lg font-semibold mb-2">Ошибка</p>
                        <p class="text-red-200 mb-4">Privacy amplification вернул неверный результат.</p>
                        <p class="text-red-300 text-sm">n: ${n}, m: ${m}, seed: ${this.state.hashSeed}</p>
                    </div>
                `;
                return;
            }
            
            
            const finalOnesCount = finalKey.filter(b => b === 1).length;
            const finalZerosCount = finalKey.length - finalOnesCount;
            const finalOnesRatio = (finalOnesCount / finalKey.length * 100).toFixed(1);
            
            console.log('Privacy Amplification - финальный ключ:', {
                length: finalKey.length,
                ones: finalOnesCount,
                zeros: finalZerosCount,
                onesRatio: finalOnesRatio + '%',
                first20Bits: finalKey.slice(0, 20),
                hex: this.bitsToHex(finalKey)
            });
            
            
            if (finalOnesRatio < 20 || finalOnesRatio > 80) {
                console.warn('Предупреждение: финальный ключ имеет неравномерное распределение битов:', {
                    onesRatio: finalOnesRatio + '%',
                    expectedRange: '40-60%',
                    note: 'Это может указывать на проблему с генерацией ключа или seed'
                });
            }
            
            
            const bobFinalKey = this.privacyAmplification(reconciledBob, m, this.state.hashSeed);
            
            if (finalKey.length !== bobFinalKey.length || finalKey.join('') !== bobFinalKey.join('')) {
                console.warn('Предупреждение: финальные ключи Алисы и Боба не совпадают');
                this.addEvent('Предупреждение: финальные ключи Алисы и Боба не совпадают после privacy amplification', 'warning');
            }
            
            this.state.finalKey = finalKey;
            this.state.finalKeyLength = m;
            this.saveState();
            
            
            this.updateBottomPanel();
        }
        
        stepContainer.innerHTML = `
            <div class="step-content">
                <p class="text-gray-300 mb-4">${this.getStepDescription(9)}</p>
                
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-blue-300 mb-3">1. Information Reconciliation (Информационная сверка)</h3>
                    <div id="reconciliation-container" class="mt-4"></div>
                </div>
                
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-purple-300 mb-3">2. Privacy Amplification (Усиление приватности)</h3>
                    <div id="amplification-container" class="mt-4"></div>
                </div>
            </div>
        `;
        
        
        const reconciliationContainer = stepContainer.querySelector('#reconciliation-container');
        if (reconciliationContainer) {
            setTimeout(() => {
                reconciliationContainer.innerHTML = `
                    <div class="bg-gray-800/40 rounded-lg p-4 mb-4">
                        <p class="text-sm text-gray-300 mb-2"><strong>Размер блока:</strong> ${blockSize} битов</p>
                        <p class="text-sm text-gray-300 mb-2"><strong>Всего блоков:</strong> ${parityRevealed.length} штук</p>
                        <p class="text-sm text-gray-300 mb-3"><strong>Утечка информации:</strong> ${parityRevealed.length} битов (каждый паритет = 1 бит утечки)</p>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <div id="alice-reconciled-tape-container"></div>
                        </div>
                        <div>
                            <div id="bob-reconciled-tape-container"></div>
                        </div>
                    </div>
                `;
                
                
                const aliceReconciledContainer = reconciliationContainer.querySelector('#alice-reconciled-tape-container');
                if (aliceReconciledContainer) {
                    
                    const aliceReconciledBits = reconciledAlice.map((bit, idx) => ({
                        value: bit,
                        originalIndex: idx
                    }));
                    const aliceReconciledTape = new BitTape(aliceReconciledContainer, {
                        title: 'Алиса: Биты после reconciliation',
                        variant: 'classical',
                        bits: aliceReconciledBits,
                        shouldAnimate: false,
                        onElementClick: (elementData, event) => this.handleElementClick(elementData, event)
                    });
                    this.bitTapes.set('aliceReconciled', aliceReconciledTape);
                    
                    if (!this.stepBitTapes.has(9)) {
                        this.stepBitTapes.set(9, []);
                    }
                    this.stepBitTapes.get(9).push(aliceReconciledTape);
                }
                
                
                const bobReconciledContainer = reconciliationContainer.querySelector('#bob-reconciled-tape-container');
                if (bobReconciledContainer) {
                    
                    const bobReconciledBits = reconciledBob.map((bit, idx) => ({
                        value: bit,
                        originalIndex: idx
                    }));
                    const bobReconciledTape = new BitTape(bobReconciledContainer, {
                        title: 'Боб: Биты после reconciliation',
                        variant: 'classical',
                        bits: bobReconciledBits,
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
        
        
        const amplificationContainer = stepContainer.querySelector('#amplification-container');
        if (amplificationContainer) {
            setTimeout(() => {
                const finalKeyHex = this.bitsToHex(this.state.finalKey);
                
                
                const finalOnes = this.state.finalKey.filter(b => {
                    const val = typeof b === 'object' && b !== null && b.value !== undefined ? b.value : b;
                    return val === 1;
                }).length;
                const finalZeros = this.state.finalKey.length - finalOnes;
                const onesRatio = (finalOnes / this.state.finalKey.length * 100).toFixed(1);
                
                amplificationContainer.innerHTML = `
                    <div class="bg-purple-900/40 border border-purple-600/50 rounded-lg p-4 mb-4">
                        <p class="text-purple-200 font-semibold mb-2">Финальный ключ</p>
                        <p class="text-sm text-purple-300 mb-1">Длина исходного ключа (n): ${reconciledAlice.length} битов</p>
                        <p class="text-sm text-purple-300 mb-1">Длина финального ключа (m): ${this.state.finalKeyLength} битов</p>
                        <p class="text-sm text-purple-300 mb-2">
                            Сжатие: ${reconciledAlice.length > 0 && this.state.finalKeyLength > 0 ? ((1 - this.state.finalKeyLength / reconciledAlice.length) * 100).toFixed(1) : 0}%
                        </p>
                        <p class="text-purple-200 font-semibold mt-3 mb-1">Ключ в hex формате:</p>
                        <p class="text-purple-100 font-mono text-base break-all bg-purple-950/50 p-3 rounded border border-purple-700/50">${finalKeyHex}</p>
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-gray-300 mb-2">Общий ключ Алисы и Боба (${this.state.finalKey.length} битов)</p>
                        <div id="final-key-tape-container"></div>
                    </div>
                `;
                
                
                const finalKeyContainer = amplificationContainer.querySelector('#final-key-tape-container');
                if (finalKeyContainer) {
                    
                    const finalKeyBits = this.state.finalKey.map((bit, idx) => ({
                        value: bit,
                        originalIndex: idx
                    }));
                    const finalKeyTape = new BitTape(finalKeyContainer, {
                        title: 'Финальный ключ',
                        variant: 'classical',
                        bits: finalKeyBits,
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
    
    
    
    
    findErrorInBlock(aliceBlock, bobBlock) {
        
        for (let i = 0; i < aliceBlock.length; i++) {
            if (aliceBlock[i] !== bobBlock[i]) {
                return i;
            }
        }
        return -1; 
    }
    
    
    
    
    privacyAmplification(rawKey, outputLength, seed) {
        
        const normalizedKey = rawKey.map(bit => {
            if (typeof bit === 'object' && bit !== null && bit.value !== undefined) {
                return bit.value;
            }
            return bit === true ? 1 : (bit === false ? 0 : bit);
        });
        
        const keyLength = normalizedKey.length;
        
        if (keyLength === 0 || outputLength === 0 || outputLength < 0) {
            console.warn('Privacy Amplification: невалидные параметры', {
                keyLength: keyLength,
                outputLength: outputLength,
                seed: seed
            });
            return [];
        }
        
        
        
        const length = Math.max(1, Math.min(outputLength, keyLength));
        const result = new Array(length).fill(0);
        
        
        
        for (let i = 0; i < keyLength; i++) {
            const bucket = i % length;
            const bit = normalizedKey[i];
            result[bucket] ^= bit; 
        }
        
        
        const onesInKey = normalizedKey.filter(b => b === 1).length;
        const onesInResult = result.filter(b => b === 1).length;
        
        console.log('Privacy Amplification (простой XOR-подход):', {
            inputLength: keyLength,
            inputOnes: onesInKey,
            outputLength: length,
            outputOnes: onesInResult,
            outputZeros: length - onesInResult,
            onesRatio: (onesInResult / length * 100).toFixed(1) + '%',
            firstBits: result.slice(0, Math.min(20, result.length))
        });
        
        return result;
    }
    
    
    bitsToHex(bits) {
        if (!bits || bits.length === 0) {
            return '0';
        }
        
        
        const normalizedBits = bits.map(bit => {
            if (typeof bit === 'object' && bit !== null && bit.value !== undefined) {
                return bit.value;
            }
            return bit === true ? 1 : (bit === false ? 0 : bit);
        });
        
        
        let hexString = '';
        for (let i = 0; i < normalizedBits.length; i += 8) {
            let byte = 0;
            const bitsInThisByte = Math.min(8, normalizedBits.length - i);
            
            
            
            
            for (let j = 0; j < bitsInThisByte; j++) {
                byte = (byte << 1) | (normalizedBits[i + j] & 1);
            }
            
            
            
            
            
            const hexByte = byte.toString(16).toUpperCase().padStart(2, '0');
            hexString += hexByte;
        }
        
        
        return hexString;
    }
    
    getOrCreateStepContainer(stepNumber) {
        if (!this.stepContainers.has(stepNumber)) {
            const container = document.createElement('div');
            container.className = `step-container step-${stepNumber} mb-6`;
            container.id = `step-${stepNumber}`;
            container.style.display = 'none'; 
            this.container.appendChild(container);
            this.stepContainers.set(stepNumber, container);
        }
        return this.stepContainers.get(stepNumber);
    }
    
    generateRandomBits(n) {
        return Array.from({ length: n }, () => Math.floor(Math.random() * 2));
    }
    
    generateRandomBases(n) {
        
        return Array.from({ length: n }, () => Math.random() < 0.5);
    }
    
    convertBasesToDisplay(bases) {
        
        
        return bases.map(basis => basis ? 'Z' : 'X');
    }
    
    encodeQubits(bits, bases) {
        
        
        const sqrtTwo = Math.sqrt(2);
        const oneOverSqrtTwo = 1 / sqrtTwo;
        
        return bits.map((bit, i) => {
            const basis = bases[i];
            let alpha, beta;
            let symbol;
            
            if (!basis) {
                
                if (!bit) {
                    
                    alpha = { real: oneOverSqrtTwo, imag: 0 };
                    beta = { real: oneOverSqrtTwo, imag: 0 };
                    symbol = '|+⟩';
                } else {
                    
                    alpha = { real: oneOverSqrtTwo, imag: 0 };
                    beta = { real: -oneOverSqrtTwo, imag: 0 };
                    symbol = '|−⟩';
                }
            } else {
                
                if (!bit) {
                    
                    alpha = { real: 1, imag: 0 };
                    beta = { real: 0, imag: 0 };
                    symbol = '|0⟩';
                } else {
                    
                    alpha = { real: 0, imag: 0 };
                    beta = { real: 1, imag: 0 };
                    symbol = '|1⟩';
                }
            }
            
            
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
        
        
        container.style.display = 'none';
        container.style.visibility = 'hidden';
        container.classList.remove('showing', 'hiding');
        container.style.willChange = '';
        if (callback) callback();
    }
    
    showStepWithAnimation(stepNumber) {
        const container = this.stepContainers.get(stepNumber);
        if (!container) return;
        
        
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.height = 'auto';
        container.style.minHeight = '';
        container.classList.remove('hiding', 'showing');
        
        
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                
                void container.offsetHeight;
                
                setTimeout(() => {
                    
                    const bitTapesForStep = this.stepBitTapes.get(stepNumber);
                    if (bitTapesForStep) {
                        bitTapesForStep.forEach(bitTape => {
                            if (bitTape) {
                                
                                if (bitTape.container) {
                                    const tapeContainer = bitTape.container.closest('.bit-tape');
                                    if (tapeContainer) {
                                        void tapeContainer.offsetHeight;
                                        void tapeContainer.offsetWidth;
                                    }
                                }
                                
                                
                                if (typeof bitTape.updateSwiper === 'function') {
                                    bitTape.updateSwiper();
                                }
                            }
                        });
                        
                        
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
                }, 300); 
            });
        });
    }
    
    goToStep(stepNumber) {
        if (stepNumber < 0 || stepNumber >= this.steps.length) {
            return;
        }
        
        
        this.saveStepToHistory(this.currentStep);
        
        
        const stepsToHide = [];
        for (let i = stepNumber + 1; i < this.steps.length; i++) {
            stepsToHide.push(i);
        }
        
        
        if (stepNumber === 4) {
            stepsToHide.push(0, 1, 2, 3);
        } else if (stepNumber === 5) {
            stepsToHide.push(0, 1, 2, 3, 4);
        } else if (stepNumber === 6) {
            
            stepsToHide.push(0, 1, 2, 3, 4);
        } else if (stepNumber === 7) {
            
            stepsToHide.push(0, 1, 2, 3, 4, 5, 6);
        } else if (stepNumber === 8) {
            
            stepsToHide.push(0, 1, 2, 3, 4, 5, 6, 7);
        } else if (stepNumber === 9) {
            
            stepsToHide.push(0, 1, 2, 3, 4, 5, 6, 7, 8);
            
            const step8Container = this.stepContainers.get(8);
            if (step8Container) {
                step8Container.innerHTML = '';
            }
        } else if (stepNumber > 0) {
            
            stepsToHide.push(0);
        }
        
        
        if (this.selectedElement && this.selectedElementStep !== null) {
            if (stepsToHide.includes(this.selectedElementStep)) {
                
                const willBeVisible = (stepNumber === 6 && (this.selectedElementStep === 5 || this.selectedElementStep === 6)) ||
                                     (stepNumber === 5 && this.selectedElementStep === 5) ||
                                     (stepNumber === this.selectedElementStep);
                
                if (!willBeVisible) {
                    this.clearSelection();
                }
            }
        }
        
        
        if (this.currentStep === 4 && stepNumber !== 4) {
            
            this.selectedIndices = [];
            this.lastSelectedIndex = null;
            
            
            if (this.qubitDetails) {
                this.qubitDetails.setSelectedElement(null);
            }
            
            
            const eveTape = this.bitTapes.get('eveQubits');
            if (eveTape) {
                eveTape.clearSelection();
            }
        }
        
        
        if (this.currentStep === 5 && stepNumber !== 5) {
            
            if (this.qubitDetails) {
                this.qubitDetails.setSelectedElement(null);
            }
            
            
            const bobTape = this.bitTapes.get('bobQubits');
            if (bobTape) {
                bobTape.clearSelection();
            }
        }
        
        
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
        
        
        this.updateStepHeader(stepNumber);
        
        
        if (stepsToHide.length > 0) {
            let hiddenCount = 0;
            const totalToHide = stepsToHide.length;
            
            stepsToHide.forEach(stepNum => {
                this.hideStepWithAnimation(stepNum, () => {
                    hiddenCount++;
                    
                    if (hiddenCount === totalToHide) {
                        this.showStepsForStep(stepNumber);
                    }
                });
            });
        } else {
            
            this.showStepsForStep(stepNumber);
        }
    }
    
    showStepsForStep(stepNumber) {
        
        
        if (this.stepHistory[stepNumber] && stepNumber !== 5) {
            this.state = JSON.parse(JSON.stringify(this.stepHistory[stepNumber]));
        }
        
        
        
        
        let stepsToShow = [];
        if (stepNumber === 4 || stepNumber === 5) {
            stepsToShow = [stepNumber];
        } else if (stepNumber === 6) {
            
            stepsToShow = [5, 6];
        } else if (stepNumber === 7 || stepNumber === 8 || stepNumber === 9) {
            
            stepsToShow = [stepNumber];
        } else {
            for (let i = 0; i <= stepNumber; i++) {
                if (this.steps[i]) {
                    
                    if (i === 0 && stepNumber > 0) {
                        continue;
                    }
                    stepsToShow.push(i);
                }
            }
        }
        
        stepsToShow.forEach(i => {
            if (this.steps[i]) {
                
                
                
                if (!this.renderedSteps.has(i) || i === 7 || i === 8 || i === 9 || (i === 6 && stepNumber === 6)) {
                    
                    this.steps[i].render();
                    this.renderedSteps.add(i);
                    
                    
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
                    
                    
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            this.showStepWithAnimation(i);
                            
                            
                            setTimeout(() => {
                                const bitTapesForStep = this.stepBitTapes.get(i);
                                if (bitTapesForStep) {
                                    bitTapesForStep.forEach(bitTape => {
                                        if (bitTape && typeof bitTape.updateSwiper === 'function') {
                                            bitTape.updateSwiper();
                                        }
                                    });
                                }
                            }, 200); 
                        });
                    });
                } else {
                    
                    if (i === 5 && this.state.channelQubits && this.state.channelQubits.length > 0) {
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
                    }
                    
                    
                    this.showStepWithAnimation(i);
                    
                    
                }
            }
        });
        
        this.currentStep = stepNumber;
        this.saveState();
        this.updateStepIndicator();
        
        this.updateBottomPanel();
    }
    
    saveStepToHistory(stepNumber) {
        
        if (!this.stepHistory[stepNumber]) {
            this.stepHistory[stepNumber] = JSON.parse(JSON.stringify(this.state));
        }
    }
    
    nextStep() {
        
        if (this.state.isProtocolAborted) {
            this.addEvent('Невозможно перейти к следующему шагу: протокол прерван. Пожалуйста, начните симуляцию заново.', 'error');
            return;
        }
        
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
            hashSeed: null,
            eveCheckErrorCount: 0,
            eveCheckLength: 0,
            isProtocolAborted: false
        };
        this.stepHistory = []; 
        
        
        this.selectedIndices = [];
        this.lastSelectedIndex = null;
        
        
        const notification = document.querySelector('.protocol-aborted-notification');
        if (notification) {
            notification.remove();
        }
        
        
        this.stepContainers.forEach(container => container.remove());
        this.stepContainers.clear();
        this.bitTapes.clear();
        this.stepBitTapes.clear(); 
        this.renderedSteps.clear(); 
        
        this.saveState();
        this.goToStep(0);
    }
    
    startAutoPlay() {
        if (this.isRunning) return;
        
        
        if (this.state.isProtocolAborted) {
            this.addEvent('Невозможно запустить автоплей: протокол прерван. Пожалуйста, начните симуляцию заново.', 'error');
            return;
        }
        
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
        
        if (typeof updateConnectionStatusDisplay === 'function') {
            updateConnectionStatusDisplay();
        }
    }
    
    saveState() {
        
        this.saveStepToHistory(this.currentStep);
        
        const stateToSave = {
            currentStep: this.currentStep,
            state: this.state,
            stepHistory: this.stepHistory, 
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
                
                
                const defaultState = {
                    aliceBits: [],
                    aliceBases: [],
                    aliceQubits: [],
                    channelQubits: [],
                    eveAttacks: {},
                    bobBases: [],
                    bobBits: []
                };
                
                
                this.state = parsed.state ? {
                    ...defaultState,
                    ...parsed.state
                } : defaultState;
                
                
                if (!Array.isArray(this.state.aliceQubits)) {
                    this.state.aliceQubits = [];
                }
                if (!Array.isArray(this.state.channelQubits)) {
                    this.state.channelQubits = [];
                }
                if (typeof this.state.eveAttacks !== 'object' || Array.isArray(this.state.eveAttacks)) {
                    this.state.eveAttacks = {};
                }
                
                
                if (parsed.stepHistory && Array.isArray(parsed.stepHistory)) {
                    this.stepHistory = parsed.stepHistory.map(step => JSON.parse(JSON.stringify(step)));
                } else {
                    this.stepHistory = [];
                }
                
                
                if (parsed.config && typeof panelState !== 'undefined' && panelState.config) {
                    Object.assign(panelState.config, parsed.config);
                }
                
                
                if (this.state.isProtocolAborted) {
                    let message = '';
                    if (this.currentStep === 7) {
                        message = `Протокол был прерван на шаге 7. Недостаточно совпадающих базисов. Пожалуйста, начните симуляцию заново.`;
                    } else if (this.currentStep === 8) {
                        message = `Протокол был прерван на шаге 8. Обнаружено слишком много ошибок при проверке на вмешательство Евы. Пожалуйста, начните симуляцию заново.`;
                    } else {
                        message = `Протокол был прерван. Пожалуйста, начните симуляцию заново.`;
                    }
                    setTimeout(() => {
                        if (typeof window.showProtocolAbortedNotification === 'function') {
                            window.showProtocolAbortedNotification(message);
                        }
                    }, 500);
                }
            } catch (e) {
                console.error('Ошибка при загрузке состояния:', e);
            }
        }
    }
    
    exportState() {
        
        this.saveStepToHistory(this.currentStep);
        
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            currentStep: this.currentStep,
            state: this.state,
            stepHistory: this.stepHistory, 
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
            
            
            if (data.stepHistory && Array.isArray(data.stepHistory)) {
                this.stepHistory = data.stepHistory.map(step => JSON.parse(JSON.stringify(step)));
            } else {
                this.stepHistory = [];
            }
            
            if (data.config && typeof panelState !== 'undefined' && panelState.config) {
                Object.assign(panelState.config, data.config);
            }
            
            
            this.stepContainers.forEach(container => container.remove());
            this.stepContainers.clear();
            this.bitTapes.clear();
            this.renderedSteps.clear();
            
            
            if (this.stepHistory[this.currentStep]) {
                this.state = JSON.parse(JSON.stringify(this.stepHistory[this.currentStep]));
            }
            
            
            this.updateStepHeader(this.currentStep);
            
            
            if (this.state.isProtocolAborted) {
                let message = '';
                if (this.currentStep === 7) {
                    message = `Протокол был прерван на шаге 7. Недостаточно совпадающих базисов. Пожалуйста, начните симуляцию заново.`;
                } else if (this.currentStep === 8) {
                    message = `Протокол был прерван на шаге 8. Обнаружено слишком много ошибок при проверке на вмешательство Евы. Пожалуйста, начните симуляцию заново.`;
                } else {
                    message = `Протокол был прерван. Пожалуйста, начните симуляцию заново.`;
                }
                setTimeout(() => {
                    if (typeof window.showProtocolAbortedNotification === 'function') {
                        window.showProtocolAbortedNotification(message);
                    }
                }, 500);
            }
            
            this.goToStep(this.currentStep);
            this.saveState();
            
            return true;
        } catch (e) {
            console.error('Ошибка при импорте состояния:', e);
            return false;
        }
    }
    
    
    canApplyConfigChange(key, oldValue, newValue) {
        if (this.currentStep < 1) {
            return true;
        }
        
        return false;
    }
    
    
    applyConfigChange(key, value) {
        if (key === 'n') {
            
            if (this.currentStep < 1) {
                
                return;
            }
        }
        
        
        if (this.currentStep >= 1 && key === 'n') {
            
            const n = value;
            this.state.aliceBits = this.generateRandomBits(n);
            
            for (let i = 0; i <= this.currentStep; i++) {
                if (this.steps[i]) {
                    this.steps[i].render();
                }
            }
        }
    }
}

