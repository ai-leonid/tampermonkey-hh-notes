// ==UserScript==
// @name         TRAE HH Resume Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Add comments and color markers to HH resumes based on data-qa-id
// @author       Trae
// @match        *://*.hh.ru/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY_PREFIX = 'hh_resume_enhancer_';

    // Helper functions for LocalStorage
    function loadData(id) {
        try {
            const data = localStorage.getItem(STORAGE_KEY_PREFIX + id);
            return data ? JSON.parse(data) : { comment: '', color: '' };
        } catch (e) {
            console.error('Error loading data for resume ' + id, e);
            return { comment: '', color: '' };
        }
    }

    function saveData(id, data) {
        try {
            localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(data));
        } catch (e) {
            console.error('Error saving data for resume ' + id, e);
        }
    }

    // Colors for the palette
    const COLORS = [
        { hex: '', name: 'Default' }, // Transparent/Reset
        { hex: '#ffebeb', name: 'Red' },
        { hex: '#e8f5e9', name: 'Green' },
        { hex: '#e3f2fd', name: 'Blue' },
        { hex: '#fff3e0', name: 'Orange' },
        { hex: '#f3e5f5', name: 'Purple' },
        { hex: '#fff9c4', name: 'Yellow' }
    ];

    function processResumes() {
        // Find all resume blocks with data-qa-id
        const resumes = document.querySelectorAll('[data-qa-id]:not([data-hh-enhanced])');

        resumes.forEach(resume => {
            // Mark as processed
            resume.setAttribute('data-hh-enhanced', 'true');

            const id = resume.getAttribute('data-qa-id');
            const savedData = loadData(id);

            // --- Create Enhancement Container ---
            const enhancerContainer = document.createElement('div');
            enhancerContainer.className = 'hh-enhancer-container';
            enhancerContainer.style.padding = '10px 20px';
            enhancerContainer.style.borderTop = '1px solid #e0e0e0';
            enhancerContainer.style.backgroundColor = 'rgba(255,255,255,0.5)'; // Slightly transparent to blend with colored background
            enhancerContainer.style.marginTop = '10px';
            enhancerContainer.style.borderBottomLeftRadius = '24px'; // Match card radius
            enhancerContainer.style.borderBottomRightRadius = '24px';

            // --- Color Picker UI ---
            const colorPickerRow = document.createElement('div');
            colorPickerRow.style.marginBottom = '8px';
            colorPickerRow.style.display = 'flex';
            colorPickerRow.style.gap = '8px';
            colorPickerRow.style.alignItems = 'center';

            const label = document.createElement('span');
            label.innerText = 'Метка: ';
            label.style.fontSize = '12px';
            label.style.color = '#666';
            colorPickerRow.appendChild(label);

            COLORS.forEach(colorOpt => {
                const btn = document.createElement('button');
                btn.title = colorOpt.name;
                btn.style.width = '24px';
                btn.style.height = '24px';
                btn.style.borderRadius = '50%';
                btn.style.border = '1px solid #ccc';
                btn.style.cursor = 'pointer';
                btn.style.backgroundColor = colorOpt.hex || '#ffffff';

                if (colorOpt.hex === '') {
                    // Add an "X" or something for reset
                    btn.innerText = '✕';
                    btn.style.fontSize = '12px';
                    btn.style.color = '#999';
                    btn.style.display = 'flex';
                    btn.style.alignItems = 'center';
                    btn.style.justifyContent = 'center';
                }

                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Apply color
                    const color = colorOpt.hex;
                    resume.style.backgroundColor = color;

                    // Also apply to nested cards to ensure visibility if they are opaque
                    const nestedCards = resume.querySelectorAll('[class*="magritte-card"]');
                    nestedCards.forEach(card => card.style.backgroundColor = color);

                    // Save
                    const currentData = loadData(id);
                    currentData.color = color;
                    saveData(id, currentData);
                };

                colorPickerRow.appendChild(btn);
            });

            // --- Apply Initial Color ---
            if (savedData.color) {
                resume.style.backgroundColor = savedData.color;
                const nestedCards = resume.querySelectorAll('[class*="magritte-card"]');
                nestedCards.forEach(card => card.style.backgroundColor = savedData.color);
            }

            // --- Comment UI ---
            const commentRow = document.createElement('div');

            const textarea = document.createElement('textarea');
            textarea.placeholder = 'Ваш комментарий...';
            textarea.style.width = '100%';
            textarea.style.minHeight = '60px';
            textarea.style.padding = '8px';
            textarea.style.borderRadius = '4px';
            textarea.style.border = '1px solid #ccc';
            textarea.style.fontSize = '14px';
            textarea.style.resize = 'vertical';
            textarea.value = savedData.comment || '';

            // Save on input
            textarea.addEventListener('input', (e) => {
                const val = e.target.value;
                const currentData = loadData(id);
                currentData.comment = val;
                saveData(id, currentData);
            });

            // Prevent click propagation so clicking textarea doesn't open the resume link
            textarea.addEventListener('click', (e) => e.stopPropagation());

            commentRow.appendChild(textarea);

            // --- Append to Container ---
            enhancerContainer.appendChild(colorPickerRow);
            enhancerContainer.appendChild(commentRow);

            // --- Append Container to Resume Block ---
            // The resume block often has a specific structure.
            // We append at the end.
            resume.appendChild(enhancerContainer);
        });
    }

    // Run initially
    processResumes();

    // Observe for changes (infinite scroll, dynamic loading)
    const observer = new MutationObserver((mutations) => {
        processResumes();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
