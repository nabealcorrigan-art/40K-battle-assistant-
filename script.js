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

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BattleAssistant();
});