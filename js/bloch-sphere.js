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
        
        
        this.cachedProjections = new Map();
        this.needsRedraw = true;
        
        this.init();
        this.setupResizeObserver();
    }
    
    init() {
        
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'bloch-canvas';
        this.canvas.style.cursor = 'grab';
        this.canvas.style.touchAction = 'none'; 
        this.container.appendChild(this.canvas);
        
        
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
        
        this.labelsContainer = document.createElement('div');
        this.labelsContainer.style.position = 'absolute';
        this.labelsContainer.style.top = '0';
        this.labelsContainer.style.left = '0';
        this.labelsContainer.style.width = '100%';
        this.labelsContainer.style.height = '100%';
        this.labelsContainer.style.pointerEvents = 'none';
        this.labelsContainer.style.willChange = 'transform';
        this.container.appendChild(this.labelsContainer);
        
        
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
            labelEl.style.transition = 'none'; 
            this.labelsContainer.appendChild(labelEl);
            this.labelElements.push({ element: labelEl, label: label });
        });
    }
    
    setupEventListeners() {
        
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        
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
        
        const sensitivity = 0.015;
        
        this.rotationY += deltaX * sensitivity;
        this.rotationX += deltaY * sensitivity;
        
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
            
            
            this.rotationY -= deltaX * 0.01;
            this.rotationX -= deltaY * 0.01;
            this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX));
            
            this.lastMouseX = mouseX;
            this.lastMouseY = mouseY;
            this.needsRedraw = true;
        } else if (e.touches.length === 2) {
            
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
        
        
        
        
        
        const eps = 0.15;
        
        
        const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (length < 0.001) return '|ψ⟩';
        
        const nx = v.x / length;
        const ny = v.y / length;
        const nz = v.z / length;
        
        
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
    
    
    
    
    
    convertToOurCoordinates(vec) {
        return {
            x: vec.x,  
            y: vec.z,  
            z: vec.y   
        };
    }
    
    project3D(x, y, z) {
        let x1 = x;
        let y1 = y;
        let z1 = z;
        
        let x2 = x1 * Math.cos(this.rotationY) - z1 * Math.sin(this.rotationY);
        let y2 = y1;
        let z2 = x1 * Math.sin(this.rotationY) + z1 * Math.cos(this.rotationY);
        
        let x3 = x2;
        let y3 = y2 * Math.cos(this.rotationX) - z2 * Math.sin(this.rotationX);
        let z3 = y2 * Math.sin(this.rotationX) + z2 * Math.cos(this.rotationX);
        
        const distance = 3;
        const factor = distance / (distance + z3 * 0.5);
        
        return { 
            x: x3 * factor,
            y: y3 * factor,
            z: z3
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
        
        
        ctx.clearRect(0, 0, width, height);
        
        
        ctx.strokeStyle = 'rgba(209, 213, 219, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        
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
        
        
        ctx.fillStyle = 'rgba(243, 244, 246, 0.08)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        
        const currentLabelText = this.getVectorStateLabel(this.vector);
        
        
        this.labelElements.forEach(({ element, label }) => {
            const pos = this.convertToOurCoordinates(label.pos);
            const proj = this.project3D(pos.x, pos.y, pos.z);
            
            const screenX = centerX + proj.x * radius;
            const screenY = centerY + proj.y * radius;
            
            
            element.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%)`;
            
            
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
            
            
            const isFront = proj.z > -0.3;
            element.style.opacity = isFront ? '1' : '0.4';
        });
        
        
        const pos = this.convertToOurCoordinates(this.vector);
        const length = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
        
        if (length > 0.001) {
            
            const nx = pos.x / length;
            const ny = pos.y / length;
            const nz = pos.z / length;
            
            
            const vecProj = this.project3D(nx, ny, nz);
            const arrowX = centerX + vecProj.x * radius;
            const arrowY = centerY + vecProj.y * radius;
            
            
            const centerProj = this.project3D(0, 0, 0);
            const startX = centerX + centerProj.x * radius;
            const startY = centerY + centerProj.y * radius;
            
            
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
