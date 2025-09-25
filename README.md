# 40K Battle Assistant

A comprehensive web application to help record and track Warhammer 40,000 battles. Record your tactics, track your stratagems, and never miss a tactical opportunity!

## Features

✅ **Army List Import**: Import your army list from HTML documents  
✅ **Stratagem Import**: Import your stratagem list from HTML documents  
✅ **Phase-by-Phase Recording**: Take detailed notes for all 6 game phases:
- Command Phase
- Movement Phase  
- Shooting Phase
- Charge Phase
- Fight Phase
- Morale Phase

✅ **Image Upload**: Attach photos to document what happened in each phase  
✅ **Stratagem Reminders**: See relevant stratagems for each phase automatically  
✅ **Battle History**: Track all your notes and actions across all turns  
✅ **Turn Management**: Automatically advance turns and maintain history  
✅ **Local Storage**: Your battle data is saved automatically  
✅ **Responsive Design**: Works on desktop and mobile devices  

## How to Use

1. **Setup**: 
   - Import your army list HTML file
   - Import your stratagems HTML file  
   - Click "Start Battle"

2. **During Battle**:
   - Navigate between phases using the phase buttons
   - Take notes in each phase text area
   - Upload photos to document key moments
   - Review relevant stratagems for each phase
   - Click "Next Turn" to advance to the next turn

3. **Reference**: 
   - View your complete army list and stratagems in the reference panel
   - Battle history shows all previous phase notes

## File Format

The app expects HTML files with the following structure:

### Army List Example:
```html
<div class="unit">Captain in Terminator Armour - 105 pts</div>
<div class="unit">Intercessor Squad (10 models) - 200 pts</div>
```

### Stratagems Example:
```html
<div class="stratagem">
    <h3>Rapid Fire - 1 CP</h3>
    <p>Use in the Shooting phase when a unit shoots...</p>
    <p>Phase: Shooting</p>
</div>
```

## Getting Started

Simply open `index.html` in your web browser. No installation required!

For local development:
```bash
python3 -m http.server 8000
# Then open http://localhost:8000
```

## Screenshots

### Setup Interface
![Setup Interface](https://github.com/user-attachments/assets/10bbe457-c3b3-4ec8-9a64-96f6c342a154)

### Battle Interface  
![Battle Interface](https://github.com/user-attachments/assets/692f999c-f461-4165-bfe7-1146682a4689)
