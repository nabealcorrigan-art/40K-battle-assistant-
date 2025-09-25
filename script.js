// 40K Battle Assistant JavaScript

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

/**
 * Terrain Planner Class
 * Handles the interactive whiteboard for terrain planning
 */
class TerrainPlanner {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.backgroundCanvas = null;
        this.backgroundCtx = null;
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.penColor = '#DAA520';
        this.penThickness = 3;
        this.eraserSize = 15;
        this.showGrid = false;
        this.snapToGrid = false;
        this.gridSize = 20;
        this.backgroundImage = null;
        this.overlayOpacity = 0.3;
        this.terrainPieces = [];
        this.selectedTerrain = null;
        this.draggedTerrain = null;
        this.boardSizes = {
            '44x30': { width: 660, height: 450 },
            '48x48': { width: 720, height: 720 },
            '60x44': { width: 900, height: 660 },
            '72x48': { width: 1080, height: 720 }
        };
        this.currentBoardSize = '48x48';
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.bindEvents();
        this.updateCanvasSize();
    }

    setupCanvas() {
        this.canvas = document.getElementById('terrain-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.backgroundCanvas = document.getElementById('background-canvas');
        this.backgroundCtx = this.backgroundCanvas.getContext('2d');
        
        // Set canvas properties
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Set background canvas as background layer
        this.backgroundCanvas.style.opacity = this.overlayOpacity;
    }

    bindEvents() {
        // Tool selection
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (e) => this.selectTool(e.target.dataset.tool));
        });

        // Drawing options
        document.getElementById('pen-color').addEventListener('change', (e) => {
            this.penColor = e.target.value;
        });

        document.getElementById('pen-thickness').addEventListener('input', (e) => {
            this.penThickness = parseInt(e.target.value);
            document.getElementById('thickness-value').textContent = `${this.penThickness}px`;
        });

        // Eraser options
        document.getElementById('eraser-size').addEventListener('input', (e) => {
            this.eraserSize = parseInt(e.target.value);
            document.getElementById('eraser-size-value').textContent = `${this.eraserSize}px`;
        });

        // Board settings
        document.getElementById('board-size').addEventListener('change', (e) => {
            this.currentBoardSize = e.target.value;
            this.updateCanvasSize();
        });

        document.getElementById('show-grid').addEventListener('change', (e) => {
            this.showGrid = e.target.checked;
            this.drawGrid();
        });

        document.getElementById('snap-to-grid').addEventListener('change', (e) => {
            this.snapToGrid = e.target.checked;
        });

        // Background layout
        document.getElementById('layout-import').addEventListener('change', (e) => {
            this.handleLayoutImport(e);
        });

        document.getElementById('overlay-opacity').addEventListener('input', (e) => {
            this.overlayOpacity = parseInt(e.target.value) / 100;
            document.getElementById('opacity-value').textContent = `${e.target.value}%`;
            this.backgroundCanvas.style.opacity = this.overlayOpacity;
        });

        document.getElementById('clear-overlay').addEventListener('click', () => {
            this.clearBackgroundLayout();
        });

        // Canvas actions
        document.getElementById('clear-canvas').addEventListener('click', () => {
            this.clearCanvas();
        });

        // Terrain pieces
        document.querySelectorAll('.terrain-piece').forEach(piece => {
            piece.addEventListener('click', (e) => this.selectTerrainPiece(e.target.dataset.terrain));
        });

        // Canvas mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
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

        // Navigation events
        document.getElementById('back-to-setup').addEventListener('click', () => {
            this.backToSetup();
        });

        document.getElementById('export-board').addEventListener('click', () => {
            this.exportBoard();
        });
    }

    selectTool(tool) {
        this.currentTool = tool;
        
        // Update UI
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
        
        // Show/hide tool options
        document.getElementById('drawing-options').style.display = tool === 'pen' ? 'block' : 'none';
        document.getElementById('eraser-options').style.display = tool === 'eraser' ? 'block' : 'none';
        document.getElementById('terrain-library').style.display = tool === 'terrain' ? 'block' : 'none';
        
        // Update cursor
        this.canvas.className = '';
        if (tool === 'eraser') {
            this.canvas.classList.add('eraser-mode');
        } else if (tool === 'terrain') {
            this.canvas.classList.add('terrain-mode');
        }
    }

    updateCanvasSize() {
        const size = this.boardSizes[this.currentBoardSize];
        const container = document.querySelector('.canvas-container');
        const containerRect = container.getBoundingClientRect();
        
        // Scale canvas to fit container while maintaining aspect ratio
        const scaleX = (containerRect.width - 40) / size.width;
        const scaleY = (containerRect.height - 40) / size.height;
        const scale = Math.min(scaleX, scaleY, 1);
        
        const scaledWidth = size.width * scale;
        const scaledHeight = size.height * scale;
        
        // Update both canvases
        [this.canvas, this.backgroundCanvas].forEach(canvas => {
            canvas.width = size.width;
            canvas.height = size.height;
            canvas.style.width = `${scaledWidth}px`;
            canvas.style.height = `${scaledHeight}px`;
        });
        
        // Redraw grid if enabled
        if (this.showGrid) {
            this.drawGrid();
        }
        
        // Redraw background if exists
        if (this.backgroundImage) {
            this.drawBackgroundImage();
        }
    }

    drawGrid() {
        const overlay = document.getElementById('canvas-overlay');
        
        if (!this.showGrid) {
            overlay.innerHTML = '';
            return;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = this.canvas.width;
        canvas.height = this.canvas.height;
        canvas.style.width = this.canvas.style.width;
        canvas.style.height = this.canvas.style.height;
        canvas.style.position = 'absolute';
        canvas.style.top = '50%';
        canvas.style.left = '50%';
        canvas.style.transform = 'translate(-50%, -50%)';
        canvas.style.pointerEvents = 'none';
        canvas.style.opacity = '0.3';
        
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        
        // Draw vertical lines
        for (let x = 0; x <= canvas.width; x += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= canvas.height; y += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        overlay.innerHTML = '';
        overlay.appendChild(canvas);
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        let x = (e.clientX - rect.left) * scaleX;
        let y = (e.clientY - rect.top) * scaleY;
        
        // Snap to grid if enabled
        if (this.snapToGrid && this.showGrid) {
            x = Math.round(x / this.gridSize) * this.gridSize;
            y = Math.round(y / this.gridSize) * this.gridSize;
        }
        
        return { x, y };
    }

    startDrawing(e) {
        if (this.currentTool === 'terrain') {
            this.placeTerrainPiece(e);
            return;
        }
        
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }

    draw(e) {
        if (!this.isDrawing || this.currentTool === 'terrain') return;
        
        const pos = this.getMousePos(e);
        
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
        }
    }

    stopDrawing() {
        this.isDrawing = false;
        this.ctx.beginPath();
    }

    selectTerrainPiece(terrain) {
        this.selectedTerrain = terrain;
        
        // Update UI
        document.querySelectorAll('.terrain-piece').forEach(piece => {
            piece.classList.remove('selected');
        });
        document.querySelector(`[data-terrain="${terrain}"]`).classList.add('selected');
    }

    placeTerrainPiece(e) {
        if (!this.selectedTerrain) return;
        
        const pos = this.getMousePos(e);
        const terrainText = this.getTerrainText(this.selectedTerrain);
        
        // Draw terrain piece as text for now (could be replaced with icons/images)
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = this.penColor;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(terrainText, pos.x, pos.y);
        
        // Store terrain piece data
        this.terrainPieces.push({
            type: this.selectedTerrain,
            x: pos.x,
            y: pos.y,
            text: terrainText
        });
    }

    getTerrainText(terrainType) {
        const terrainMap = {
            'ruins': '🏛️',
            'forest': '🌲',
            'crates': '📦',
            'hill': '⛰️',
            'building': '🏢',
            'crater': '🕳️'
        };
        return terrainMap[terrainType] || '❓';
    }

    async handleLayoutImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const imageDataUrl = await this.readFileAsDataURL(file);
            this.backgroundImage = new Image();
            this.backgroundImage.onload = () => {
                this.drawBackgroundImage();
            };
            this.backgroundImage.src = imageDataUrl;
        } catch (error) {
            console.error('Error loading background image:', error);
            alert('Error loading background image. Please try again.');
        }
    }

    drawBackgroundImage() {
        if (!this.backgroundImage) return;
        
        this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        this.backgroundCtx.drawImage(
            this.backgroundImage, 
            0, 0, 
            this.backgroundCanvas.width, 
            this.backgroundCanvas.height
        );
    }

    clearBackgroundLayout() {
        this.backgroundImage = null;
        this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        document.getElementById('layout-import').value = '';
    }

    clearCanvas() {
        if (confirm('Are you sure you want to clear the entire board? This action cannot be undone.')) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.terrainPieces = [];
        }
    }

    exportBoard() {
        // Create a temporary canvas to combine all layers
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.canvas.width;
        exportCanvas.height = this.canvas.height;
        const exportCtx = exportCanvas.getContext('2d');
        
        // White background
        exportCtx.fillStyle = '#ffffff';
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        
        // Draw background image if exists
        if (this.backgroundImage) {
            exportCtx.globalAlpha = this.overlayOpacity;
            exportCtx.drawImage(this.backgroundCanvas, 0, 0);
            exportCtx.globalAlpha = 1.0;
        }
        
        // Draw main canvas content
        exportCtx.drawImage(this.canvas, 0, 0);
        
        // Download the image
        exportCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `terrain-plan-${new Date().toISOString().slice(0, 10)}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    backToSetup() {
        document.getElementById('terrain-planner-section').classList.remove('active');
        document.getElementById('setup-section').classList.add('active');
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const battleAssistant = new BattleAssistant();
    let terrainPlanner = null;
    let strategyWhiteboard = null;
    
    // Terrain planner navigation
    document.getElementById('open-terrain-planner').addEventListener('click', () => {
        document.getElementById('setup-section').classList.remove('active');
        document.getElementById('terrain-planner-section').classList.add('active');
        
        // Initialize terrain planner if not already done
        if (!terrainPlanner) {
            terrainPlanner = new TerrainPlanner();
        }
    });
    
    // Initialize strategy whiteboard
    if (!strategyWhiteboard) {
        strategyWhiteboard = new StrategyWhiteboard();
    }
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
        this.overlayOpacity = 0.5;
        this.currentLayout = 'none';
        this.startPoint = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        
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

        // Drawing options
        document.getElementById('whiteboard-pen-color').addEventListener('change', (e) => {
            this.penColor = e.target.value;
        });

        document.getElementById('whiteboard-pen-thickness').addEventListener('input', (e) => {
            this.penThickness = parseInt(e.target.value);
            document.getElementById('whiteboard-thickness-value').textContent = `${this.penThickness}px`;
        });

        // Overlay selection
        document.querySelectorAll('.layout-thumbnail').forEach(thumbnail => {
            thumbnail.addEventListener('click', (e) => {
                const layout = e.currentTarget.dataset.layout;
                this.selectLayout(layout);
            });
        });

        // Overlay opacity
        document.getElementById('whiteboard-overlay-opacity').addEventListener('input', (e) => {
            this.overlayOpacity = parseInt(e.target.value) / 100;
            document.getElementById('whiteboard-opacity-value').textContent = `${e.target.value}%`;
            this.backgroundCanvas.style.opacity = this.overlayOpacity;
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
    }

    selectTool(tool) {
        this.currentTool = tool;
        
        // Update UI
        document.querySelectorAll('#strategy-whiteboard .tool-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`#strategy-whiteboard [data-tool="${tool}"]`).classList.add('active');
        
        // Update cursor
        this.canvas.className = '';
        this.canvas.classList.add(`${tool}-mode`);
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
    }

    loadBackgroundLayout(imagePath) {
        const img = new Image();
        img.onload = () => {
            this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
            this.backgroundCtx.drawImage(img, 0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        };
        img.onerror = () => {
            console.error('Could not load layout image:', imagePath);
            alert('Could not load the selected layout. Please try another one.');
        };
        img.src = imagePath;
    }

    clearBackground() {
        this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
    }

    updateCanvasSize() {
        const container = document.querySelector('.whiteboard-canvas-container');
        const containerRect = container.getBoundingClientRect();
        
        // Set standard canvas size (can be made configurable later)
        const canvasWidth = 800;
        const canvasHeight = 600;
        
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
        if (this.currentLayout !== 'none') {
            this.loadBackgroundLayout(this.currentLayout);
        }
        
        // Update custom image display if exists
        if (this.customImageElement) {
            this.updateCustomImageDisplay();
        }
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
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        
        if (['line', 'arrow', 'rectangle', 'circle'].includes(this.currentTool)) {
            this.startPoint = pos;
            return;
        }
        
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getMousePos(e);
        
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
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        if (['line', 'arrow', 'rectangle', 'circle'].includes(this.currentTool) && this.startPoint && e) {
            const pos = this.getMousePos(e);
            this.drawFinalShape(this.startPoint, pos);
            this.startPoint = null;
        }
        
        this.ctx.beginPath();
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
        }
    }

    clearWhiteboard() {
        if (confirm('Are you sure you want to clear the strategy whiteboard? This action cannot be undone.')) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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
}