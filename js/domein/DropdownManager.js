import { UI_CLASSES } from './UIConstants.js';

let dropdownIdCounter = 0;

/**
 * DropdownManager domain module.
 * Enhances native HTML select dropdowns into keyboard-accessible custom UI dropdown components
 * with animated floating popup menus and checkmark indicators.
 */
export class DropdownManager {
    /**
     * Converts a target <select> element into a custom UI dropdown component.
     * @param {HTMLSelectElement} select - The target select element to enhance.
     */
    static bind(select) {
        if (!select) return;

        // Clean up any previously attached custom wrapper for this select
        const existingWrapper = select.nextElementSibling;
        if (existingWrapper && existingWrapper.classList.contains(UI_CLASSES.DROPDOWN.WRAPPER)) {
            existingWrapper.remove();
        }

        select.dataset.customDropdownBound = 'true';
        select.dataset.bound = 'true';

        const isFullWidth = select.className.includes(UI_CLASSES.DROPDOWN.FULL_WIDTH);
        const isItemStatus = select.className.includes(UI_CLASSES.DROPDOWN.ITEM_STATUS);

        const wrapper = document.createElement('div');
        wrapper.className = `${UI_CLASSES.DROPDOWN.WRAPPER}${isFullWidth ? ` ${UI_CLASSES.DROPDOWN.FULL_WIDTH}` : ''}${isItemStatus ? ` ${UI_CLASSES.DROPDOWN.ITEM_STATUS}` : ''}`;
        wrapper.dataset.open = 'false';

        const currentOpt = select.options[select.selectedIndex] || select.options[0];
        const menuId = `custom-dropdown-menu-${++dropdownIdCounter}`;

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = `${UI_CLASSES.DROPDOWN.TRIGGER} status-btn-style ${UI_CLASSES.ULTIMATE_HOVER}${isItemStatus ? ` ${UI_CLASSES.DROPDOWN.ITEM_STATUS}` : ''}`;
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', menuId);
        const selectAriaLabel = select.getAttribute('aria-label');
        if (selectAriaLabel) {
            trigger.setAttribute('aria-label', selectAriaLabel);
        }

        const labelSpan = document.createElement('span');
        labelSpan.className = UI_CLASSES.DROPDOWN.LABEL;
        labelSpan.textContent = currentOpt ? currentOpt.textContent : '';

        const chevronSvg = `
            <svg class="${UI_CLASSES.DROPDOWN.CHEVRON} svg-icon-margin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <use href="#icon-chevron-down"></use>
            </svg>
        `;

        trigger.appendChild(labelSpan);
        trigger.insertAdjacentHTML('beforeend', chevronSvg);
        wrapper.appendChild(trigger);

        const menu = document.createElement('div');
        menu.id = menuId;
        menu.className = UI_CLASSES.DROPDOWN.MENU;
        menu.setAttribute('role', 'listbox');

        const close = (restoreFocus = false) => {
            wrapper.dataset.open = 'false';
            wrapper.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
            const row = wrapper.closest('.detail-item-row');
            if (row) row.classList.remove('dropdown-open');
            const acc = wrapper.closest('.item-accordion-wrapper');
            if (acc) acc.classList.remove('dropdown-open');
            if (restoreFocus) trigger.focus();
        };

        const open = (focusSelected = false) => {
            DropdownManager.closeAll();
            wrapper.dataset.open = 'true';
            wrapper.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
            const row = wrapper.closest('.detail-item-row');
            if (row) row.classList.add('dropdown-open');
            const acc = wrapper.closest('.item-accordion-wrapper');
            if (acc) acc.classList.add('dropdown-open');
            if (focusSelected) {
                const activeOpt = menu.querySelector('[aria-selected="true"]') || menu.querySelector('[role="option"]');
                if (activeOpt) activeOpt.focus();
            }
        };

        const renderMenu = () => {
            menu.innerHTML = '';
            Array.from(select.options).forEach((opt, idx) => {
                const isSelected = idx === select.selectedIndex;
                const item = document.createElement('button');
                item.type = 'button';
                item.className = `${UI_CLASSES.DROPDOWN.OPTION} ${UI_CLASSES.ULTIMATE_HOVER}${isSelected ? ' active' : ''}`;
                item.setAttribute('role', 'option');
                item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                item.tabIndex = -1;
                if (isSelected) {
                    item.dataset.active = 'true';
                }
                item.dataset.value = opt.value;

                const textSpan = document.createElement('span');
                textSpan.textContent = opt.textContent;
                item.appendChild(textSpan);

                if (isSelected) {
                    const checkSvg = `
                        <svg class="${UI_CLASSES.DROPDOWN.CHECK}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <use href="#icon-check"></use>
                        </svg>
                    `;
                    item.insertAdjacentHTML('beforeend', checkSvg);
                }

                const selectOption = () => {
                    select.value = opt.value;
                    labelSpan.textContent = opt.textContent;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    close(true);
                    renderMenu();
                };

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectOption();
                });

                item.addEventListener('keydown', (e) => {
                    const options = Array.from(menu.querySelectorAll('[role="option"]'));
                    const currentIndex = options.indexOf(item);
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        options[(currentIndex + 1) % options.length]?.focus();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        options[(currentIndex - 1 + options.length) % options.length]?.focus();
                    } else if (e.key === 'Home') {
                        e.preventDefault();
                        options[0]?.focus();
                    } else if (e.key === 'End') {
                        e.preventDefault();
                        options[options.length - 1]?.focus();
                    } else if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        selectOption();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        close(true);
                    }
                });

                menu.appendChild(item);
            });
        };

        renderMenu();
        wrapper.appendChild(menu);

        const toggle = (e, viaKeyboard = false) => {
            e.stopPropagation();
            e.preventDefault();
            const isOpen = wrapper.dataset.open === 'true';
            if (isOpen) {
                close(viaKeyboard);
            } else {
                open(viaKeyboard);
            }
        };

        trigger.addEventListener('click', (e) => toggle(e, false));
        wrapper.addEventListener('click', (e) => e.stopPropagation());

        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                open(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                close(true);
            }
        });

        select.parentNode.insertBefore(wrapper, select.nextSibling);
    }

    /**
     * Closes all open custom dropdown menus across the document.
     */
    static closeAll() {
        document.querySelectorAll(`.${UI_CLASSES.DROPDOWN.WRAPPER}`).forEach(w => {
            w.dataset.open = 'false';
            w.classList.remove('open');
            const trigger = w.querySelector(`.${UI_CLASSES.DROPDOWN.TRIGGER}`);
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
        document.querySelectorAll('.dropdown-open').forEach(el => {
            el.classList.remove('dropdown-open');
        });
    }

    /**
     * Scans and converts all select.app-dropdown elements within a target scope.
     * @param {HTMLElement|Document} scope - Parent element to scan for dropdowns.
     */
    static bindAll(scope = document) {
        const selects = scope.querySelectorAll('select.app-dropdown');
        selects.forEach(sel => DropdownManager.bind(sel));
    }
}

// Global click and escape listener to close open dropdown menus
document.addEventListener('click', (e) => {
    if (!e.target.closest(`.${UI_CLASSES.DROPDOWN.WRAPPER}`)) {
        DropdownManager.closeAll();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        DropdownManager.closeAll();
    }
});
