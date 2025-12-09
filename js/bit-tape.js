class BitTape {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            title: options.title || 'Биты',
            variant: options.variant || 'classical', 
            bits: options.bits || [],
            highlightIndices: options.highlightIndices || [], 
            matchIndices: options.matchIndices || [], 
            shouldAnimate: options.shouldAnimate !== false,
            useNativeScroll: options.useNativeScroll || false,
            onElementClick: options.onElementClick || null, 
            allowMultiSelect: options.allowMultiSelect || false, 
            onMultiSelect: options.onMultiSelect || null, 
            ...options
        };
        
        this.bits = [...this.options.bits];
        this.highlightSet = new Set(this.options.highlightIndices);
        this.matchSet = new Set(this.options.matchIndices);
        this.selectedIndex = null; 
        this.selectedIndices = new Set(); 
        this.lastSelectedIndex = null; 
        this.isFirstRender = true;
        this.swiperInstance = null;
        this.renderedSlides = new Set(); 
        this.visibleSlides = new Set(); 
        
        this.render();
    }
    
    render() {
        this.container.innerHTML = '';
        this.container.className = `bit-tape p-4 rounded-2xl border transition-colors duration-200 relative ${this.getVariantClasses().container}`;
        
        
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-4';
        
        const titleSection = document.createElement('div');
        titleSection.className = 'flex items-center gap-3';
        
        const indicator = document.createElement('div');
        indicator.className = `w-2 h-2 rounded-full ${this.getVariantClasses().indicator}`;
        
        const title = document.createElement('p');
        title.className = 'text-sm font-semibold text-white uppercase tracking-wider';
        title.textContent = this.options.title;
        
        titleSection.appendChild(indicator);
        titleSection.appendChild(title);
        
        const badge = document.createElement('span');
        badge.className = `text-xs font-medium px-2 py-1 rounded-full border ${this.getVariantClasses().badge}`;
        if (this.options.variant === 'qubit') {
            badge.textContent = `${this.bits.length} кубитов`;
        } else {
            badge.textContent = `${this.bits.length} бит`;
        }
        
        header.appendChild(titleSection);
        header.appendChild(badge);
        
        
        const bitsContainer = this.options.useNativeScroll 
            ? this.createNativeScrollContainer()
            : this.createSwiperContainer();
        
        this.container.appendChild(header);
        this.container.appendChild(bitsContainer);
        
        
        if (this.options.shouldAnimate && this.isFirstRender) {
            this.animateBits();
            this.isFirstRender = false;
        }
    }
    
    createNativeScrollContainer() {
        const container = document.createElement('div');
        container.className = 'native-scroll-container relative rounded-xl overflow-x-auto overflow-y-hidden';
        
        const inner = document.createElement('div');
        inner.className = 'native-scroll-inner flex items-center gap-2 py-2 px-1';
        
        this.bits.forEach((bit, index) => {
            const bitSquare = this.createBitSquare(bit, index);
            inner.appendChild(bitSquare);
        });
        
        container.appendChild(inner);
        return container;
    }
    
    createSwiperContainer() {
        const container = document.createElement('div');
        container.className = 'swiper-mask-container relative rounded-xl overflow-hidden';
        
        
        const swiperWrapper = document.createElement('div');
        swiperWrapper.className = 'bit-swiper';
        swiperWrapper.style.paddingBottom = '14px'; 
        swiperWrapper.id = `swiper-${Math.random().toString(36).substr(2, 9)}`;
        
        
        const swiperWrapperInner = document.createElement('div');
        swiperWrapperInner.className = 'swiper-wrapper';
        swiperWrapperInner.style.display = 'flex';
        swiperWrapperInner.style.alignItems = 'center';
        swiperWrapperInner.style.width = 'fit-content'; 
        
        
        this.bits.forEach((bit, index) => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.style.width = 'auto';
            slide.dataset.bitIndex = index; 
            
            
            const placeholder = document.createElement('div');
            placeholder.className = 'bit-square-placeholder';
            placeholder.style.width = '48px';
            placeholder.style.height = '48px';
            placeholder.style.flexShrink = '0';
            slide.appendChild(placeholder);
            
            swiperWrapperInner.appendChild(slide);
        });
        
        swiperWrapper.appendChild(swiperWrapperInner);
        
        
        const scrollbar = document.createElement('div');
        scrollbar.className = 'swiper-scrollbar';
        scrollbar.style.position = 'absolute';
        scrollbar.style.bottom = '0';
        scrollbar.style.left = '0';
        scrollbar.style.width = '100%';
        scrollbar.style.height = '6px';
        scrollbar.style.background = 'rgba(255, 255, 255, 0.1)';
        scrollbar.style.borderRadius = '6px';
        scrollbar.style.zIndex = '10';
        
        swiperWrapper.appendChild(scrollbar);
        container.appendChild(swiperWrapper);
        
        
        setTimeout(() => {
            if (typeof Swiper !== 'undefined') {
                try {
                    
                    const swiperConfig = {
                        slidesPerView: 'auto',
                        spaceBetween: 8,
                        freeMode: {
                            enabled: true,
                            sticky: false,
                            momentumRatio: 0.5,
                            momentumBounce: false,
                            minimumVelocity: 0.02
                        },
                        mousewheel: {
                            enabled: true,
                            forceToAxis: true,
                            sensitivity: 1,
                            releaseOnEdges: true,
                            eventsTarget: 'container'
                        },
                        touchEventsTarget: 'container',
                        touchRatio: 1,
                        resistance: true,
                        resistanceRatio: 0.5, 
                        scrollbar: {
                            el: scrollbar,
                            draggable: true,
                            hide: false
                        },
                        watchOverflow: true,
                        preventClicks: false,
                        preventClicksPropagation: false,
                        observer: true, 
                        observeParents: true 
                    };
                    
                    
                    if (Swiper.FreeMode || (window.Swiper && window.Swiper.FreeMode)) {
                        swiperConfig.modules = [];
                        if (Swiper.FreeMode) swiperConfig.modules.push(Swiper.FreeMode);
                        if (Swiper.Mousewheel) swiperConfig.modules.push(Swiper.Mousewheel);
                        if (Swiper.Scrollbar) swiperConfig.modules.push(Swiper.Scrollbar);
                    }
                    
                    this.swiperInstance = new Swiper(swiperWrapper, swiperConfig);
                    
                    
                    setTimeout(() => {
                        if (this.swiperInstance) {
                            this.swiperInstance.update();
                            
                            
                            this.initVirtualization(swiperWrapper);
                            
                            
                            this.updateVisibleSlides();
                        }
                    }, 100);
                } catch (e) {
                    console.error('Ошибка инициализации Swiper:', e);
                    
                    swiperWrapper.style.overflowX = 'auto';
                    swiperWrapper.style.scrollbarWidth = 'thin';
                }
            } else {
                
                swiperWrapper.style.overflowX = 'auto';
                swiperWrapper.style.scrollbarWidth = 'thin';
            }
        }, 50);
        
        return container;
    }
    
    createBitSquare(bit, index) {
        
        const isQubit = this.options.variant === 'qubit' && typeof bit === 'object' && bit.symbol;
        const squareSize = isQubit ? 'w-14 h-16' : 'w-12 h-12';
        
        const square = document.createElement('div');
        square.className = `bit-square ${squareSize} flex flex-col items-center justify-center rounded-xl font-mono font-bold text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95 cursor-pointer border-2 ${this.getBitClasses(bit)}`;
        square.dataset.index = index;
        
        if (!this.options.shouldAnimate && !this.isFirstRender) {
            square.classList.add('bit-square-static');
        }
        
        if (this.highlightSet.has(index)) {
            square.classList.add('bit-square-highlight');
        }
        if (this.matchSet.has(index)) {
            square.classList.add('bit-square-match');
        }
        
        
        if (this.selectedIndex === index) {
            square.classList.add('bit-square-selected');
        }
        
        if (this.options.allowMultiSelect && this.selectedIndices.has(index)) {
            square.classList.add('bit-square-selected');
        }
        
        
        if (this.options.onElementClick) {
            square.addEventListener('click', (e) => {
                this.selectElement(index, bit, e);
            });
        }
        
        const indexLabel = document.createElement('span');
        indexLabel.className = 'text-xs text-gray-400';
        
        const displayIndex = (typeof bit === 'object' && bit !== null && bit.originalIndex !== undefined) 
            ? bit.originalIndex 
            : index;
        indexLabel.textContent = String(displayIndex);
        
        const bitValue = document.createElement('span');
        bitValue.className = isQubit ? 'text-base' : 'text-lg';
        
        
        if (isQubit) {
            bitValue.textContent = bit.symbol;
            
            if (bit.basis !== undefined && !this.options.hideBasis) {
                const basisLabel = document.createElement('span');
                basisLabel.className = 'text-[10px] text-gray-400 mt-0.5';
                basisLabel.textContent = bit.basis;
                square.appendChild(indexLabel);
                square.appendChild(bitValue);
                square.appendChild(basisLabel);
            } else {
                square.appendChild(indexLabel);
                square.appendChild(bitValue);
            }
        } else {
            
            const bitValueToShow = (typeof bit === 'object' && bit !== null && bit.value !== undefined) 
                ? bit.value 
                : bit;
            bitValue.textContent = bitValueToShow;
            square.appendChild(indexLabel);
            square.appendChild(bitValue);
        }
        
        
        if (this.options.shouldAnimate && this.isFirstRender) {
            square.style.animation = `slideInUp 0.2s ease-out ${index * 0.02}s both`;
        }
        
        return square;
    }
    
    findBitSquare(index) {
        
        
        let square = this.container.querySelector(`[data-index="${index}"]`);
        if (!square && this.swiperInstance) {
            
            const swiperContainer = this.swiperInstance.el;
            square = swiperContainer ? swiperContainer.querySelector(`[data-index="${index}"]`) : null;
        }
        return square;
    }
    
    selectElement(index, bit, event) {
        if (this.options.allowMultiSelect) {
            
            const isShiftClick = event && event.shiftKey;
            
            if (isShiftClick && this.lastSelectedIndex !== null) {
                
                const start = Math.min(this.lastSelectedIndex, index);
                const end = Math.max(this.lastSelectedIndex, index);
                for (let i = start; i <= end; i++) {
                    this.selectedIndices.add(i);
                    const square = this.findBitSquare(i);
                    if (square) {
                        square.classList.add('bit-square-selected');
                    }
                }
            } else {
                
                if (this.selectedIndices.has(index)) {
                    this.selectedIndices.delete(index);
                    const square = this.findBitSquare(index);
                    if (square) {
                        square.classList.remove('bit-square-selected');
                    }
                } else {
                    this.selectedIndices.add(index);
                    const square = this.findBitSquare(index);
                    if (square) {
                        square.classList.add('bit-square-selected');
                    }
                }
            }
            
            this.lastSelectedIndex = index;
            
            
            if (this.options.onMultiSelect) {
                this.options.onMultiSelect(Array.from(this.selectedIndices));
            }
        } else {
            
            
            if (this.selectedIndex !== null) {
                const prevSquare = this.findBitSquare(this.selectedIndex);
                if (prevSquare) {
                    prevSquare.classList.remove('bit-square-selected');
                }
            }
            
            
            this.selectedIndex = index;
            const square = this.findBitSquare(index);
            if (square) {
                square.classList.add('bit-square-selected');
            }
        }
        
        
        
        const actualValue = (typeof bit === 'object' && bit !== null && bit.value !== undefined) 
            ? bit.value 
            : (typeof bit === 'object' && bit.symbol ? bit.symbol : bit);
        const originalIndex = (typeof bit === 'object' && bit !== null && bit.originalIndex !== undefined)
            ? bit.originalIndex
            : index;
        
        const elementData = {
            type: this.options.variant === 'qubit' ? 'qubit' : 'bit',
            index: index, 
            value: actualValue,
            tapeTitle: this.options.title
        };
        
        
        if (typeof bit === 'object' && bit !== null && bit.originalIndex !== undefined) {
            elementData.originalIndex = originalIndex; 
            elementData.displayIndex = originalIndex; 
        } else {
            elementData.displayIndex = index; 
        }
        
        
        if (this.options.variant === 'qubit' && typeof bit === 'object' && bit.symbol) {
            elementData.basis = bit.basis;
            elementData.alpha = bit.alpha;
            elementData.beta = bit.beta;
            elementData.symbol = bit.symbol;
        }
        
        
        if (this.options.onElementClick) {
            this.options.onElementClick(elementData, event);
        }
    }
    
    clearSelection() {
        if (this.selectedIndex !== null) {
            const square = this.findBitSquare(this.selectedIndex);
            if (square) {
                square.classList.remove('bit-square-selected');
            }
            this.selectedIndex = null;
        }
        
        
        if (this.options.allowMultiSelect) {
            this.selectedIndices.forEach(index => {
                const square = this.findBitSquare(index);
                if (square) {
                    square.classList.remove('bit-square-selected');
                }
            });
            this.selectedIndices.clear();
            this.lastSelectedIndex = null;
        }
    }
    
    setSelectedIndices(indices) {
        
        if (!this.options.allowMultiSelect) return;
        
        
        this.clearSelection();
        
        
        indices.forEach(index => {
            this.selectedIndices.add(index);
            const square = this.findBitSquare(index);
            if (square) {
                square.classList.add('bit-square-selected');
            }
        });
        
        if (indices.length > 0) {
            this.lastSelectedIndex = indices[indices.length - 1];
        }
    }
    
    animateBits() {
        const bits = this.container.querySelectorAll('.bit-square');
        bits.forEach((bit, index) => {
            bit.style.animation = `slideInUp 0.2s ease-out ${index * 0.02}s both`;
        });
    }
    
    getVariantClasses() {
        const variants = {
            reconcile: {
                container: 'bg-emerald-900/40 border-emerald-500/30 backdrop-blur-sm',
                badge: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/40',
                indicator: 'bg-emerald-300'
            },
            quantum: {
                container: 'bg-slate-800/40 border-slate-600/30 backdrop-blur-sm',
                badge: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
                indicator: 'bg-indigo-400'
            },
            basis: {
                container: 'bg-purple-900/40 border-purple-500/30 backdrop-blur-sm',
                badge: 'bg-purple-500/20 text-purple-100 border-purple-400/40',
                indicator: 'bg-purple-300'
            },
            qubit: {
                container: 'bg-gray-800/40 border-gray-600/30 backdrop-blur-sm',
                badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
                indicator: 'bg-emerald-400'
            },
            classical: {
                container: 'bg-gray-800/40 border-gray-600/30 backdrop-blur-sm',
                badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
                indicator: 'bg-emerald-400'
            }
        };
        
        return variants[this.options.variant] || variants.classical;
    }
    
    getBitClasses(bit) {
        
        const bitValue = (typeof bit === 'object' && bit !== null && bit.value !== undefined) 
            ? bit.value 
            : bit;
        
        if (this.options.variant === 'reconcile') {
            return 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100 shadow-lg shadow-emerald-500/15 hover:bg-emerald-500/30';
        }
        
        if (this.options.variant === 'quantum') {
            return bitValue === 1
                ? 'bg-slate-700 border-slate-500 text-slate-200 shadow-lg shadow-slate-500/20 hover:bg-slate-600'
                : 'bg-slate-900 border-slate-700 text-slate-400 shadow-lg shadow-slate-900/20 hover:bg-slate-800';
        }
        
        if (this.options.variant === 'basis') {
            
            return bitValue === 'X' || bitValue === 'x'
                ? 'bg-green-500/20 border-green-400/30 text-green-200 shadow-lg shadow-green-500/10 hover:bg-green-500/30'
                : 'bg-purple-500/20 border-purple-400/30 text-purple-200 shadow-lg shadow-purple-500/10 hover:bg-purple-500/30';
        }
        
        if (this.options.variant === 'qubit') {
            
            return 'bg-blue-600/30 border-blue-400/40 text-yellow-300 shadow-lg shadow-blue-900/30 hover:bg-blue-600/40';
        }
        
        
        return bitValue === 1
            ? 'bg-amber-500/20 border-amber-400/30 text-amber-200 shadow-lg shadow-amber-500/10 hover:bg-amber-500/30'
            : 'bg-blue-500/20 border-blue-400/30 text-blue-200 shadow-lg shadow-blue-500/10 hover:bg-blue-500/30';
    }
    
    updateBits(newBits) {
        this.bits = [...newBits];
        
        this.renderedSlides.clear();
        this.visibleSlides.clear();
        
        if (this.swiperInstance) {
            
            this.render();
        } else {
            this.render();
        }
    }
    
    
    initVirtualization(swiperWrapper) {
        
        if ('IntersectionObserver' in window) {
            const observerOptions = {
                root: swiperWrapper,
                rootMargin: '50px', 
                threshold: 0.01
            };
            
            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const slide = entry.target;
                    const bitIndex = parseInt(slide.dataset.bitIndex);
                    
                    if (entry.isIntersecting) {
                        this.visibleSlides.add(bitIndex);
                        this.renderSlideContent(slide, bitIndex);
                    } else {
                        this.visibleSlides.delete(bitIndex);
                        
                    }
                });
            }, observerOptions);
            
            
            const slides = swiperWrapper.querySelectorAll('.swiper-slide');
            slides.forEach(slide => {
                this.intersectionObserver.observe(slide);
            });
        } else {
            
            this.renderAllSlides();
        }
        
        
        if (this.swiperInstance) {
            this.swiperInstance.on('slideChange', () => {
                this.updateVisibleSlides();
            });
            
            this.swiperInstance.on('progress', () => {
                this.updateVisibleSlides();
            });
        }
    }
    
    
    updateVisibleSlides() {
        if (!this.swiperInstance) return;
        
        const container = this.swiperInstance.el;
        const containerRect = container.getBoundingClientRect();
        const containerLeft = containerRect.left;
        const containerRight = containerRect.right;
        const margin = 100; 
        
        const slides = container.querySelectorAll('.swiper-slide');
        slides.forEach(slide => {
            const slideRect = slide.getBoundingClientRect();
            const slideLeft = slideRect.left;
            const slideRight = slideRect.right;
            const bitIndex = parseInt(slide.dataset.bitIndex);
            
            
            if (slideRight >= containerLeft - margin && slideLeft <= containerRight + margin) {
                if (!this.visibleSlides.has(bitIndex)) {
                    this.visibleSlides.add(bitIndex);
                    this.renderSlideContent(slide, bitIndex);
                }
            }
        });
    }
    
    
    renderSlideContent(slide, bitIndex) {
        if (this.renderedSlides.has(bitIndex)) {
            
            const existingSquare = slide.querySelector('.bit-square');
            if (existingSquare) {
                
                const currentBit = this.bits[bitIndex];
                if (currentBit !== undefined) {
                    
                    const bitValue = (typeof currentBit === 'object' && currentBit !== null && currentBit.value !== undefined)
                        ? currentBit.value
                        : currentBit;
                    const displayIndex = (typeof currentBit === 'object' && currentBit !== null && currentBit.originalIndex !== undefined)
                        ? currentBit.originalIndex
                        : bitIndex;
                    
                    
                    const indexLabel = existingSquare.querySelector('.text-xs.text-gray-400');
                    if (indexLabel && indexLabel.textContent != String(displayIndex)) {
                        indexLabel.textContent = String(displayIndex);
                    }
                    
                    
                    const currentValue = existingSquare.querySelector('.text-lg');
                    if (currentValue && currentValue.textContent != String(bitValue)) {
                        currentValue.textContent = String(bitValue);
                        
                        existingSquare.className = `bit-square w-12 h-12 flex flex-col items-center justify-center rounded-xl font-mono font-bold text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95 cursor-pointer border-2 ${this.getBitClasses(currentBit)}`;
                    }
                }
            }
            return;
        }
        
        const bit = this.bits[bitIndex];
        if (bit === undefined) return;
        
        
        const placeholder = slide.querySelector('.bit-square-placeholder');
        const existingSquare = slide.querySelector('.bit-square');
        if (placeholder) {
            placeholder.remove();
        }
        if (existingSquare) {
            existingSquare.remove();
        }
        
        
        const bitSquare = this.createBitSquare(bit, bitIndex);
        slide.appendChild(bitSquare);
        
        this.renderedSlides.add(bitIndex);
    }
    
    
    renderAllSlides() {
        const slides = this.container.querySelectorAll('.swiper-slide');
        slides.forEach(slide => {
            const bitIndex = parseInt(slide.dataset.bitIndex);
            this.renderSlideContent(slide, bitIndex);
        });
    }
    
    
    updateSwiper() {
        if (!this.swiperInstance) return;
        
        const container = this.swiperInstance.el;
        if (!container) return;
        
        
        const isVisible = container.offsetParent !== null || 
                         container.style.display !== 'none' ||
                         window.getComputedStyle(container).display !== 'none';
        
        if (!isVisible) {
            
            setTimeout(() => this.updateSwiper(), 100);
            return;
        }
        
        
        if (container.parentElement) {
            void container.offsetHeight;
            void container.offsetWidth;
            void container.parentElement.offsetHeight;
            void container.parentElement.offsetWidth;
        }
        
        setTimeout(() => {
            if (!this.swiperInstance) return;
            
            
            const hasSize = container.offsetWidth > 0 || container.offsetHeight > 0;
            if (!hasSize) {
                
                setTimeout(() => this.updateSwiper(), 100);
                return;
            }
            
            try {
                
                this.swiperInstance.update();
                this.swiperInstance.updateSlides();
                this.swiperInstance.updateSlidesClasses();
                
                
                if (this.swiperInstance.scrollbar && this.swiperInstance.scrollbar.updateSize) {
                    this.swiperInstance.scrollbar.updateSize();
                }
                
                
                this.swiperInstance.updateAutoHeight();
                
                
                this.updateVisibleSlides();
                
                
                setTimeout(() => {
                    if (this.swiperInstance) {
                        this.swiperInstance.update();
                        if (this.swiperInstance.scrollbar && this.swiperInstance.scrollbar.updateSize) {
                            this.swiperInstance.scrollbar.updateSize();
                        }
                    }
                }, 100);
            } catch (e) {
                console.warn('Ошибка при обновлении Swiper:', e);
            }
        }, 200); 
    }
    
    setHighlight(indices) {
        this.highlightSet = new Set(indices);
        this.options.highlightIndices = indices;
        
        const squares = this.container.querySelectorAll('.bit-square');
        squares.forEach((square, index) => {
            if (this.highlightSet.has(index)) {
                square.classList.add('bit-square-highlight');
            } else {
                square.classList.remove('bit-square-highlight');
            }
        });
    }
    
    addBit(bit) {
        this.bits.push(bit);
        this.render();
    }
    
    getBits() {
        return [...this.bits];
    }
}

