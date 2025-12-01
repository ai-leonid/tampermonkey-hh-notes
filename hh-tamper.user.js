// ==UserScript==
// @name         hh.ru Resume Notes & Colors
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Добавляет заметки и цветовую пометку к каждому резюме на странице «Мои резюме» (hh.ru). Данные хранятся в localStorage.
// @author       ai-leonid
// @match        *://*.hh.ru/applicant/resumes
// @match        *://hh.ru/applicant/resumes
// @match        *://*.hh.ru/resume/*
// @match        *://hh.ru/resume/*
// @icon         https://hh.ru/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  const STORAGE_KEY = 'hh-resume-notes-and-colors';

  // --- STYLES CONFIGURATION ---
  const CSS_CLASSES = {
    panel: 'hh-resume-note-panel',
    panelPageResume: 'hh-resume-note-panel-page-resume',
    textarea: 'hh-resume-note-textarea',
    header: 'hh-resume-note-header',
    colorWrapper: 'hh-resume-note-color-wrapper',
    palette: 'hh-resume-note-palette',
    colorBtn: 'hh-resume-note-color-btn',
    colorBtnTransparent: 'hh-resume-note-color-btn--transparent',
    colorBtnActive: 'is-active',
    customLabel: 'hh-resume-note-custom-label',
    colorInput: 'hh-resume-note-color-input',
    marker: 'hh-resume-note-marker',
  };

  const STYLES = `
    .${CSS_CLASSES.panel} {
      margin: 12px 16px 16px 16px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.02);
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
    }
    
    .${CSS_CLASSES.panelPageResume} {
      margin-top: 0!important;
      margin-left: 0!important;
      margin-bottom: 0!important;
      padding-bottom: 0!important;
    }
    
    .${CSS_CLASSES.textarea} {
      resize: none;
      min-height: 40px;
      padding: 6px 8px;
      border-radius: 6px;
      border: none;
      outline: none;
      font-size: 12px;
      line-height: 1.4;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      background: transparent;
    }
    
    .${CSS_CLASSES.header} {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    
    .${CSS_CLASSES.colorWrapper} {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .${CSS_CLASSES.palette} {
      display: flex;
      gap: 6px;
    }
    
    .${CSS_CLASSES.colorBtn} {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;
      transition: transform 0.2s, border-color 0.2s;
      box-sizing: border-box;
    }

    .${CSS_CLASSES.colorBtnTransparent} {
      background: linear-gradient(to top left,
        rgba(0,0,0,0) 0%,
        rgba(0,0,0,0) calc(50% - 1px),
        rgba(0,0,0,0.4) 50%,
        rgba(0,0,0,0) calc(50% + 1px),
        rgba(0,0,0,0) 100%),
        transparent;
      border: 1px solid rgba(0,0,0,1);
    }

    .${CSS_CLASSES.colorBtn}.${CSS_CLASSES.colorBtnActive},
    .${CSS_CLASSES.customLabel}.${CSS_CLASSES.colorBtnActive} {
      border-color: #333;
      transform: scale(1.1);
    }
    
    .${CSS_CLASSES.customLabel} {
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 1px solid rgba(0,0,0,0.2);
      background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
      transition: transform 0.2s, border-color 0.2s;
      box-sizing: border-box;
      position: relative;
    }
    
    .${CSS_CLASSES.colorInput} {
      visibility: hidden;
      width: 0;
      height: 0;
      position: absolute;
      opacity: 0;
    }

    .${CSS_CLASSES.marker} {
      position: absolute;
      left: -7px;
      top: 6%;
      bottom: 6%;
      width: 8px;
      border-radius: 24px 0 0 24px;
      pointer-events: none;
    }
  `;

  function injectStyles() {
    const styleId = 'hh-resume-notes-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function loadStorage() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch (e) {
      console.error('[HH Resume Notes] Failed to parse storage', e);
      return {};
    }
  }

  function saveStorage(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    catch (e) {
      console.error('[HH Resume Notes] Failed to save storage', e);
    }
  }

  function createPanel({ resumeId, card, state, extraPanelClasses, onChange }) {
    const existing = card.querySelector(`[data-hh-notes-panel]`);
    if (existing) {
      return existing;
    }

    const panel = document.createElement('div');
    panel.setAttribute('data-hh-notes-panel', 'true');
    panel.classList.add(CSS_CLASSES.panel);

    if (extraPanelClasses) {
      panel.classList.add(extraPanelClasses);
    }

    // Сначала создаем textarea, так как она нужна в updateColor
    const textarea = document.createElement('textarea');
    textarea.classList.add(CSS_CLASSES.textarea);

    textarea.rows = 2;

    if (state && typeof state.comment === 'string') {
      textarea.value = state.comment;
    }

    const header = document.createElement('div');
    header.classList.add(CSS_CLASSES.header);

    const colorWrapper = document.createElement('div');
    colorWrapper.classList.add(CSS_CLASSES.colorWrapper);

    // Преднастроенные цвета
    const PRESET_COLORS = [
      '#ffd966', // Yellow
      '#8dc6ff', // Blue
      '#28dd9a', // Green
      '#ff2b00', // Red
      '#e1bfff', // Purple
    ];

    let currentColor = state && state.color ? state.color : 'transparent';

    // Функция обновления цвета (определена до использования)
    function updateColor(newColor) {
      currentColor = newColor;

      // Обновляем UI кнопок
      const palette = colorWrapper.querySelector(`.${CSS_CLASSES.palette}`);
      if (palette) {
        const customLabel = palette.lastElementChild;
        Array.from(palette.children).forEach(child => {
          child.classList.remove(CSS_CLASSES.colorBtnActive);

          if (child === customLabel) {
            if (newColor !== 'transparent' && !PRESET_COLORS.includes(newColor)) {
              child.classList.add(CSS_CLASSES.colorBtnActive);
            }
          }
          else if (child.getAttribute('data-color') === newColor) {
            child.classList.add(CSS_CLASSES.colorBtnActive);
          }
        });
      }

      onChange({
        id: resumeId,
        comment: textarea.value,
        color: newColor,
      });
    }

    // Функция для создания кнопки цвета
    const createColorBtn = (color) => {
      const btn = document.createElement('div');
      btn.setAttribute('data-color', color);
      btn.classList.add(CSS_CLASSES.colorBtn);

      if (color === 'transparent') {
        btn.classList.add(CSS_CLASSES.colorBtnTransparent);
        btn.title = 'Сбросить цвет';
      }
      else {
        btn.style.backgroundColor = color;
      }

      // Выделение активного
      if (color === currentColor) {
        btn.classList.add(CSS_CLASSES.colorBtnActive);
      }

      btn.addEventListener('click', () => {
        updateColor(color);
      });

      return btn;
    };

    // Контейнер для палитры
    const palette = document.createElement('div');
    palette.setAttribute('data-hh-palette', 'true');
    palette.classList.add(CSS_CLASSES.palette);

    // Кнопка сброса (прозрачный)
    palette.appendChild(createColorBtn('transparent'));

    // Пресеты
    PRESET_COLORS.forEach(c => {
      palette.appendChild(createColorBtn(c));
    });

    // Кастомный выбор
    const customColorLabel = document.createElement('label');
    customColorLabel.title = 'Выбрать свой цвет';
    customColorLabel.classList.add(CSS_CLASSES.customLabel);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.classList.add(CSS_CLASSES.colorInput);

    // Если текущий цвет не из пресетов и не прозрачный
    if (currentColor !== 'transparent' && !PRESET_COLORS.includes(currentColor)) {
      colorInput.value = currentColor;
      customColorLabel.classList.add(CSS_CLASSES.colorBtnActive);
    }

    colorInput.addEventListener('input', (e) => {
      updateColor(e.target.value);
    });

    customColorLabel.appendChild(colorInput);
    palette.appendChild(customColorLabel);

    colorWrapper.appendChild(palette);
    header.appendChild(colorWrapper);

    // Обработчик изменения текста
    textarea.addEventListener('input', () => {
      onChange({
        id: resumeId,
        comment: textarea.value,
        color: currentColor,
      });
    });

    panel.appendChild(header);
    panel.appendChild(textarea);

    // Вставляем в конец карточки, но до внешней рамки
    // Вставляем в конец карточки (не привязываемся к классам границ, используем контейнер с data-qa-id)
    card.appendChild(panel);

    return panel;
  }

  function applyColorToCard(card, color) {
    if (!card) return;

    const markerAttr = 'data-hh-resume-color-applied';
    let marker = card.querySelector(`[${markerAttr}]`);
    if (!marker) {
      marker = document.createElement('div');
      marker.setAttribute(markerAttr, 'true');
      marker.classList.add(CSS_CLASSES.marker);

      // Карточка может быть position: static, поэтому оборачиваем в relative
      const style = window.getComputedStyle(card);
      if (style.position === 'static') {
        card.style.position = 'relative';
      }
      card.appendChild(marker);
    }

    marker.style.backgroundColor = color && color !== 'transparent' ? color : 'transparent';
  }

  function initForCard(card, storage, save) {
    if (!card) {
      return;
    }

    // Ищем ссылку с хешем внутри карточки
    const link = card.querySelector('a[data-qa^="resume-card-link-"]');
    if (!link) {
      return;
    }

    const qaAttr = link.getAttribute('data-qa');
    if (!qaAttr) {
      return;
    }

    // Извлекаем хеш из атрибута data-qa="resume-card-link-{hash}"
    const resumeId = qaAttr.replace('resume-card-link-', '');
    if (!resumeId) {
      return;
    }

    const state = storage[resumeId] || {};

    // Создаем панель и навешиваем обработчики
    createPanel({
      resumeId,
      card,
      state,
      onChange: (updated) => {
        storage[updated.id] = {
          comment: updated.comment || '',
          color: updated.color || 'transparent',
        };
        save(storage);
        applyColorToCard(card, storage[updated.id].color);
      },
    });

    // Применяем цвет при инициализации
    const colorToApply = state.color || 'transparent';
    applyColorToCard(card, colorToApply);
  }

  function initSingleResumePage(storage, save) {
    const match = window.location.pathname.match(/^\/resume\/([a-f0-9]+)/);

    if (!match) {
      return;
    }

    const resumeId = match[1];
    const titleContainer = document.querySelector('[data-qa="title-container"]');
    if (!titleContainer) {
      return;
    }

    const card = titleContainer.closest('div[class*="magritte-card"]');
    if (!card) {
      return;
    }

    if (card.querySelector('[data-hh-notes-panel]')) {
      return;
    }

    const state = storage[resumeId] || {};

    const panel = createPanel({
      resumeId,
      card,
      state,
      extraPanelClasses: CSS_CLASSES.panelPageResume,
      onChange: (updated) => {
        storage[updated.id] = {
          comment: updated.comment || '',
          color: updated.color || 'transparent',
        };
        save(storage);
        applyColorToCard(card, storage[updated.id].color);
      },
    });

    card.insertBefore(panel, card.firstChild);
    applyColorToCard(card, state.color || 'transparent');
  }

  function setup() {
    injectStyles();
    const storage = loadStorage();
    const save = saveStorage;

    const selector = '[data-qa="resume"][data-qa-id], [data-qa="resume resume-highlighted"][data-qa-id]';
    const cards = document.querySelectorAll(selector);
    cards.forEach((card) => initForCard(card, storage, save));

    initSingleResumePage(storage, save);

    // На случай динамической подгрузки резюме
    const observer = new MutationObserver((mutations) => {
      let foundNew = false;

      initSingleResumePage(storage, save);

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          if (node.matches && node.matches(selector)) {
            initForCard(node, storage, save);
            foundNew = true;
          }
          else {
            const innerCards = node.querySelectorAll
              ? node.querySelectorAll(selector)
              : [];
            innerCards.forEach((card) => {
              initForCard(card, storage, save);
              foundNew = true;
            });
          }
        });
      });

      if (foundNew) {
        save(storage);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function waitForPageReady() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setup();
    }
    else {
      document.addEventListener('DOMContentLoaded', setup);
    }
  }

  waitForPageReady();
})();
