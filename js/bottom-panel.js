class BottomPanel {
    constructor(container, options = {}) {
        this.container = container;
        this.metrics = options.metrics || {};
        this.eventLog = options.eventLog || [];
        this.activeTab = 'metrics'; 
        this.render();
        this.attachEventListeners();
    }
    
    setMetrics(metrics) {
        this.metrics = metrics || {};
        this.render();
    }
    
    setEventLog(eventLog) {
        this.eventLog = eventLog || [];
        this.render();
    }
    
    update(metrics, eventLog) {
        this.metrics = metrics || {};
        this.eventLog = eventLog || [];
        this.render();
    }
    
    attachEventListeners() {
        
        setTimeout(() => {
            const metricsTab = this.container.querySelector('.tab-metrics');
            const logTab = this.container.querySelector('.tab-log');
            
            if (metricsTab) {
                metricsTab.addEventListener('click', () => {
                    this.activeTab = 'metrics';
                    this.render();
                });
            }
            
            if (logTab) {
                logTab.addEventListener('click', () => {
                    this.activeTab = 'log';
                    this.render();
                });
            }
        }, 0);
    }
    
    render() {
        this.container.innerHTML = `
            <div class="metrics-and-log bg-gray-800 rounded-2xl">
                <!-- Вкладки -->
                <div class="tabs flex border-b border-gray-700">
                    <button 
                        class="tab tab-metrics py-3 px-6 font-semibold transition-colors ${this.activeTab === 'metrics' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}"
                    >
                        Метрики
                    </button>
                    <button 
                        class="tab tab-log py-3 px-6 font-semibold transition-colors ${this.activeTab === 'log' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}"
                    >
                        Лог событий
                    </button>
                </div>

                <!-- Контент вкладок -->
                <div class="tab-content p-6">
                    ${this.activeTab === 'metrics' ? this.renderMetrics() : this.renderEventLog()}
                </div>
            </div>
        `;
        
        this.attachEventListeners();
    }
    
    renderMetrics() {
        const metricsCards = [
            {
                title: 'QBER',
                key: 'qber',
                format: 'percent',
                color: 'blue',
                defaultValue: 0
            },
            {
                title: 'Атаковано Евой',
                key: 'eve_attacked_count',
                format: 'number',
                color: 'orange',
                defaultValue: 0
            },
            {
                title: 'Размер ключа',
                key: 'key_size',
                format: 'number',
                color: 'green',
                defaultValue: 0
            }
        ];
        
        const cardsHtml = metricsCards.map(card => {
            const value = this.metrics[card.key] !== undefined ? this.metrics[card.key] : card.defaultValue;
            return this.renderMetricCard(card.title, value, card.format, card.color);
        }).join('');
        
        return `
            <div class="metrics-grid grid grid-cols-2 md:grid-cols-4 gap-4">
                ${cardsHtml}
            </div>
        `;
    }
    
    renderMetricCard(title, value, format = 'number', color = 'blue') {
        
        
        const formattedValue = format === 'percent' 
            ? `${(value > 1 ? value : value * 100).toFixed(2)}%` 
            : this.formatMetricValue(value);
        
        const colorClasses = {
            blue: 'bg-blue-500/20 border-blue-400/40 text-blue-200',
            red: 'bg-red-500/20 border-red-400/40 text-red-200',
            orange: 'bg-orange-500/20 border-orange-400/40 text-orange-200',
            green: 'bg-green-500/20 border-green-400/40 text-green-200'
        };
        
        const colorClass = colorClasses[color] || colorClasses.blue;
        
        return `
            <div class="metric-card ${colorClass} border rounded-xl p-4">
                <div class="metric-title text-sm font-medium mb-2 opacity-80">
                    ${this.escapeHtml(title)}
                </div>
                <div class="metric-value text-2xl font-bold">
                    ${formattedValue}
                </div>
            </div>
        `;
    }
    
    renderEventLog() {
        if (!this.eventLog || this.eventLog.length === 0) {
            return `
                <div class="text-gray-400 text-center py-4">
                    Лог событий пуст
                </div>
            `;
        }
        
        
        const events = [...this.eventLog].reverse();
        
        const eventItems = events.map((event, index) => {
            const timestamp = event.timestamp ? this.formatTimestamp(event.timestamp) : '';
            const message = event.message || event;
            const type = event.type || 'info';
            const logEntryClass = this.getLogEntryClass(type);
            
            return `
                <div class="log-entry py-2 border-b border-gray-700 last:border-b-0 ${logEntryClass}">
                    <div class="flex items-start gap-3">
                        <span class="timestamp text-xs text-gray-500 mt-1 flex-shrink-0">
                            ${timestamp}
                        </span>
                        <span class="message text-sm">
                            ${this.escapeHtml(message)}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="log-container log-container-scrollable">
                ${eventItems}
            </div>
        `;
    }
    
    getLogEntryClass(type) {
        switch (type) {
            case 'error':
                return 'text-red-400';
            case 'warning':
                return 'text-yellow-400';
            default:
                return 'text-gray-300';
        }
    }
    
    formatMetricValue(value) {
        if (typeof value === 'number') {
            if (value % 1 === 0) {
                return value.toString();
            }
            return value.toFixed(2);
        }
        return String(value);
    }
    
    formatTimestamp(timestamp) {
        if (typeof timestamp === 'number') {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        return timestamp;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

