/**
 * Компонент для отображения деталей выбранного кубита или бита
 */
class QubitDetails {
    constructor(container, options = {}) {
        this.container = container;
        this.selectedElement = null;
        this.alternateIndices = options.alternateIndices || [];
        this.onClose = options.onClose || null;
        this.onSelectIndex = options.onSelectIndex || null;
        
        this.render();
    }
    
    setSelectedElement(element) {
        this.selectedElement = element;
        this.render();
    }
    
    setAlternateIndices(indices) {
        this.alternateIndices = indices;
        this.render();
    }
    
    render() {
        if (!this.selectedElement) {
            this.container.innerHTML = `
                <div class="rounded-2xl border border-dashed border-gray-700 bg-gray-900/40 text-gray-400 p-6 text-center">
                    Выберите кубит или бит, когда он появится в ленте.
                </div>
            `;
            return;
        }
        
        if (this.selectedElement.type === 'bit') {
            this.renderBitDetails();
        } else if (this.selectedElement.type === 'qubit') {
            this.renderQubitDetails();
        }
    }
    
    renderBitDetails() {
        const element = this.selectedElement;
        const isBasis = element.tapeTitle && (element.tapeTitle.includes('Базис') || element.tapeTitle.includes('базис'));
        const displayValue = isBasis ? `Базис: ${element.value}` : `Значение: ${element.value}`;
        
        this.container.innerHTML = `
            <div class="qubit-details p-4 rounded-2xl border bg-gray-800/40 text-white relative">
                <button class="close-btn absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-700 transition-colors text-gray-400 hover:text-white" title="Закрыть">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h3 class="text-lg font-bold mb-2 pr-8">
                    ${isBasis ? 'Базис' : 'Бит'} из ленты "${element.tapeTitle || 'Неизвестная лента'}"
                </h3>
                <div class="space-y-2">
                    <p class="text-sm text-gray-300">Индекс: <span class="font-semibold text-white">${element.index}</span></p>
                    <p class="text-sm text-gray-300">${displayValue}</p>
                    ${isBasis ? `
                        <div class="mt-3 p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                            <p class="text-xs text-gray-400 mb-1">Описание базиса:</p>
                            <p class="text-sm">
                                ${element.value === 'X' || element.value === 'x' 
                                    ? 'X-базис (Hadamard): используется для измерения в суперпозиции состояний |+⟩ и |−⟩' 
                                    : 'Z-базис (Computational): используется для измерения в состояниях |0⟩ и |1⟩'}
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        const closeBtn = this.container.querySelector('.close-btn');
        if (closeBtn && this.onClose) {
            closeBtn.addEventListener('click', () => this.onClose());
        }
    }
    
    renderQubitDetails() {
        const element = this.selectedElement;
        const blochData = this.calculateBlochData(element);
        const alternateOptions = this.getAlternateOptions();
        const hasAlternateOptions = alternateOptions.length > 1;
        
        this.container.innerHTML = `
            <div class="qubit-details p-4 rounded-2xl border bg-gray-800/40 text-white relative">
                <button class="close-btn absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-700 transition-colors text-gray-400 hover:text-white" title="Закрыть">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                
                <h3 class="text-lg font-bold mb-1 pr-8">Кубит #${element.index}</h3>
                <p class="text-sm text-gray-300 mb-4">
                    Базис: <span class="font-semibold text-white">${element.basis || '—'}</span>
                </p>
                
                <div class="qubit-meta">
                    <div class="bloch-card">
                        <div id="bloch-sphere-container" class="relative" style="position: relative;">
                            ${hasAlternateOptions ? `
                                <div style="position: absolute; top: 8px; right: 8px; z-index: 50; pointer-events: auto;">
                                    <select 
                                        id="qubit-selector"
                                        class="px-3 py-1.5 text-sm rounded-lg bg-gray-900/90 backdrop-blur-sm border border-amber-500/40 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/60 shadow-lg cursor-pointer"
                                        title="Выбрать кубит для отображения"
                                    >
                                        ${alternateOptions.map(idx => `
                                            <option value="${idx}" ${idx === element.index ? 'selected' : ''}>
                                                Кубит #${idx}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            ` : ''}
                        </div>
                        <div class="bloch-angles">
                            <div>
                                <p class="label">θ</p>
                                <p>${this.formatAngle(blochData.thetaDeg)}</p>
                            </div>
                            <div>
                                <p class="label">φ</p>
                                <p>${this.formatAngle(blochData.phiDeg)}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="info-stack space-y-3">
                        <div class="info-card">
                            <p class="info-label">Амплитуды состояния</p>
                            <p>|0⟩: ${this.formatComplex(element.alpha)}</p>
                            <p>|1⟩: ${this.formatComplex(element.beta)}</p>
                        </div>
                        
                        <div class="info-card">
                            <p class="info-label">Вероятности измерения</p>
                            <p>P(|0⟩) = ${this.formatProbability(blochData.probabilities.zero)}</p>
                            <p>P(|1⟩) = ${this.formatProbability(blochData.probabilities.one)}</p>
                        </div>
                        
                        <div class="info-card">
                            <p class="info-label">Блох-вектор</p>
                            <p>x = ${this.formatComponent(blochData.vector.x)}</p>
                            <p>y = ${this.formatComponent(blochData.vector.y)}</p>
                            <p>z = ${this.formatComponent(blochData.vector.z)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Инициализируем сферу Блоха
        const sphereContainer = this.container.querySelector('#bloch-sphere-container');
        if (sphereContainer) {
            const blochSphere = new BlochSphere(sphereContainer, {
                vector: blochData.vector
            });
        }
        
        // Обработчики событий
        const closeBtn = this.container.querySelector('.close-btn');
        if (closeBtn && this.onClose) {
            closeBtn.addEventListener('click', () => this.onClose());
        }
        
        const selector = this.container.querySelector('#qubit-selector');
        if (selector && this.onSelectIndex) {
            selector.addEventListener('change', (e) => {
                const value = Number(e.target.value);
                if (!Number.isNaN(value)) {
                    this.onSelectIndex(value);
                }
            });
        }
    }
    
    calculateBlochData(element) {
        if (!element || element.type !== 'qubit') {
            return {
                vector: { x: 0, y: 0, z: 1 },
                thetaDeg: 0,
                phiDeg: 0,
                probabilities: { zero: 1, one: 0 }
            };
        }
        
        const { alpha, beta } = element;
        if (!alpha || !beta) {
            return {
                vector: { x: 0, y: 0, z: 1 },
                thetaDeg: 0,
                phiDeg: 0,
                probabilities: { zero: 1, one: 0 }
            };
        }
        
        const aReal = alpha.real ?? 0;
        const aImag = alpha.imag ?? 0;
        const bReal = beta.real ?? 0;
        const bImag = beta.imag ?? 0;
        
        const norm = Math.sqrt(aReal * aReal + aImag * aImag + bReal * bReal + bImag * bImag) || 1;
        const ar = aReal / norm;
        const ai = aImag / norm;
        const br = bReal / norm;
        const bi = bImag / norm;
        
        const prob0 = this.clamp(ar * ar + ai * ai, 0, 1);
        const prob1 = this.clamp(br * br + bi * bi, 0, 1);
        
        let x = 2 * (ar * br + ai * bi);
        let y = 2 * (-ar * bi + ai * br);
        let z = prob0 - prob1;
        
        const length = Math.sqrt(x * x + y * y + z * z) || 1;
        x /= length;
        y /= length;
        z /= length;
        
        const theta = Math.acos(this.clamp(z, -1, 1));
        let phi = Math.atan2(y, x);
        if (phi < 0) {
            phi += Math.PI * 2;
        }
        
        return {
            vector: { x, y, z },
            thetaDeg: this.radToDeg(theta),
            phiDeg: this.radToDeg(phi),
            probabilities: { zero: prob0, one: prob1 }
        };
    }
    
    getAlternateOptions() {
        if (!this.alternateIndices) return [];
        const unique = Array.from(new Set(this.alternateIndices));
        return unique.sort((a, b) => a - b);
    }
    
    formatComplex(c) {
        if (!c) return '—';
        if (Math.abs(c.imag) < 1e-6) return c.real.toFixed(2);
        return `${c.real.toFixed(2)} + ${c.imag.toFixed(2)}i`;
    }
    
    formatProbability(prob) {
        return `${(this.clamp(prob, 0, 1) * 100).toFixed(1)}%`;
    }
    
    formatAngle(deg) {
        return `${this.toFixedSafe(deg, 1)}°`;
    }
    
    formatComponent(value) {
        return this.toFixedSafe(value, 2);
    }
    
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    
    toFixedSafe(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(digits);
    }
    
    radToDeg(rad) {
        return (rad * 180) / Math.PI;
    }
}

