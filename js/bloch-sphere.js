/**
 * Компонент для визуализации сферы Блоха в 3D
 * Оптимизированная версия с улучшенным рендерингом и синхронным движением меток
 */
class BlochSphere {
    constructor(container, options = {}) {
        this.container = container;
        this.vector = options.vector || { x: 0, y: 0, z: 1 };
        
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.rotationX = 0.3;
        this.rotationY = 0.5;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.lastTouchDistance = 0;
        
        // Метки базисных состояний в стандартной системе координат сферы Блоха:
        // z - ось |0⟩/|1⟩ (z=1 → |0⟩, z=-1 → |1⟩)
        // x - ось |+⟩/|-⟩ (x=1 → |+⟩, x=-1 → |-⟩)
        // y - ось |i⟩/|-i⟩ (y=1 → |i⟩, y=-1 → |-i⟩)
        this.labels = [
            { id: '0', text: '|0⟩', pos: { x: 0, y: 0, z: 1 } },
            { id: '1', text: '|1⟩', pos: { x: 0, y: 0, z: -1 } },
            { id: '+', text: '|+⟩', pos: { x: 1, y: 0, z: 0 } },
            { id: '-', text: '|-⟩', pos: { x: -1, y: 0, z: 0 } },
            { id: 'i', text: '|i⟩', pos: { x: 0, y: 1, z: 0 } },
            { id: '-i', text: '|-i⟩', pos: { x: 0, y: -1, z: 0 } }
        ];
        
        this.labelElements = [];
        this.labelsContainer = null;
        this.highlightedLabel = null;
        
        // Кэш для оптимизации
        this.cachedProjections = new Map();
        this.needsRedraw = true;
        
        this.init();
        this.setupResizeObserver();
    }
    
    init() {
        // Создаем canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'bloch-canvas';
        this.canvas.style.cursor = 'grab';
        this.canvas.style.touchAction = 'none'; // Предотвращаем стандартные жесты
        this.container.appendChild(this.canvas);
        
        // Устанавливаем стили контейнера
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.minHeight = '250px';
        this.container.style.borderRadius = '1rem';
        this.container.style.overflow = 'hidden';
        this.container.style.background = 'radial-gradient(circle at center, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0) 70%)';
        
        this.ctx = this.canvas.getContext('2d');
        
        this.createLabelElements();
        this.setupEventListeners();
        this.resize();
        this.animate();
    }
    
    createLabelElements() {
        // Создаем контейнер для меток
        this.labelsContainer = document.createElement('div');
        this.labelsContainer.style.position = 'absolute';
        this.labelsContainer.style.top = '0';
        this.labelsContainer.style.left = '0';
        this.labelsContainer.style.width = '100%';
        this.labelsContainer.style.height = '100%';
        this.labelsContainer.style.pointerEvents = 'none';
        this.labelsContainer.style.willChange = 'transform';
        this.container.appendChild(this.labelsContainer);
        
        // Создаем метки базисных состояний
        this.labels.forEach(label => {
            const labelEl = document.createElement('div');
            labelEl.className = 'bloch-label';
            labelEl.innerHTML = label.text;
            labelEl.style.position = 'absolute';
            labelEl.style.transform = 'translate(-50%, -50%)';
            labelEl.style.color = '#9ca3af';
            labelEl.style.fontSize = '0.85rem';
            labelEl.style.fontWeight = '600';
            labelEl.style.pointerEvents = 'none';
            labelEl.style.userSelect = 'none';
            labelEl.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
            labelEl.style.opacity = '1';
            labelEl.style.willChange = 'transform, opacity';
            labelEl.style.transition = 'none'; // Убираем transition для синхронного движения
            this.labelsContainer.appendChild(labelEl);
            this.labelElements.push({ element: labelEl, label: label });
        });
    }
    
    setupEventListeners() {
        // Обработчики мыши
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // Обработчики для touch устройств
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.handleTouchEnd());
        this.canvas.addEventListener('touchcancel', () => this.handleTouchEnd());
    }
    
    setupResizeObserver() {
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(() => {
                this.resize();
            });
            resizeObserver.observe(this.container);
        } else {
            // Fallback для старых браузеров
            window.addEventListener('resize', () => this.resize());
        }
    }
    
    resize() {
        const { clientWidth, clientHeight } = this.container;
        if (clientWidth === 0 || clientHeight === 0) return;
        
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = clientWidth * dpr;
        this.canvas.height = clientHeight * dpr;
        this.canvas.style.width = clientWidth + 'px';
        this.canvas.style.height = clientHeight + 'px';
        
        // Масштабируем контекст для HiDPI дисплеев
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
        
        this.needsRedraw = true;
    }
    
    setVector(vector) {
        this.vector = vector;
        this.updateLabelHighlight();
        this.needsRedraw = true;
    }
    
    updateLabelHighlight() {
        const currentLabelText = this.getVectorStateLabel(this.vector);
        
        // Сбрасываем все метки
        this.labelElements.forEach(({ element, label }) => {
            if (label.text === currentLabelText) {
                element.style.backgroundColor = 'rgba(15, 98, 254, 0.9)';
                element.style.color = 'white';
                element.style.padding = '2px 8px';
                element.style.borderRadius = '4px';
                element.style.textShadow = 'none';
                this.highlightedLabel = label.id;
            } else {
                element.style.backgroundColor = '';
                element.style.color = '#9ca3af';
                element.style.padding = '';
                element.style.borderRadius = '';
                element.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
            }
        });
    }
    
    handleMouseDown(e) {
        this.isDragging = true;
        this.canvas.style.cursor = 'grabbing';
        const rect = this.canvas.getBoundingClientRect();
        this.lastMouseX = e.clientX - rect.left;
        this.lastMouseY = e.clientY - rect.top;
        e.preventDefault();
    }
    
    handleMouseMove(e) {
        if (!this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const deltaX = mouseX - this.lastMouseX;
        const deltaY = mouseY - this.lastMouseY;
        
        // Вращение: движение мыши вправо = вращение вправо
        this.rotationY += deltaX * 0.01;
        this.rotationX -= deltaY * 0.01;
        
        // Ограничиваем вертикальное вращение
        this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX));
        
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        this.needsRedraw = true;
        
        e.preventDefault();
    }
    
    handleMouseUp() {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }
    
    handleWheel(e) {
        const delta = e.deltaY * -0.001;
        this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX + delta));
        this.needsRedraw = true;
        e.preventDefault();
    }
    
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.lastMouseX = touch.clientX - rect.left;
            this.lastMouseY = touch.clientY - rect.top;
            this.isDragging = true;
            this.lastTouchDistance = 0;
        } else if (e.touches.length === 2) {
            // Двумя пальцами - масштабирование/вращение
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            this.lastTouchDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
        }
        e.preventDefault();
    }
    
    handleTouchMove(e) {
        if (e.touches.length === 1 && this.isDragging) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = touch.clientX - rect.left;
            const mouseY = touch.clientY - rect.top;
            
            const deltaX = mouseX - this.lastMouseX;
            const deltaY = mouseY - this.lastMouseY;
            
            // Вращение: для touch инвертируем горизонтальное (OX) из-за особенностей touch событий
            this.rotationY -= deltaX * 0.01;
            this.rotationX -= deltaY * 0.01;
            this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX));
            
            this.lastMouseX = mouseX;
            this.lastMouseY = mouseY;
            this.needsRedraw = true;
        } else if (e.touches.length === 2) {
            // Двумя пальцами - изменение вертикального угла
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            if (this.lastTouchDistance > 0) {
                const delta = (distance - this.lastTouchDistance) * 0.01;
                this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX - delta));
                this.needsRedraw = true;
            }
            
            this.lastTouchDistance = distance;
        }
        e.preventDefault();
    }
    
    handleTouchEnd() {
        this.isDragging = false;
        this.lastTouchDistance = 0;
    }
    
    getVectorStateLabel(v) {
        // Проверяем, на какое базисное состояние указывает вектор
        // В стандартной системе координат сферы Блоха:
        // z=1 → |0⟩, z=-1 → |1⟩
        // x=1 → |+⟩, x=-1 → |-⟩
        // y=1 → |i⟩, y=-1 → |-i⟩
        const eps = 0.15;
        
        // Нормализуем вектор для проверки
        const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (length < 0.001) return '|ψ⟩';
        
        const nx = v.x / length;
        const ny = v.y / length;
        const nz = v.z / length;
        
        // Проверяем базисные состояния
        if (nz > 1 - eps) return '|0⟩';
        if (nz < -1 + eps) return '|1⟩';
        if (nx > 1 - eps) return '|+⟩';
        if (nx < -1 + eps) return '|-⟩';
        if (ny > 1 - eps) return '|i⟩';
        if (ny < -1 + eps) return '|-i⟩';
        
        return '|ψ⟩';
    }
    
    animate() {
        if (this.needsRedraw) {
            this.draw();
            this.needsRedraw = false;
        }
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    // Преобразование координат из стандартной системы сферы Блоха (Z-вверх для |0⟩/|1⟩)
    // в нашу систему визуализации (Y-вверх на экране)
    // Стандартная система: z-вверх (|0⟩), x-вправо (|+⟩), y-вперед (|i⟩)
    // Наша система: y-вверх, x-вправо, z-вперед
    convertToOurCoordinates(vec) {
        return {
            x: vec.x,  // X остается X
            y: vec.z,  // Z (|0⟩/|1⟩) становится Y (вверх)
            z: vec.y   // Y (|i⟩/|-i⟩) становится Z (глубина)
        };
    }
    
    project3D(x, y, z) {
        // Применяем вращение вокруг Y (горизонтальное)
        let x1 = x * Math.cos(this.rotationY) - z * Math.sin(this.rotationY);
        let y1 = y;
        let z1 = x * Math.sin(this.rotationY) + z * Math.cos(this.rotationY);
        
        // Применяем вращение вокруг X (вертикальное)
        let x2 = x1;
        let y2 = y1 * Math.cos(this.rotationX) - z1 * Math.sin(this.rotationX);
        let z2 = y1 * Math.sin(this.rotationX) + z1 * Math.cos(this.rotationX);
        
        // Перспективная проекция
        const distance = 3;
        const factor = distance / (distance + z2 * 0.5);
        
        return { 
            x: x2 * factor,
            y: y2 * factor,
            z: z2
        };
    }
    
    draw() {
        if (!this.ctx || !this.container.clientWidth || !this.container.clientHeight) return;
        
        const ctx = this.ctx;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.35;
        
        // Очищаем canvas
        ctx.clearRect(0, 0, width, height);
        
        // Рисуем контур сферы (круг)
        ctx.strokeStyle = 'rgba(209, 213, 219, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Рисуем экватор
        ctx.strokeStyle = 'rgba(209, 213, 219, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let angle = 0; angle <= 360; angle += 2) {
            const angleRad = (angle * Math.PI) / 180;
            const x3d = Math.cos(angleRad);
            const y3d = 0;
            const z3d = Math.sin(angleRad);
            
            const proj = this.project3D(x3d, y3d, z3d);
            const screenX = centerX + proj.x * radius;
            const screenY = centerY + proj.y * radius;
            
            if (angle === 0) {
                ctx.moveTo(screenX, screenY);
            } else {
                ctx.lineTo(screenX, screenY);
            }
        }
        ctx.stroke();
        
        // Рисуем полупрозрачную заливку сферы
        ctx.fillStyle = 'rgba(243, 244, 246, 0.08)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Определяем, на какую метку указывает вектор
        const currentLabelText = this.getVectorStateLabel(this.vector);
        
        // Обновляем позиции меток синхронно с отрисовкой
        this.labelElements.forEach(({ element, label }) => {
            const pos = this.convertToOurCoordinates(label.pos);
            const proj = this.project3D(pos.x, pos.y, pos.z);
            
            const screenX = centerX + proj.x * radius;
            const screenY = centerY + proj.y * radius;
            
            // Используем transform для лучшей производительности
            element.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%)`;
            
            // Подсвечиваем метку, на которую указывает вектор
            const isHighlighted = label.text === currentLabelText;
            if (isHighlighted) {
                element.style.backgroundColor = 'rgba(15, 98, 254, 0.9)';
                element.style.color = 'white';
                element.style.padding = '2px 8px';
                element.style.borderRadius = '4px';
                element.style.textShadow = 'none';
            } else {
                element.style.backgroundColor = '';
                element.style.color = '#9ca3af';
                element.style.padding = '';
                element.style.borderRadius = '';
                element.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
            }
            
            // Управляем видимостью на основе глубины
            const isFront = proj.z > -0.3;
            element.style.opacity = isFront ? '1' : '0.4';
        });
        
        // Рисуем вектор состояния
        const pos = this.convertToOurCoordinates(this.vector);
        const length = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
        
        if (length > 0.001) {
            // Нормализуем вектор
            const nx = pos.x / length;
            const ny = pos.y / length;
            const nz = pos.z / length;
            
            // Проекция конца вектора
            const vecProj = this.project3D(nx, ny, nz);
            const arrowX = centerX + vecProj.x * radius;
            const arrowY = centerY + vecProj.y * radius;
            
            // Проекция начала вектора (центра сферы)
            const centerProj = this.project3D(0, 0, 0);
            const startX = centerX + centerProj.x * radius;
            const startY = centerY + centerProj.y * radius;
            
            // Рисуем стрелку вектора с градиентом
            const gradient = ctx.createLinearGradient(startX, startY, arrowX, arrowY);
            gradient.addColorStop(0, 'rgba(15, 98, 254, 0.6)');
            gradient.addColorStop(1, '#0f62fe');
            
            ctx.strokeStyle = gradient;
            ctx.fillStyle = '#0f62fe';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(arrowX, arrowY);
            ctx.stroke();
            
            // Рисуем наконечник стрелки
            const arrowAngle = Math.atan2(arrowY - startY, arrowX - startX);
            const arrowHeadSize = 12;
            ctx.beginPath();
            ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(
                arrowX - arrowHeadSize * Math.cos(arrowAngle - Math.PI / 6),
                arrowY - arrowHeadSize * Math.sin(arrowAngle - Math.PI / 6)
            );
            ctx.lineTo(
                arrowX - arrowHeadSize * Math.cos(arrowAngle + Math.PI / 6),
                arrowY - arrowHeadSize * Math.sin(arrowAngle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
            
            // Рисуем точку на конце вектора
            ctx.fillStyle = '#0f62fe';
            ctx.beginPath();
            ctx.arc(arrowX, arrowY, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        if (this.labelsContainer && this.labelsContainer.parentNode) {
            this.labelsContainer.parentNode.removeChild(this.labelsContainer);
        }
    }
}
