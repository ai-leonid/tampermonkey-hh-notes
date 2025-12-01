// ==UserScript==
// @name         CRUSOR HH Resume Notes & Colors
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Добавляет заметки и цветовую пометку к каждому резюме на странице «Мои резюме» (hh.ru). Данные хранятся в localStorage.
// @author       you
// @match        *://*.hh.ru/applicant/resumes
// @icon         https://hh.ru/favicon.ico
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'hh-resume-notes-and-colors';

  function loadStorage() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      console.error('[HH Resume Notes] Failed to parse storage', e);
      return {};
    }
  }

  function saveStorage(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[HH Resume Notes] Failed to save storage', e);
    }
  }

  function createPanel(resumeId, card, state, onChange) {
    const existing = card.querySelector('[data-hh-notes-panel]');
    if (existing) return existing;

    const panel = document.createElement('div');
    panel.setAttribute('data-hh-notes-panel', 'true');

    // Стили максимально нейтральные
    panel.style.margin = '12px 16px 16px 16px';
    panel.style.padding = '8px 10px';
    panel.style.borderRadius = '8px';
    panel.style.background = 'rgba(0, 0, 0, 0.02)';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '2px';
    panel.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    panel.style.fontSize = '12px';

    // Сначала создаем textarea, так как она нужна в updateColor
    const textarea = document.createElement('textarea');
    textarea.rows = 2;
    textarea.style.resize = 'none';
    textarea.style.minHeight = '40px';
    textarea.style.padding = '6px 8px';
    textarea.style.borderRadius = '6px';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.fontSize = '12px';
    textarea.style.lineHeight = '1.4';
    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.boxSizing = 'border-box';

    if (state && typeof state.comment === 'string') {
      textarea.value = state.comment;
    }

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.gap = '8px';

    const colorWrapper = document.createElement('div');
    colorWrapper.style.display = 'flex';
    colorWrapper.style.alignItems = 'center';
    colorWrapper.style.gap = '8px';

    // Преднастроенные цвета
    const PRESET_COLORS = [
      '#ffd966', // Yellow
      '#8dc6ff', // Blue
      '#84e1bc', // Green
      '#ff2b00', // Red
      '#e1bfff', // Purple
    ];

    let currentColor = state && state.color ? state.color : 'transparent';

    // Функция обновления цвета (определена до использования)
    function updateColor(newColor) {
      currentColor = newColor;

      // Обновляем UI кнопок
      const palette = colorWrapper.querySelector('[data-hh-palette]');
      if (palette) {
        const customLabel = palette.lastElementChild;
        Array.from(palette.children).forEach(child => {
          child.style.borderColor = 'transparent';
          child.style.transform = 'scale(1)';

          if (child === customLabel) {
             child.style.border = '1px solid rgba(0,0,0,0.2)';
             if (newColor !== 'transparent' && !PRESET_COLORS.includes(newColor)) {
                child.style.borderColor = '#333';
                child.style.transform = 'scale(1.1)';
             }
          } else if (child.getAttribute('data-color') === newColor) {
             child.style.borderColor = '#333';
             child.style.transform = 'scale(1.1)';
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
      btn.style.width = '18px';
      btn.style.height = '18px';
      btn.style.borderRadius = '50%';
      btn.style.cursor = 'pointer';
      btn.style.border = '2px solid transparent';

      if (color === 'transparent') {
        btn.style.background = `
          linear-gradient(to top left,
            rgba(0,0,0,0) 0%,
            rgba(0,0,0,0) calc(50% - 1px),
            rgba(0,0,0,0.4) 50%,
            rgba(0,0,0,0) calc(50% + 1px),
            rgba(0,0,0,0) 100%),
          transparent
        `;
        btn.style.border = '1px solid rgba(0,0,0,1)';
        btn.title = 'Сбросить цвет';
      } else {
        btn.style.backgroundColor = color;
      }

      // Выделение активного
      if (color === currentColor) {
         btn.style.borderColor = '#333';
         btn.style.transform = 'scale(1.1)';
      }

      btn.addEventListener('click', () => {
        updateColor(color);
      });

      return btn;
    };

    // Контейнер для палитры
    const palette = document.createElement('div');
    palette.setAttribute('data-hh-palette', 'true');
    palette.style.display = 'flex';
    palette.style.gap = '6px';

    // Кнопка сброса (прозрачный)
    palette.appendChild(createColorBtn('transparent'));

    // Пресеты
    PRESET_COLORS.forEach(c => {
      palette.appendChild(createColorBtn(c));
    });

    // Кастомный выбор
    const customColorLabel = document.createElement('label');
    customColorLabel.title = 'Выбрать свой цвет';
    customColorLabel.style.cursor = 'pointer';
    customColorLabel.style.display = 'flex';
    customColorLabel.style.alignItems = 'center';
    customColorLabel.style.justifyContent = 'center';
    customColorLabel.style.width = '18px';
    customColorLabel.style.height = '18px';
    customColorLabel.style.borderRadius = '50%';
    customColorLabel.style.border = '1px solid rgba(0,0,0,0.2)';
    customColorLabel.style.background = 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.style.visibility = 'hidden';
    colorInput.style.width = '0';
    colorInput.style.height = '0';
    colorInput.style.position = 'absolute';

    // Если текущий цвет не из пресетов и не прозрачный
    if (currentColor !== 'transparent' && !PRESET_COLORS.includes(currentColor)) {
      colorInput.value = currentColor;
      customColorLabel.style.borderColor = '#333';
      customColorLabel.style.transform = 'scale(1.1)';
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
      marker.style.position = 'absolute';
      marker.style.left = '0';
      marker.style.top = '0';
      marker.style.bottom = '0';
      marker.style.width = '4px';
      marker.style.borderRadius = '24px 0 0 24px';
      marker.style.pointerEvents = 'none';

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
    if (!card) return;

    const resumeId = card.getAttribute('data-qa-id');
    if (!resumeId) return;

    const state = storage[resumeId] || {};

    // Создаем панель и навешиваем обработчики
    createPanel(resumeId, card, state, (updated) => {
      storage[updated.id] = {
        comment: updated.comment || '',
        color: updated.color || 'transparent',
      };
      save(storage);
      applyColorToCard(card, storage[updated.id].color);
    });

    // Применяем цвет при инициализации
    const colorToApply = state.color || 'transparent';
    applyColorToCard(card, colorToApply);
  }

  function setup() {
    const storage = loadStorage();
    const save = saveStorage;

    const cards = document.querySelectorAll('[data-qa="resume resume-highlighted"][data-qa-id]');
    cards.forEach((card) => initForCard(card, storage, save));

    // На случай динамической подгрузки резюме
    const observer = new MutationObserver((mutations) => {
      let foundNew = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          if (node.matches && node.matches('[data-qa="resume resume-highlighted"][data-qa-id]')) {
            initForCard(node, storage, save);
            foundNew = true;
          } else {
            const innerCards = node.querySelectorAll
              ? node.querySelectorAll('[data-qa="resume resume-highlighted"][data-qa-id]')
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
    } else {
      document.addEventListener('DOMContentLoaded', setup);
    }
  }

  waitForPageReady();
})();
