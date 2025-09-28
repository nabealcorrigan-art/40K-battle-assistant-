// 40K Battle Assistant JavaScript

// Shape class to represent drawable shapes
class Shape {
    constructor(id, type, startPoint, endPoint, color, thickness, name = null) {
        this.id = id;
        this.type = type;
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.color = color;
        this.thickness = thickness;
        this.selected = false;
        this.name = name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${id}`;
    }
    
    // Check if a point is near this shape (for selection)
    isPointNear(point, tolerance = 10) {
        switch (this.type) {
            case 'line':
            case 'arrow':
                return this.isPointNearLine(point, tolerance);
            case 'rectangle':
                return this.isPointNearRectangle(point, tolerance);
            case 'circle':
                return this.isPointNearCircle(point, tolerance);
            case 'triangle':
            case 'diamond':
            case 'hexagon':
            case 'star':
                return this.isPointNearPolygon(point, tolerance);
            default:
                return false;
        }
    }
    
    isPointNearLine(point, tolerance) {
        const { startPoint, endPoint } = this;
        const A = point.x - startPoint.x;
        const B = point.y - startPoint.y;
        const C = endPoint.x - startPoint.x;
        const D = endPoint.y - startPoint.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = startPoint.x;
            yy = startPoint.y;
        } else if (param > 1) {
            xx = endPoint.x;
            yy = endPoint.y;
        } else {
            xx = startPoint.x + param * C;
            yy = startPoint.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy) <= tolerance;
    }
    
    isPointNearRectangle(point, tolerance) {
        const { startPoint, endPoint } = this;
        const left = Math.min(startPoint.x, endPoint.x) - tolerance;
        const right = Math.max(startPoint.x, endPoint.x) + tolerance;
        const top = Math.min(startPoint.y, endPoint.y) - tolerance;
        const bottom = Math.max(startPoint.y, endPoint.y) + tolerance;
        
        // Check if point is inside the expanded rectangle
        if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
            // Check if it's near the border (not inside)
            const innerLeft = Math.min(startPoint.x, endPoint.x) + tolerance;
            const innerRight = Math.max(startPoint.x, endPoint.x) - tolerance;
            const innerTop = Math.min(startPoint.y, endPoint.y) + tolerance;
            const innerBottom = Math.max(startPoint.y, endPoint.y) - tolerance;
            
            return !(point.x > innerLeft && point.x < innerRight && point.y > innerTop && point.y < innerBottom);
        }
        return false;
    }
    
    isPointNearCircle(point, tolerance) {
        const { startPoint, endPoint } = this;
        const radius = Math.sqrt(Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2));
        const distance = Math.sqrt(Math.pow(point.x - startPoint.x, 2) + Math.pow(point.y - startPoint.y, 2));
        return Math.abs(distance - radius) <= tolerance;
    }
    
    isPointNearPolygon(point, tolerance) {
        // For polygon shapes, check if point is within the bounding area with tolerance
        const { startPoint, endPoint } = this;
        const left = Math.min(startPoint.x, endPoint.x) - tolerance;
        const right = Math.max(startPoint.x, endPoint.x) + tolerance;
        const top = Math.min(startPoint.y, endPoint.y) - tolerance;
        const bottom = Math.max(startPoint.y, endPoint.y) + tolerance;
        
        return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
    }
    
    // Move the shape by a delta
    move(deltaX, deltaY) {
        this.startPoint.x += deltaX;
        this.startPoint.y += deltaY;
        this.endPoint.x += deltaX;
        this.endPoint.y += deltaY;
    }
    
    // Update shape size (for circles and rectangles)
    resize(newEndPoint) {
        this.endPoint = newEndPoint;
    }
}

class BattleAssistant {
    constructor() {
        this.currentTurn = 1;
        this.currentPhase = 'command';
        this.battleData = {
            army: null,
            stratagems: [],
            turns: {}
        };
        this.phases = ['command', 'movement', 'shooting', 'charge', 'fight', 'morale'];
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSavedData();
        this.initializeWhiteboardState();
    }

    initializeWhiteboardState() {
        const whiteboardSection = document.getElementById('strategy-whiteboard-modal');
        const toggleButton = document.getElementById('toggle-whiteboard');
        
        // Set initial button state based on whiteboard visibility
        if (whiteboardSection && whiteboardSection.classList.contains('hidden')) {
            toggleButton.classList.remove('active');
        } else if (toggleButton) {
            toggleButton.classList.add('active');
        }
    }

    bindEvents() {
        // File import events
        document.getElementById('army-import').addEventListener('change', (e) => this.handleArmyImport(e));
        document.getElementById('stratagem-import').addEventListener('change', (e) => this.handleStratagemImport(e));
        
        // Battle control events
        document.getElementById('start-battle').addEventListener('click', () => this.startBattle());
        document.getElementById('next-turn').addEventListener('click', () => this.nextTurn());
        
        // Phase navigation
        document.querySelectorAll('.phase-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchPhase(e.target.dataset.phase));
        });
        
        // Notes and image uploads for each phase
        this.phases.forEach(phase => {
            const notesElement = document.getElementById(`${phase}-notes`);
            const imageElement = document.getElementById(`${phase}-image`);
            
            if (notesElement) {
                notesElement.addEventListener('input', () => this.savePhaseData(phase));
            }
            
            if (imageElement) {
                imageElement.addEventListener('change', (e) => this.handleImageUpload(e, phase));
            }
        });
        
        // Reference panel toggle
        document.getElementById('toggle-reference').addEventListener('click', () => this.toggleReferencePanel());
        
        // Whiteboard toggle
        document.getElementById('toggle-whiteboard').addEventListener('click', () => this.toggleWhiteboardPanel());
        
        // Whiteboard modal close button
        document.getElementById('close-whiteboard-modal').addEventListener('click', () => this.toggleWhiteboardPanel());
        
        // Close modal when clicking outside
        document.getElementById('strategy-whiteboard-modal').addEventListener('click', (e) => {
            if (e.target.id === 'strategy-whiteboard-modal') {
                this.toggleWhiteboardPanel();
            }
        });
        
        // Auto-save every 10 seconds
        setInterval(() => this.saveToLocalStorage(), 10000);
    }

    async handleArmyImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const content = await this.readFileAsText(file);
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');
            
            this.battleData.army = this.parseArmyList(doc);
            this.displayArmyPreview();
            this.updateStartButton();
            
        } catch (error) {
            console.error('Error importing army list:', error);
            alert('Error importing army list. Please check the file format.');
        }
    }

    async handleStratagemImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const content = await this.readFileAsText(file);
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');
            
            this.battleData.stratagems = this.parseStratagemList(doc);
            this.displayStratagemPreview();
            this.updateStratagemReminders();
            this.updateStartButton();
            
        } catch (error) {
            console.error('Error importing stratagems:', error);
            alert('Error importing stratagems. Please check the file format.');
        }
    }

    parseArmyList(doc) {
        // Look for common army list structures
        const army = {
            units: [],
            detachments: [],
            totalPoints: 0
        };

        // Try to find units - look for various common patterns
        const possibleUnitSelectors = [
            '.unit', '.roster-unit', '[data-unit]',
            'tr:has(td)', 'li:contains("pts")', 
            'div:contains("pts")', 'p:contains("pts")'
        ];

        let units = [];
        for (const selector of possibleUnitSelectors) {
            try {
                const elements = doc.querySelectorAll(selector);
                if (elements.length > 0) {
                    units = Array.from(elements);
                    break;
                }
            } catch (e) {
                // Continue with next selector
            }
        }

        // If no specific selectors work, try to extract from text content
        if (units.length === 0) {
            const bodyText = doc.body ? doc.body.textContent : doc.textContent;
            const lines = bodyText.split('\n').filter(line => line.trim());
            
            lines.forEach(line => {
                if (line.match(/\d+\s*pts?|\d+\s*points?/i)) {
                    const pointsMatch = line.match(/(\d+)\s*pts?|\d+\s*points?/i);
                    const points = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                    
                    army.units.push({
                        name: line.replace(/\d+\s*pts?|\d+\s*points?/i, '').trim(),
                        points: points,
                        text: line.trim()
                    });
                    
                    army.totalPoints += points;
                }
            });
        } else {
            // Process found elements
            units.forEach(element => {
                const text = element.textContent || element.innerText || '';
                const pointsMatch = text.match(/(\d+)\s*pts?|\d+\s*points?/i);
                const points = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                
                if (text.trim()) {
                    army.units.push({
                        name: text.replace(/\d+\s*pts?|\d+\s*points?/i, '').trim(),
                        points: points,
                        text: text.trim()
                    });
                    
                    army.totalPoints += points;
                }
            });
        }

        return army;
    }

    parseStratagemList(doc) {
        const stratagems = [];
        
        // Look for common stratagem structures
        const possibleSelectors = [
            '.stratagem', '.strategy', '[data-stratagem]',
            'div:contains("CP")', 'p:contains("CP")',
            'tr:has(td:contains("CP"))'
        ];

        let stratagemElements = [];
        for (const selector of possibleSelectors) {
            try {
                const elements = doc.querySelectorAll(selector);
                if (elements.length > 0) {
                    stratagemElements = Array.from(elements);
                    break;
                }
            } catch (e) {
                // Continue with next selector
            }
        }

        // If no specific selectors work, try to extract from text content
        if (stratagemElements.length === 0) {
            const bodyText = doc.body ? doc.body.textContent : doc.textContent;
            const lines = bodyText.split('\n').filter(line => line.trim());
            
            lines.forEach(line => {
                if (line.match(/\d+\s*CP|command\s*point/i)) {
                    const cpMatch = line.match(/(\d+)\s*CP/i);
                    const cost = cpMatch ? parseInt(cpMatch[1]) : 1;
                    
                    // Try to identify phase
                    const phase = this.identifyStratagemPhase(line);
                    
                    stratagems.push({
                        name: line.replace(/\d+\s*CP/i, '').trim(),
                        cost: cost,
                        phase: phase,
                        description: line.trim()
                    });
                }
            });
        } else {
            // Process found elements
            stratagemElements.forEach(element => {
                const text = element.textContent || element.innerText || '';
                const cpMatch = text.match(/(\d+)\s*CP/i);
                const cost = cpMatch ? parseInt(cpMatch[1]) : 1;
                
                // Try to extract name (usually first line or heading)
                const lines = text.split('\n').filter(line => line.trim());
                const name = lines[0] || text.substring(0, 50).trim();
                
                const phase = this.identifyStratagemPhase(text);
                
                if (text.trim()) {
                    stratagems.push({
                        name: name.replace(/\d+\s*CP/i, '').trim(),
                        cost: cost,
                        phase: phase,
                        description: text.trim()
                    });
                }
            });
        }

        return stratagems;
    }

    identifyStratagemPhase(text) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('command') || lowerText.includes('start of turn')) return 'command';
        if (lowerText.includes('movement') || lowerText.includes('move')) return 'movement';
        if (lowerText.includes('shooting') || lowerText.includes('shoot') || lowerText.includes('ranged')) return 'shooting';
        if (lowerText.includes('charge') || lowerText.includes('charging')) return 'charge';
        if (lowerText.includes('fight') || lowerText.includes('combat') || lowerText.includes('melee')) return 'fight';
        if (lowerText.includes('morale') || lowerText.includes('battleshock')) return 'morale';
        
        return 'any'; // Default for stratagems that can be used in multiple phases
    }

    displayArmyPreview() {
        const preview = document.getElementById('army-preview');
        const army = this.battleData.army;
        
        if (army && army.units.length > 0) {
            preview.innerHTML = `
                <h4>Army List (${army.totalPoints} pts)</h4>
                <div class="army-units">
                    ${army.units.slice(0, 5).map(unit => `
                        <div class="army-unit">
                            <strong>${unit.name}</strong>
                            ${unit.points > 0 ? `<span class="points">(${unit.points} pts)</span>` : ''}
                        </div>
                    `).join('')}
                    ${army.units.length > 5 ? `<p>... and ${army.units.length - 5} more units</p>` : ''}
                </div>
            `;
            preview.classList.add('has-content');
        } else {
            preview.innerHTML = '<p>No army units found in the uploaded file.</p>';
            preview.classList.remove('has-content');
        }
        
        this.updateReferencePanel();
    }

    displayStratagemPreview() {
        const preview = document.getElementById('stratagem-preview');
        const stratagems = this.battleData.stratagems;
        
        if (stratagems.length > 0) {
            preview.innerHTML = `
                <h4>Stratagems (${stratagems.length} total)</h4>
                <div class="stratagem-units">
                    ${stratagems.slice(0, 3).map(stratagem => `
                        <div class="stratagem-item">
                            <div class="stratagem-name">${stratagem.name}</div>
                            <div class="stratagem-cost">${stratagem.cost} CP - ${stratagem.phase}</div>
                        </div>
                    `).join('')}
                    ${stratagems.length > 3 ? `<p>... and ${stratagems.length - 3} more stratagems</p>` : ''}
                </div>
            `;
            preview.classList.add('has-content');
        } else {
            preview.innerHTML = '<p>No stratagems found in the uploaded file.</p>';
            preview.classList.remove('has-content');
        }
        
        this.updateReferencePanel();
    }

    updateStartButton() {
        const startButton = document.getElementById('start-battle');
        const hasArmy = this.battleData.army && this.battleData.army.units.length > 0;
        const hasStratagems = this.battleData.stratagems.length > 0;
        
        if (hasArmy || hasStratagems) {
            startButton.disabled = false;
            startButton.textContent = 'Start Battle';
        } else {
            startButton.disabled = true;
            startButton.textContent = 'Import Army List or Stratagems to Start';
        }
    }

    startBattle() {
        document.getElementById('setup-section').classList.remove('active');
        document.getElementById('battle-section').classList.add('active');
        
        this.initializeTurn(1);
        this.updateStratagemReminders();
        this.saveToLocalStorage();
    }

    initializeTurn(turnNumber) {
        if (!this.battleData.turns[turnNumber]) {
            this.battleData.turns[turnNumber] = {};
            this.phases.forEach(phase => {
                this.battleData.turns[turnNumber][phase] = {
                    notes: '',
                    image: null,
                    timestamp: null
                };
            });
        }
        
        this.currentTurn = turnNumber;
        document.getElementById('current-turn').textContent = turnNumber;
        
        // Load existing data for current turn
        this.loadTurnData();
    }

    loadTurnData() {
        const turnData = this.battleData.turns[this.currentTurn];
        if (!turnData) return;
        
        this.phases.forEach(phase => {
            const phaseData = turnData[phase];
            if (phaseData) {
                const notesElement = document.getElementById(`${phase}-notes`);
                const imagePreview = document.getElementById(`${phase}-image-preview`);
                
                if (notesElement) {
                    notesElement.value = phaseData.notes || '';
                }
                
                if (imagePreview && phaseData.image) {
                    imagePreview.innerHTML = `<img src="${phaseData.image}" alt="${phase} phase image">`;
                    imagePreview.classList.add('has-image');
                }
            }
        });
    }

    nextTurn() {
        // Save current turn data
        this.saveCurrentTurnToHistory();
        
        // Initialize next turn
        this.initializeTurn(this.currentTurn + 1);
        
        // Reset to command phase
        this.switchPhase('command');
        
        this.saveToLocalStorage();
    }

    saveCurrentTurnToHistory() {
        const turnData = this.battleData.turns[this.currentTurn];
        if (!turnData) return;
        
        this.phases.forEach(phase => {
            const phaseData = turnData[phase];
            if (phaseData && (phaseData.notes.trim() || phaseData.image)) {
                this.addToHistory(this.currentTurn, phase, phaseData);
            }
        });
    }

    addToHistory(turn, phase, data) {
        const historyLog = document.getElementById('history-log');
        
        const historyEntry = document.createElement('div');
        historyEntry.className = 'history-entry fade-in';
        
        historyEntry.innerHTML = `
            <div class="history-entry-header">
                <span class="history-turn">Turn ${turn}</span>
                <span class="history-phase">${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase</span>
            </div>
            ${data.notes ? `<div class="history-content">${data.notes}</div>` : ''}
            ${data.image ? `<div class="history-image"><img src="${data.image}" alt="${phase} phase"></div>` : ''}
        `;
        
        historyLog.insertBefore(historyEntry, historyLog.firstChild);
    }

    switchPhase(phase) {
        // Save current phase data before switching
        this.savePhaseData(this.currentPhase);
        
        // Update UI
        document.querySelectorAll('.phase-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.phase === phase);
        });
        
        document.querySelectorAll('.phase-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.phase === phase);
        });
        
        this.currentPhase = phase;
        this.updateStratagemReminders();
    }

    savePhaseData(phase) {
        if (!this.battleData.turns[this.currentTurn]) {
            this.initializeTurn(this.currentTurn);
        }
        
        const notesElement = document.getElementById(`${phase}-notes`);
        if (notesElement) {
            this.battleData.turns[this.currentTurn][phase].notes = notesElement.value;
            this.battleData.turns[this.currentTurn][phase].timestamp = new Date().toISOString();
        }
    }

    async handleImageUpload(event, phase) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const imageDataUrl = await this.readFileAsDataURL(file);
            
            // Initialize turn data if needed
            if (!this.battleData.turns[this.currentTurn]) {
                this.initializeTurn(this.currentTurn);
            }
            
            // Save image data
            this.battleData.turns[this.currentTurn][phase].image = imageDataUrl;
            
            // Update preview
            const preview = document.getElementById(`${phase}-image-preview`);
            preview.innerHTML = `<img src="${imageDataUrl}" alt="${phase} phase image">`;
            preview.classList.add('has-image');
            
            this.saveToLocalStorage();
            
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Error uploading image. Please try again.');
        }
    }

    updateStratagemReminders() {
        this.phases.forEach(phase => {
            const container = document.getElementById(`${phase}-stratagems`);
            if (!container) return;
            
            const relevantStratagems = this.battleData.stratagems.filter(stratagem => 
                stratagem.phase === phase || stratagem.phase === 'any'
            );
            
            if (relevantStratagems.length > 0) {
                container.innerHTML = relevantStratagems.map(stratagem => `
                    <div class="stratagem-item" onclick="this.classList.toggle('expanded')">
                        <div class="stratagem-name">${stratagem.name}</div>
                        <div class="stratagem-cost">${stratagem.cost} CP</div>
                        <div class="stratagem-description" style="display: none; margin-top: 0.5rem; font-size: 0.9rem;">
                            ${stratagem.description}
                        </div>
                    </div>
                `).join('');
                
                // Add click handlers to expand/collapse descriptions
                container.querySelectorAll('.stratagem-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const description = item.querySelector('.stratagem-description');
                        const isExpanded = item.classList.contains('expanded');
                        
                        if (isExpanded) {
                            description.style.display = 'none';
                            item.classList.remove('expanded');
                        } else {
                            description.style.display = 'block';
                            item.classList.add('expanded');
                        }
                    });
                });
            } else {
                container.innerHTML = '<p>No relevant stratagems for this phase.</p>';
            }
        });
    }

    updateReferencePanel() {
        // Update army display
        const armyDisplay = document.getElementById('army-display');
        const army = this.battleData.army;
        
        if (army && army.units.length > 0) {
            armyDisplay.innerHTML = army.units.map(unit => `
                <div class="army-unit">
                    <strong>${unit.name}</strong>
                    ${unit.points > 0 ? `<span class="points">(${unit.points} pts)</span>` : ''}
                </div>
            `).join('');
        } else {
            armyDisplay.innerHTML = '<p>No army list imported.</p>';
        }
        
        // Update stratagems display
        const stratagemsDisplay = document.getElementById('stratagems-display');
        const stratagems = this.battleData.stratagems;
        
        if (stratagems.length > 0) {
            stratagemsDisplay.innerHTML = stratagems.map(stratagem => `
                <div class="stratagem-reference-item">
                    <div class="stratagem-name">${stratagem.name}</div>
                    <div class="stratagem-cost">${stratagem.cost} CP - ${stratagem.phase}</div>
                </div>
            `).join('');
        } else {
            stratagemsDisplay.innerHTML = '<p>No stratagems imported.</p>';
        }
    }

    toggleReferencePanel() {
        const panel = document.getElementById('reference-panel');
        panel.classList.toggle('open');
    }

    toggleWhiteboardPanel() {
        const whiteboardModal = document.getElementById('strategy-whiteboard-modal');
        const toggleButton = document.getElementById('toggle-whiteboard');
        
        whiteboardModal.classList.toggle('hidden');
        
        // Update button active state based on whiteboard visibility
        if (whiteboardModal.classList.contains('hidden')) {
            toggleButton.classList.remove('active');
        } else {
            toggleButton.classList.add('active');
            // Initialize canvas sizing when modal opens
            if (window.strategyWhiteboard) {
                window.strategyWhiteboard.updateCanvasSize();
            }
        }
    }

    // Utility functions
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Local storage functions
    saveToLocalStorage() {
        try {
            const dataToSave = {
                ...this.battleData,
                currentTurn: this.currentTurn,
                currentPhase: this.currentPhase,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('40k-battle-assistant', JSON.stringify(dataToSave));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    loadSavedData() {
        try {
            const saved = localStorage.getItem('40k-battle-assistant');
            if (saved) {
                const data = JSON.parse(saved);
                
                // Only load if it's recent (within 7 days)
                const savedDate = new Date(data.savedAt);
                const now = new Date();
                const daysDiff = (now - savedDate) / (1000 * 60 * 60 * 24);
                
                if (daysDiff <= 7) {
                    this.battleData = {
                        army: data.army || null,
                        stratagems: data.stratagems || [],
                        turns: data.turns || {}
                    };
                    this.currentTurn = data.currentTurn || 1;
                    this.currentPhase = data.currentPhase || 'command';
                    
                    // Update UI if data was loaded
                    if (this.battleData.army) {
                        this.displayArmyPreview();
                    }
                    if (this.battleData.stratagems.length > 0) {
                        this.displayStratagemPreview();
                        this.updateStratagemReminders();
                    }
                    this.updateStartButton();
                }
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }

    // Reset function
    resetBattle() {
        if (confirm('Are you sure you want to reset the current battle? All progress will be lost.')) {
            this.battleData.turns = {};
            this.currentTurn = 1;
            this.currentPhase = 'command';
            
            // Clear all notes and images
            this.phases.forEach(phase => {
                const notesElement = document.getElementById(`${phase}-notes`);
                const imagePreview = document.getElementById(`${phase}-image-preview`);
                
                if (notesElement) notesElement.value = '';
                if (imagePreview) {
                    imagePreview.innerHTML = '';
                    imagePreview.classList.remove('has-image');
                }
            });
            
            // Clear history
            document.getElementById('history-log').innerHTML = '';
            
            // Switch back to setup
            document.getElementById('battle-section').classList.remove('active');
            document.getElementById('setup-section').classList.add('active');
            
            this.saveToLocalStorage();
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const battleAssistant = new BattleAssistant();
    
    // Initialize strategy whiteboard and make it globally accessible
    window.strategyWhiteboard = new StrategyWhiteboard();
});

/**
 * Strategy Whiteboard Class
 * Handles the strategy whiteboard with PNG overlays and drawing tools
 */
class StrategyWhiteboard {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.backgroundCanvas = null;
        this.backgroundCtx = null;
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.penColor = '#FF0000';
        this.penThickness = 2;
        this.eraserSize = 15;
        this.overlayOpacity = 0.7;
        this.currentLayout = 'none';
        this.backgroundImageScale = { width: 100, height: 100 };
        this.backgroundImagePosition = { x: 0, y: 0 };
        this.maintainBackgroundAspectRatio = true;
        this.backgroundOriginalAspectRatio = 1;
        this.backgroundImage = null;
        this.startPoint = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        
        // Canvas size management
        this.gameSizes = {
            'killteam': { width: 600, height: 440, name: 'Kill Team (22" x 16")' },
            'incursion': { width: 800, height: 600, name: 'Incursion (44" x 30")' },
            'strikeforce': { width: 960, height: 720, name: 'Strike Force (44" x 36")' },
            'onslaught': { width: 1200, height: 900, name: 'Onslaught (44" x 45")' },
            'custom': { width: 800, height: 600, name: 'Custom Size' }
        };
        this.currentGameSize = 'incursion';
        
        // Shape management system
        this.shapes = [];
        this.selectedShape = null;
        this.isDraggingShape = false;
        this.dragOffset = { x: 0, y: 0 };
        this.shapeIdCounter = 0;
        
        // Shape placement system
        this.placementMode = false;
        this.selectedShapeType = null;
        this.defaultShapeSize = 50; // Default size for placed shapes
        
        // Custom image overlay properties
        this.customImage = null;
        this.customImageElement = null;
        this.customImageOpacity = 1.0;
        this.customImageScale = { width: 100, height: 100 };
        this.customImagePosition = { x: 0, y: 0 };
        this.isImageLocked = false;
        this.maintainAspectRatio = true;
        this.originalAspectRatio = 1;
        this.isDraggingImage = false;
        this.dragStartPos = null;
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.bindEvents();
        this.updateCanvasSize();
    }

    setupCanvas() {
        this.canvas = document.getElementById('strategy-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.backgroundCanvas = document.getElementById('strategy-background-canvas');
        this.backgroundCtx = this.backgroundCanvas.getContext('2d');
        
        // Create preview canvas for shape drawing
        this.previewCanvas = document.createElement('canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');
        
        // Set canvas properties
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Set background canvas as background layer
        this.backgroundCanvas.style.opacity = this.overlayOpacity;
    }

    bindEvents() {
        // Tool selection
        document.querySelectorAll('#strategy-whiteboard .tool-button').forEach(button => {
            button.addEventListener('click', (e) => this.selectTool(e.target.dataset.tool));
        });

        // Shape placement buttons
        document.querySelectorAll('.shape-place-button').forEach(button => {
            button.addEventListener('click', (e) => this.selectShapeForPlacement(e.target.dataset.shape));
        });

        // Drawing options
        document.getElementById('whiteboard-pen-color').addEventListener('change', (e) => {
            this.penColor = e.target.value;
            // Update selected shape color if one is selected
            if (this.selectedShape) {
                this.updateSelectedShapeColor(e.target.value);
            }
        });

        document.getElementById('whiteboard-pen-thickness').addEventListener('input', (e) => {
            this.penThickness = parseInt(e.target.value);
            document.getElementById('whiteboard-thickness-value').textContent = `${this.penThickness}px`;
            // Update selected shape thickness if one is selected
            if (this.selectedShape) {
                this.updateSelectedShapeThickness(this.penThickness);
            }
        });

        // Overlay selection
        document.querySelectorAll('.layout-thumbnail').forEach(thumbnail => {
            thumbnail.addEventListener('click', (e) => {
                const layout = e.currentTarget.dataset.layout;
                this.selectLayout(layout);
            });
        });

        // Game size selection
        document.querySelectorAll('.game-size-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const gameSize = e.currentTarget.dataset.gameSize;
                this.selectGameSize(gameSize);
            });
        });

        // Overlay opacity
        document.getElementById('whiteboard-overlay-opacity').addEventListener('input', (e) => {
            this.overlayOpacity = parseInt(e.target.value) / 100;
            document.getElementById('whiteboard-opacity-value').textContent = `${e.target.value}%`;
            this.backgroundCanvas.style.opacity = this.overlayOpacity;
        });

        // Background image scaling controls
        document.getElementById('background-width-scale').addEventListener('input', (e) => {
            this.updateBackgroundImageScale('width', parseInt(e.target.value));
        });

        document.getElementById('background-height-scale').addEventListener('input', (e) => {
            this.updateBackgroundImageScale('height', parseInt(e.target.value));
        });

        document.getElementById('maintain-background-aspect-ratio').addEventListener('change', (e) => {
            this.maintainBackgroundAspectRatio = e.target.checked;
        });

        // Background image position controls
        document.getElementById('background-x-position').addEventListener('input', (e) => {
            this.backgroundImagePosition.x = parseInt(e.target.value);
            document.getElementById('background-x-position-value').textContent = `${e.target.value}%`;
            this.redrawBackgroundImage();
        });

        document.getElementById('background-y-position').addEventListener('input', (e) => {
            this.backgroundImagePosition.y = parseInt(e.target.value);
            document.getElementById('background-y-position-value').textContent = `${e.target.value}%`;
            this.redrawBackgroundImage();
        });

        // Whiteboard actions
        document.getElementById('clear-whiteboard').addEventListener('click', () => {
            this.clearWhiteboard();
        });

        document.getElementById('export-whiteboard').addEventListener('click', () => {
            this.exportWhiteboard();
        });

        // Canvas mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', (e) => this.stopDrawing(e));
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Canvas touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });

        // Custom image upload and controls
        document.getElementById('custom-image-upload').addEventListener('change', (e) => {
            this.handleCustomImageUpload(e);
        });

        document.getElementById('remove-custom-image').addEventListener('click', () => {
            this.removeCustomImage();
        });

        document.getElementById('image-width-scale').addEventListener('input', (e) => {
            this.updateImageScale('width', parseInt(e.target.value));
        });

        document.getElementById('image-height-scale').addEventListener('input', (e) => {
            this.updateImageScale('height', parseInt(e.target.value));
        });

        document.getElementById('maintain-aspect-ratio').addEventListener('change', (e) => {
            this.maintainAspectRatio = e.target.checked;
        });

        document.getElementById('custom-image-opacity').addEventListener('input', (e) => {
            this.customImageOpacity = parseInt(e.target.value) / 100;
            document.getElementById('custom-opacity-value').textContent = `${e.target.value}%`;
            this.updateCustomImageDisplay();
        });

        document.getElementById('lock-image-position').addEventListener('change', (e) => {
            this.isImageLocked = e.target.checked;
            this.updateImageLockState();
        });

        // Custom image dragging events
        this.setupCustomImageDragging();
        
        // Keyboard events for shape manipulation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedShape) {
                    e.preventDefault();
                    this.deleteSelectedShape();
                }
            }
            if (e.key === 'Escape') {
                this.deselectAllShapes();
            }
        });
    }

    selectTool(tool) {
        this.currentTool = tool;
        
        // Exit placement mode when selecting a drawing tool
        if (this.placementMode) {
            this.exitPlacementMode();
        }
        
        // Update UI
        document.querySelectorAll('#strategy-whiteboard .tool-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`#strategy-whiteboard [data-tool="${tool}"]`).classList.add('active');
        
        // Update cursor
        this.canvas.className = '';
        this.canvas.classList.add(`${tool}-mode`);
    }

    selectGameSize(gameSize) {
        this.currentGameSize = gameSize;
        
        // Update UI
        document.querySelectorAll('.game-size-option').forEach(option => option.classList.remove('selected'));
        document.querySelector(`[data-game-size="${gameSize}"]`).classList.add('selected');
        
        // Update canvas size
        this.updateCanvasSize();
        
        // Redraw content
        if (this.currentLayout !== 'none' && this.backgroundImage) {
            this.redrawBackgroundImage();
        }
        
        // Update custom image display if exists
        if (this.customImageElement) {
            this.updateCustomImageDisplay();
        }
        
        // Update canvas state to show/hide placeholder
        this.updateCanvasState();
    }

    selectLayout(layout) {
        this.currentLayout = layout;
        
        // Update UI
        document.querySelectorAll('.layout-thumbnail').forEach(thumb => thumb.classList.remove('selected'));
        document.querySelector(`[data-layout="${layout}"]`).classList.add('selected');
        
        // Load background image
        if (layout === 'none') {
            this.clearBackground();
        } else {
            this.loadBackgroundLayout(layout);
        }
        
        // Update canvas state to show/hide placeholder
        this.updateCanvasState();
    }

    loadBackgroundLayout(imagePath) {
        const img = new Image();
        img.onload = () => {
            // Store the original aspect ratio
            this.backgroundOriginalAspectRatio = img.width / img.height;
            
            // Reset scaling and position when loading new image
            this.backgroundImageScale = { width: 100, height: 100 };
            this.backgroundImagePosition = { x: 0, y: 0 };
            this.updateBackgroundScaleInputs();
            
            // Store the image for redrawing
            this.backgroundImage = img;
            
            // Draw the image with current scaling and positioning
            this.redrawBackgroundImage();
            
            // Show scaling controls
            this.showBackgroundControls();
            
            this.updateCanvasState();
        };
        img.onerror = () => {
            console.error('Could not load layout image:', imagePath);
            alert('Could not load the selected layout. Please try another one.');
        };
        img.src = imagePath;
    }

    clearBackground() {
        this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        this.backgroundImage = null;
        this.hideBackgroundControls();
    }

    updateBackgroundImageScale(dimension, value) {
        if (this.maintainBackgroundAspectRatio) {
            if (dimension === 'width') {
                this.backgroundImageScale.width = value;
                this.backgroundImageScale.height = Math.round(value / this.backgroundOriginalAspectRatio);
            } else {
                this.backgroundImageScale.height = value;
                this.backgroundImageScale.width = Math.round(value * this.backgroundOriginalAspectRatio);
            }
            this.updateBackgroundScaleInputs();
        } else {
            this.backgroundImageScale[dimension] = value;
        }
        
        this.redrawBackgroundImage();
        this.updateBackgroundScaleValues();
    }

    updateBackgroundScaleInputs() {
        document.getElementById('background-width-scale').value = this.backgroundImageScale.width;
        document.getElementById('background-height-scale').value = this.backgroundImageScale.height;
        this.updateBackgroundScaleValues();
    }

    updateBackgroundScaleValues() {
        document.getElementById('background-width-scale-value').textContent = `${this.backgroundImageScale.width}%`;
        document.getElementById('background-height-scale-value').textContent = `${this.backgroundImageScale.height}%`;
    }

    redrawBackgroundImage() {
        if (!this.backgroundImage) return;

        this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        
        // Calculate scaled dimensions
        const baseWidth = this.backgroundCanvas.width;
        const baseHeight = this.backgroundCanvas.height;
        
        const scaledWidth = (baseWidth * this.backgroundImageScale.width) / 100;
        const scaledHeight = (baseHeight * this.backgroundImageScale.height) / 100;
        
        // Calculate position based on percentage offsets
        const offsetX = (baseWidth * this.backgroundImagePosition.x) / 100;
        const offsetY = (baseHeight * this.backgroundImagePosition.y) / 100;
        
        // Calculate centered position with offset
        const x = (baseWidth - scaledWidth) / 2 + offsetX;
        const y = (baseHeight - scaledHeight) / 2 + offsetY;
        
        // Draw the scaled and positioned image
        this.backgroundCtx.drawImage(this.backgroundImage, x, y, scaledWidth, scaledHeight);
    }

    showBackgroundControls() {
        document.getElementById('background-scaling-controls').style.display = 'block';
    }

    hideBackgroundControls() {
        document.getElementById('background-scaling-controls').style.display = 'none';
    }

    updateCanvasSize() {
        const container = document.querySelector('.whiteboard-canvas-container');
        const containerRect = container.getBoundingClientRect();
        
        // Get canvas size based on selected game size
        const gameSize = this.gameSizes[this.currentGameSize];
        const canvasWidth = gameSize.width;
        const canvasHeight = gameSize.height;
        
        // Scale canvas to fit container while maintaining aspect ratio
        const scaleX = (containerRect.width - 40) / canvasWidth;
        const scaleY = (containerRect.height - 40) / canvasHeight;
        const scale = Math.min(scaleX, scaleY, 1);
        
        const scaledWidth = canvasWidth * scale;
        const scaledHeight = canvasHeight * scale;
        
        // Update both canvases
        [this.canvas, this.backgroundCanvas].forEach(canvas => {
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            canvas.style.width = `${scaledWidth}px`;
            canvas.style.height = `${scaledHeight}px`;
            // Ensure canvases remain centered in container
            canvas.style.position = 'absolute';
            canvas.style.top = '50%';
            canvas.style.left = '50%';
            canvas.style.transform = 'translate(-50%, -50%)';
        });
        
        // Update preview canvas
        this.previewCanvas.width = canvasWidth;
        this.previewCanvas.height = canvasHeight;
        
        // Redraw background if exists
        if (this.currentLayout !== 'none' && this.backgroundImage) {
            this.redrawBackgroundImage();
        }
        
        // Update custom image display if exists
        if (this.customImageElement) {
            this.updateCustomImageDisplay();
        }
    }

    updateCanvasState() {
        const container = document.querySelector('.whiteboard-canvas-container');
        const hasDrawing = this.hasCanvasContent();
        const hasBackground = this.currentLayout !== 'none';
        const hasCustomImage = this.customImage !== null;
        
        if (hasDrawing || hasBackground || hasCustomImage) {
            container.classList.add('has-content');
        } else {
            container.classList.remove('has-content');
        }
    }
    
    hasCanvasContent() {
        // Check if there are any shapes or pen/eraser drawings
        if (this.shapes.length > 0) {
            return true;
        }
        
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        // Check if any pixel has non-zero alpha (indicating drawn content)
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) {
                return true;
            }
        }
        return false;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        return { x, y };
    }

    startDrawing(e) {
        const pos = this.getMousePos(e);
        
        // Handle shape placement mode
        if (this.placementMode && this.selectedShapeType) {
            this.placeShape(this.selectedShapeType, pos);
            return;
        }
        
        // Check if we're clicking on an existing shape for selection/dragging
        if (this.currentTool !== 'pen' && this.currentTool !== 'eraser') {
            const clickedShape = this.getShapeAtPoint(pos);
            if (clickedShape) {
                this.selectShape(clickedShape);
                this.isDraggingShape = true;
                this.dragOffset = {
                    x: pos.x - clickedShape.startPoint.x,
                    y: pos.y - clickedShape.startPoint.y
                };
                return;
            } else {
                // Deselect if clicking on empty space
                this.deselectAllShapes();
            }
        }
        
        this.isDrawing = true;
        
        if (['line', 'arrow', 'rectangle', 'circle'].includes(this.currentTool)) {
            this.startPoint = pos;
            return;
        }
        
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }

    draw(e) {
        const pos = this.getMousePos(e);
        
        // Handle shape dragging
        if (this.isDraggingShape && this.selectedShape) {
            const newX = pos.x - this.dragOffset.x;
            const newY = pos.y - this.dragOffset.y;
            const deltaX = newX - this.selectedShape.startPoint.x;
            const deltaY = newY - this.selectedShape.startPoint.y;
            
            this.selectedShape.move(deltaX, deltaY);
            this.redrawCanvas();
            return;
        }
        
        if (!this.isDrawing) return;
        
        if (this.currentTool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.penColor;
            this.ctx.lineWidth = this.penThickness;
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        } else if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, this.eraserSize / 2, 0, 2 * Math.PI);
            this.ctx.fill();
        } else if (['line', 'arrow', 'rectangle', 'circle'].includes(this.currentTool) && this.startPoint) {
            // Preview shapes while drawing
            this.drawShapePreview(this.startPoint, pos);
        }
    }

    drawShapePreview(start, end) {
        // Clear previous preview by redrawing the canvas
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewCtx.drawImage(this.canvas, 0, 0);
        
        // Draw preview shape
        this.previewCtx.strokeStyle = this.penColor;
        this.previewCtx.lineWidth = this.penThickness;
        this.previewCtx.globalCompositeOperation = 'source-over';
        
        if (this.currentTool === 'line') {
            this.previewCtx.beginPath();
            this.previewCtx.moveTo(start.x, start.y);
            this.previewCtx.lineTo(end.x, end.y);
            this.previewCtx.stroke();
        } else if (this.currentTool === 'arrow') {
            this.drawArrow(this.previewCtx, start.x, start.y, end.x, end.y);
        } else if (this.currentTool === 'rectangle') {
            this.previewCtx.beginPath();
            this.previewCtx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
            this.previewCtx.stroke();
        } else if (this.currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
            this.previewCtx.beginPath();
            this.previewCtx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
            this.previewCtx.stroke();
        }
        
        // Show preview
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.previewCanvas, 0, 0);
        
        // Replace canvas content temporarily
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(tempCanvas, 0, 0);
    }

    stopDrawing(e) {
        // Handle shape dragging end
        if (this.isDraggingShape) {
            this.isDraggingShape = false;
            return;
        }
        
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        if (['line', 'arrow', 'rectangle', 'circle'].includes(this.currentTool) && this.startPoint && e) {
            const pos = this.getMousePos(e);
            this.createShape(this.currentTool, this.startPoint, pos);
            this.startPoint = null;
        }
        
        this.ctx.beginPath();
        
        // Update canvas state to hide placeholder if there's content
        this.updateCanvasState();
    }

    drawFinalShape(start, end) {
        // Clear the preview and draw the final shape
        this.ctx.strokeStyle = this.penColor;
        this.ctx.lineWidth = this.penThickness;
        this.ctx.globalCompositeOperation = 'source-over';
        
        if (this.currentTool === 'line') {
            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(end.x, end.y);
            this.ctx.stroke();
        } else if (this.currentTool === 'arrow') {
            this.drawArrow(this.ctx, start.x, start.y, end.x, end.y);
        } else if (this.currentTool === 'rectangle') {
            this.ctx.beginPath();
            this.ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
            this.ctx.stroke();
        } else if (this.currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
            this.ctx.beginPath();
            this.ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
            this.ctx.stroke();
        }
    }

    drawArrow(ctx, fromX, fromY, toX, toY) {
        const headLength = 15; // Length of the arrow head
        const angle = Math.atan2(toY - fromY, toX - fromX);
        
        // Draw the line
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        
        // Draw the arrow head
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI/6), toY - headLength * Math.sin(angle - Math.PI/6));
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI/6), toY - headLength * Math.sin(angle + Math.PI/6));
        ctx.stroke();
    }

    // Shape management methods
    createShape(type, startPoint, endPoint) {
        const shape = new Shape(
            this.shapeIdCounter++,
            type,
            { x: startPoint.x, y: startPoint.y },
            { x: endPoint.x, y: endPoint.y },
            this.penColor,
            this.penThickness
        );
        this.shapes.push(shape);
        this.redrawCanvas();
    }

    getShapeAtPoint(point) {
        // Check from top to bottom (last drawn first)
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            if (this.shapes[i].isPointNear(point)) {
                return this.shapes[i];
            }
        }
        return null;
    }

    selectShape(shape) {
        this.deselectAllShapes();
        shape.selected = true;
        this.selectedShape = shape;
        this.showShapeControls(shape);
        this.redrawCanvas();
    }

    deselectAllShapes() {
        this.shapes.forEach(shape => {
            shape.selected = false;
        });
        this.selectedShape = null;
        this.hideShapeControls();
        this.redrawCanvas();
    }

    deleteSelectedShape() {
        if (this.selectedShape) {
            const index = this.shapes.indexOf(this.selectedShape);
            if (index > -1) {
                this.shapes.splice(index, 1);
                this.selectedShape = null;
                this.hideShapeControls();
                this.redrawCanvas();
            }
        }
    }

    updateSelectedShapeColor(color) {
        if (this.selectedShape) {
            this.selectedShape.color = color;
            this.redrawCanvas();
        }
    }

    updateSelectedShapeThickness(thickness) {
        if (this.selectedShape) {
            this.selectedShape.thickness = thickness;
            this.redrawCanvas();
        }
    }

    updateSelectedShapeSize(sizePercent) {
        if (this.selectedShape) {
            const shape = this.selectedShape;
            const centerX = (shape.startPoint.x + shape.endPoint.x) / 2;
            const centerY = (shape.startPoint.y + shape.endPoint.y) / 2;
            
            // Calculate original size
            const originalWidth = Math.abs(shape.endPoint.x - shape.startPoint.x);
            const originalHeight = Math.abs(shape.endPoint.y - shape.startPoint.y);
            
            // Calculate new size
            const newWidth = (originalWidth * sizePercent) / 100;
            const newHeight = (originalHeight * sizePercent) / 100;
            
            // Update shape bounds
            shape.startPoint.x = centerX - newWidth / 2;
            shape.startPoint.y = centerY - newHeight / 2;
            shape.endPoint.x = centerX + newWidth / 2;
            shape.endPoint.y = centerY + newHeight / 2;
            
            // Update UI
            document.getElementById('shape-size-value').textContent = `${sizePercent}%`;
            
            this.redrawCanvas();
        }
    }

    updateSelectedShapeName(name) {
        if (this.selectedShape) {
            this.selectedShape.name = name;
            this.redrawCanvas();
        }
    }

    redrawCanvas() {
        // Clear the main canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw all shapes
        this.shapes.forEach(shape => {
            this.drawShape(shape);
        });
    }

    drawShape(shape) {
        this.ctx.save();
        this.ctx.strokeStyle = shape.color;
        this.ctx.lineWidth = shape.thickness;
        this.ctx.globalCompositeOperation = 'source-over';
        
        // Add selection highlight
        if (shape.selected) {
            this.ctx.shadowColor = '#00FFFF';
            this.ctx.shadowBlur = 8;
        }
        
        switch (shape.type) {
            case 'line':
                this.ctx.beginPath();
                this.ctx.moveTo(shape.startPoint.x, shape.startPoint.y);
                this.ctx.lineTo(shape.endPoint.x, shape.endPoint.y);
                this.ctx.stroke();
                break;
            case 'arrow':
                this.drawArrow(this.ctx, shape.startPoint.x, shape.startPoint.y, shape.endPoint.x, shape.endPoint.y);
                break;
            case 'rectangle':
                this.ctx.beginPath();
                this.ctx.rect(shape.startPoint.x, shape.startPoint.y, 
                             shape.endPoint.x - shape.startPoint.x, 
                             shape.endPoint.y - shape.startPoint.y);
                this.ctx.stroke();
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(shape.endPoint.x - shape.startPoint.x, 2) + 
                                       Math.pow(shape.endPoint.y - shape.startPoint.y, 2));
                this.ctx.beginPath();
                this.ctx.arc(shape.startPoint.x, shape.startPoint.y, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
            case 'triangle':
                this.drawTriangle(this.ctx, shape);
                break;
            case 'diamond':
                this.drawDiamond(this.ctx, shape);
                break;
            case 'hexagon':
                this.drawHexagon(this.ctx, shape);
                break;
            case 'star':
                this.drawStar(this.ctx, shape);
                break;
        }
        
        // Draw shape name if it exists
        if (shape.name) {
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            
            // Calculate label position (center of shape)
            const centerX = (shape.startPoint.x + shape.endPoint.x) / 2;
            const centerY = (shape.startPoint.y + shape.endPoint.y) / 2;
            
            // Set text styling
            this.ctx.fillStyle = shape.color;
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Add white background for better readability
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(shape.name, centerX, centerY + 20);
            
            // Draw the text
            this.ctx.fillText(shape.name, centerX, centerY + 20);
        }
        
        this.ctx.restore();
    }

    showShapeControls(shape) {
        // Update the drawing options to show selected shape properties
        const colorInput = document.getElementById('whiteboard-pen-color');
        const thicknessInput = document.getElementById('whiteboard-pen-thickness');
        const thicknessValue = document.getElementById('whiteboard-thickness-value');
        
        if (colorInput) {
            colorInput.value = shape.color;
        }
        if (thicknessInput) {
            thicknessInput.value = shape.thickness;
            thicknessValue.textContent = `${shape.thickness}px`;
        }
        
        // Show shape controls if they don't exist
        this.createShapeControlsUI();
        
        // Update name input with current shape name
        const nameInput = document.getElementById('shape-name-input');
        if (nameInput) {
            nameInput.value = shape.name;
        }
        
        // Update size slider to current shape size (assume 100% as baseline)
        const sizeSlider = document.getElementById('shape-size-slider');
        const sizeValue = document.getElementById('shape-size-value');
        if (sizeSlider && sizeValue) {
            sizeSlider.value = 100;
            sizeValue.textContent = '100%';
        }
    }

    hideShapeControls() {
        const shapeControls = document.getElementById('shape-controls');
        if (shapeControls) {
            shapeControls.style.display = 'none';
        }
    }

    createShapeControlsUI() {
        let shapeControls = document.getElementById('shape-controls');
        if (!shapeControls) {
            shapeControls = document.createElement('div');
            shapeControls.id = 'shape-controls';
            shapeControls.className = 'shape-controls';
            shapeControls.innerHTML = `
                <h4>Selected Shape</h4>
                <div class="option-group">
                    <label for="shape-name-input">Name:</label>
                    <input type="text" id="shape-name-input" placeholder="Enter shape name">
                </div>
                <div class="shape-control-buttons">
                    <button id="delete-shape" class="warning-button">Delete Shape</button>
                </div>
                <div class="option-group">
                    <label>Shape color and thickness can be changed using the Drawing Options above</label>
                </div>
                <div class="option-group">
                    <label for="shape-size-slider">Size:</label>
                    <input type="range" id="shape-size-slider" min="20" max="200" value="100">
                    <span id="shape-size-value">100%</span>
                </div>
            `;
            
            // Insert after drawing options
            const drawingOptions = document.getElementById('whiteboard-drawing-options');
            drawingOptions.parentNode.insertBefore(shapeControls, drawingOptions.nextSibling);
            
            // Bind delete button
            document.getElementById('delete-shape').addEventListener('click', () => {
                this.deleteSelectedShape();
            });
            
            // Bind name input
            document.getElementById('shape-name-input').addEventListener('input', (e) => {
                this.updateSelectedShapeName(e.target.value);
            });
            
            // Bind size slider
            document.getElementById('shape-size-slider').addEventListener('input', (e) => {
                this.updateSelectedShapeSize(parseInt(e.target.value));
            });
        }
        shapeControls.style.display = 'block';
    }

    // Custom Image Overlay Methods
    async handleCustomImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const imageDataUrl = await this.readFileAsDataURL(file);
            
            // Create image element
            this.customImage = new Image();
            this.customImage.onload = () => {
                this.originalAspectRatio = this.customImage.width / this.customImage.height;
                this.createCustomImageOverlay();
                this.showCustomImageControls();
                this.updateCustomImageDisplay();
            };
            this.customImage.src = imageDataUrl;

        } catch (error) {
            console.error('Error uploading custom image:', error);
            alert('Error uploading image. Please try again.');
        }
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    createCustomImageOverlay() {
        const overlay = document.getElementById('custom-image-overlay');
        overlay.innerHTML = '';
        
        this.customImageElement = document.createElement('img');
        this.customImageElement.src = this.customImage.src;
        this.customImageElement.alt = 'Custom overlay image';
        
        overlay.appendChild(this.customImageElement);
        
        // Reset position and scale
        this.customImagePosition = { x: 0, y: 0 };
        this.customImageScale = { width: 100, height: 100 };
        this.updateImageScaleInputs();
        
        // Update canvas state
        this.updateCanvasState();
    }

    updateImageScale(dimension, value) {
        if (this.maintainAspectRatio) {
            if (dimension === 'width') {
                this.customImageScale.width = value;
                this.customImageScale.height = Math.round(value / this.originalAspectRatio);
            } else {
                this.customImageScale.height = value;
                this.customImageScale.width = Math.round(value * this.originalAspectRatio);
            }
            this.updateImageScaleInputs();
        } else {
            this.customImageScale[dimension] = value;
        }
        
        this.updateCustomImageDisplay();
        this.updateImageScaleValues();
    }

    updateImageScaleInputs() {
        document.getElementById('image-width-scale').value = this.customImageScale.width;
        document.getElementById('image-height-scale').value = this.customImageScale.height;
        this.updateImageScaleValues();
    }

    updateImageScaleValues() {
        document.getElementById('width-scale-value').textContent = `${this.customImageScale.width}%`;
        document.getElementById('height-scale-value').textContent = `${this.customImageScale.height}%`;
    }

    updateCustomImageDisplay() {
        if (!this.customImageElement) return;

        const container = this.canvas.getBoundingClientRect();
        const canvasScale = container.width / this.canvas.width;
        
        // Calculate scaled dimensions
        const baseWidth = this.customImage.width * canvasScale;
        const baseHeight = this.customImage.height * canvasScale;
        
        const scaledWidth = (baseWidth * this.customImageScale.width) / 100;
        const scaledHeight = (baseHeight * this.customImageScale.height) / 100;
        
        // Apply styles
        this.customImageElement.style.width = `${scaledWidth}px`;
        this.customImageElement.style.height = `${scaledHeight}px`;
        this.customImageElement.style.opacity = this.customImageOpacity;
        
        // Update position
        const overlay = document.getElementById('custom-image-overlay');
        overlay.style.transform = `translate(${-50 + this.customImagePosition.x}%, ${-50 + this.customImagePosition.y}%)`;
    }

    updateImageLockState() {
        const overlay = document.getElementById('custom-image-overlay');
        if (this.isImageLocked) {
            overlay.classList.remove('unlocked');
        } else {
            overlay.classList.add('unlocked');
        }
    }

    setupCustomImageDragging() {
        const overlay = document.getElementById('custom-image-overlay');
        
        overlay.addEventListener('mousedown', (e) => {
            if (this.isImageLocked) return;
            
            this.isDraggingImage = true;
            this.dragStartPos = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDraggingImage) return;
            
            const deltaX = (e.clientX - this.dragStartPos.x) / 4; // Adjust sensitivity
            const deltaY = (e.clientY - this.dragStartPos.y) / 4;
            
            this.customImagePosition.x += deltaX;
            this.customImagePosition.y += deltaY;
            
            this.dragStartPos = { x: e.clientX, y: e.clientY };
            this.updateCustomImageDisplay();
            
            e.preventDefault();
        });

        document.addEventListener('mouseup', () => {
            this.isDraggingImage = false;
        });
    }

    showCustomImageControls() {
        document.getElementById('custom-image-controls').style.display = 'block';
        document.getElementById('remove-custom-image').style.display = 'inline-block';
    }

    hideCustomImageControls() {
        document.getElementById('custom-image-controls').style.display = 'none';
        document.getElementById('remove-custom-image').style.display = 'none';
    }

    removeCustomImage() {
        if (confirm('Remove the custom image overlay?')) {
            this.customImage = null;
            this.customImageElement = null;
            document.getElementById('custom-image-overlay').innerHTML = '';
            document.getElementById('custom-image-upload').value = '';
            this.hideCustomImageControls();
            
            // Reset controls
            this.customImageScale = { width: 100, height: 100 };
            this.customImagePosition = { x: 0, y: 0 };
            this.customImageOpacity = 1.0;
            this.isImageLocked = false;
            
            // Reset UI
            document.getElementById('image-width-scale').value = 100;
            document.getElementById('image-height-scale').value = 100;
            document.getElementById('custom-image-opacity').value = 100;
            document.getElementById('lock-image-position').checked = false;
            this.updateImageScaleValues();
            document.getElementById('custom-opacity-value').textContent = '100%';
            
            // Update canvas state
            this.updateCanvasState();
        }
    }

    clearWhiteboard() {
        if (confirm('Are you sure you want to clear the strategy whiteboard? This action cannot be undone.')) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.shapes = [];
            this.selectedShape = null;
            this.hideShapeControls();
            this.updateCanvasState();
        }
    }

    exportWhiteboard() {
        // Create a temporary canvas to combine all layers
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.canvas.width;
        exportCanvas.height = this.canvas.height;
        const exportCtx = exportCanvas.getContext('2d');
        
        // White background
        exportCtx.fillStyle = '#ffffff';
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        
        // Draw background image if exists
        if (this.currentLayout !== 'none') {
            exportCtx.globalAlpha = this.overlayOpacity;
            exportCtx.drawImage(this.backgroundCanvas, 0, 0);
            exportCtx.globalAlpha = 1.0;
        }
        
        // Draw custom image overlay if exists
        if (this.customImage) {
            exportCtx.save();
            exportCtx.globalAlpha = this.customImageOpacity;
            
            const scaledWidth = (this.customImage.width * this.customImageScale.width) / 100;
            const scaledHeight = (this.customImage.height * this.customImageScale.height) / 100;
            
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const imageX = centerX - scaledWidth / 2 + (this.customImagePosition.x * this.canvas.width) / 100;
            const imageY = centerY - scaledHeight / 2 + (this.customImagePosition.y * this.canvas.height) / 100;
            
            exportCtx.drawImage(this.customImage, imageX, imageY, scaledWidth, scaledHeight);
            exportCtx.restore();
        }
        
        // Draw main canvas content
        exportCtx.drawImage(this.canvas, 0, 0);
        
        // Download the image
        exportCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `strategy-plan-${new Date().toISOString().slice(0, 10)}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Shape placement methods
    selectShapeForPlacement(shapeType) {
        this.placementMode = true;
        this.selectedShapeType = shapeType;
        
        // Deselect all drawing tools
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        
        // Update shape placement UI
        document.querySelectorAll('.shape-place-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-shape="${shapeType}"]`).classList.add('active');
        
        // Update cursor
        this.canvas.className = 'placement-mode';
    }

    placeShape(shapeType, position) {
        const size = this.defaultShapeSize;
        const startPoint = { x: position.x - size/2, y: position.y - size/2 };
        const endPoint = { x: position.x + size/2, y: position.y + size/2 };
        
        this.createShape(shapeType, startPoint, endPoint);
        
        // Exit placement mode after placing
        this.exitPlacementMode();
    }

    exitPlacementMode() {
        this.placementMode = false;
        this.selectedShapeType = null;
        
        // Remove active state from shape buttons
        document.querySelectorAll('.shape-place-button').forEach(btn => btn.classList.remove('active'));
        
        // Reset cursor
        this.canvas.className = '';
    }

    // Drawing methods for new shapes
    drawTriangle(ctx, shape) {
        const { startPoint, endPoint } = shape;
        const centerX = (startPoint.x + endPoint.x) / 2;
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        
        ctx.beginPath();
        ctx.moveTo(centerX, startPoint.y);
        ctx.lineTo(startPoint.x, endPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.closePath();
        ctx.stroke();
    }

    drawDiamond(ctx, shape) {
        const { startPoint, endPoint } = shape;
        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2;
        
        ctx.beginPath();
        ctx.moveTo(centerX, startPoint.y);
        ctx.lineTo(endPoint.x, centerY);
        ctx.lineTo(centerX, endPoint.y);
        ctx.lineTo(startPoint.x, centerY);
        ctx.closePath();
        ctx.stroke();
    }

    drawHexagon(ctx, shape) {
        const { startPoint, endPoint } = shape;
        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2;
        const radius = Math.min(Math.abs(endPoint.x - startPoint.x), Math.abs(endPoint.y - startPoint.y)) / 2;
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * 60) * Math.PI / 180;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.stroke();
    }

    drawStar(ctx, shape) {
        const { startPoint, endPoint } = shape;
        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2;
        const outerRadius = Math.min(Math.abs(endPoint.x - startPoint.x), Math.abs(endPoint.y - startPoint.y)) / 2;
        const innerRadius = outerRadius * 0.4;
        
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const angle = (i * 36) * Math.PI / 180;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = centerX + radius * Math.cos(angle - Math.PI / 2);
            const y = centerY + radius * Math.sin(angle - Math.PI / 2);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.stroke();
    }
}