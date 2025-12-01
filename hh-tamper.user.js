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

    // Стили максимально нейтральные, чтобы не ломать дизайн HH
    panel.style.margin = '12px 16px 16px 16px';
    panel.style.padding = '8px 10px';
    panel.style.borderRadius = '8px';
    panel.style.background = 'rgba(0, 0, 0, 0.02)';
    panel.style.border = '1px solid rgba(0, 0, 0, 0.05)';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '6px';
    panel.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    panel.style.fontSize = '12px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.gap = '8px';

    const title = document.createElement('span');
    title.textContent = 'Моя пометка';
    title.style.fontWeight = '500';

    const colorWrapper = document.createElement('div');
    colorWrapper.style.display = 'flex';
    colorWrapper.style.alignItems = 'center';
    colorWrapper.style.gap = '4px';

    const colorLabel = document.createElement('span');
    colorLabel.textContent = 'Цвет:';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.style.width = '24px';
    colorInput.style.height = '24px';
    colorInput.style.padding = '0';
    colorInput.style.border = 'none';
    colorInput.style.background = 'transparent';
    colorInput.style.cursor = 'pointer';

    const defaultColor = '#ffd966'; // мягкий желтый по умолчанию

    colorInput.value = state && state.color ? state.color : defaultColor;

    colorWrapper.appendChild(colorLabel);
    colorWrapper.appendChild(colorInput);

    header.appendChild(title);
    header.appendChild(colorWrapper);

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Ваш комментарий к этому резюме';
    textarea.rows = 2;
    textarea.style.resize = 'vertical';
    textarea.style.minHeight = '40px';
    textarea.style.padding = '6px 8px';
    textarea.style.borderRadius = '6px';
    textarea.style.border = '1px solid rgba(0, 0, 0, 0.12)';
    textarea.style.fontSize = '12px';
    textarea.style.lineHeight = '1.4';
    textarea.style.width = '100%';
    textarea.style.boxSizing = 'border-box';

    if (state && typeof state.comment === 'string') {
      textarea.value = state.comment;
    }

    // Обработчики изменений
    textarea.addEventListener('input', () => {
      onChange({
        id: resumeId,
        comment: textarea.value,
        color: colorInput.value,
      });
    });

    colorInput.addEventListener('input', () => {
      onChange({
        id: resumeId,
        comment: textarea.value,
        color: colorInput.value,
      });
    });

    panel.appendChild(header);
    panel.appendChild(textarea);

    // Вставляем в конец карточки, но до внешней рамки
    // Обычно удобнее всего добавить перед последним элементом-границей, если он есть
    const borderEl = card.querySelector('.magritte-border-element___x7sZL_8-2-1:last-of-type');
    if (borderEl && borderEl.parentElement === card) {
      card.insertBefore(panel, borderEl);
    } else {
      card.appendChild(panel);
    }

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

    marker.style.backgroundColor = color || '#ffd966';
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
        color: updated.color || '#ffd966',
      };
      save(storage);
      applyColorToCard(card, storage[updated.id].color);
    });

    // Применяем цвет при инициализации
    const colorToApply = state.color || '#ffd966';
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
