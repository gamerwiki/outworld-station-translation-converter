// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const statusDiv = document.getElementById('status');
const processBtn = document.getElementById('processBtn');
const outputPreview = document.getElementById('output-preview');

// State
let rawPoContent = '';
let currentFileName = '';

// --- Event Listeners ---
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('highlight'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('highlight'));
dropzone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
processBtn.addEventListener('click', processAndDownload);

function handleDrop(e) {
    e.preventDefault();
    dropzone.classList.remove('highlight');
    handleFiles(e.dataTransfer.files);
}

function handleFiles(files) {
    const file = files[0];
    if (!file) return;
    currentFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        rawPoContent = e.target.result;
        fileInfo.innerHTML = `<div class="info">Selected: ${file.name}</div>`;
        processBtn.disabled = false;
        showStatus('File loaded and ready.');
    };
    reader.readAsText(file);
}

/**
 * Enhanced PO Parser
 * Specifically targets msgctxt, msgid, and msgstr
 */
function parsePO(content) {
    const lines = content.split(/\r?\n/);
    const data = [];
    let entry = { key: '', source: '', target: '' };
    let currentField = null; 

    lines.forEach(line => {
        const trimmed = line.trim();
        
        // 1. Extract Key from msgctxt (Format: ",ID")
        if (trimmed.startsWith('msgctxt "')) {
            // If we already have a gathered entry, save it before starting new one
            if (entry.source) data.push(entry);
            
            entry = { key: '', source: '', target: '' };
            const match = line.match(/msgctxt\s+"(.*)"/);
            if (match && match[1]) {
                // Clean the key: remove comma and prepend slash
                let cleanKey = match[1].replace(',', '');
                entry.key = '/' + cleanKey;
            }
            currentField = 'key';
        } 
        // 2. Extract Source (msgid)
        else if (trimmed.startsWith('msgid "')) {
            const match = line.match(/^msgid\s+"(.*)"$/);
            entry.source = match ? match[1] : '';
            currentField = 'source';
        } 
        // 3. Extract Target (msgstr)
        else if (trimmed.startsWith('msgstr "')) {
            const match = line.match(/^msgstr\s+"(.*)"$/);
            entry.target = match ? match[1] : '';
            currentField = 'target';
        } 
        // 4. Handle Multi-line text
        else if (trimmed.startsWith('"') && currentField && currentField !== 'key') {
            const match = line.match(/^"(.*)"$/);
            if (match) entry[currentField] += match[1];
        }
    });

    // Push final entry
    if (entry.source) data.push(entry);
    
    // Filter out the header entry (where source is empty)
    return data.filter(item => item.source !== "");
}

function processAndDownload() {
    try {
        const parsedData = parsePO(rawPoContent);
        
        if (parsedData.length === 0) {
            throw new Error("No valid translation entries found.");
        }

        // Convert to CSV with specific column order
        const csv = Papa.unparse({
            fields: ["key", "source", "target"],
            data: parsedData
        });
        
        outputPreview.innerHTML = `<div class="output-content">${csv.substring(0, 1000)}</div>`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', currentFileName.replace(/\.po$/i, '') + '.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showStatus(`Success! Generated CSV with ${parsedData.length} rows.`);
    } catch (err) {
        showStatus('Error: ' + err.message, true);
    }
}

function showStatus(msg, isError = false) {
    statusDiv.textContent = msg;
    statusDiv.className = isError ? 'status error' : 'status success';
}