import { UI_CLASSES } from './UIConstants.js';

/**
 * DropdownManager domain module.
 * Enhances native HTML select dropdowns into fully interactive custom UI dropdown components
 * with animated floating popup menus, checkmark indicators, and ultimate hover effects.
 */
export class DropdownManager {
    /**
     * Converts a target <select> element into a custom UI dropdown component.
     * @param {HTMLSelectElement} select - The target select element to enhance.
     */
    static bind(select) {
        if (!select || select.dataset.customDropdownBound === 'true') return;
        select.dataset.customDropdownBound = 'true';
        select.dataset.bound = 'true';

        // Create custom dropdown wrapper container
        const isFullWidth = select.className.includes(UI_CLASSES.DROPDOWN.FULL_WIDTH);
        const isItemStatus = select.className.includes(UI_CLASSES.DROPDOWN.ITEM_STATUS);

        const wrapper = document.createElement('div');
        wrapper.className = `${UI_CLASSES.DROPDOWN.WRAPPER}${isFullWidth ? ` ${UI_CLASSES.DROPDOWN.FULL_WIDTH}` : ''}${isItemStatus ? ` ${UI_CLASSES.DROPDOWN.ITEM_STATUS}` : ''}`;
        wrapper.dataset.open = 'false';

        // Get currently selected option
        const currentOpt = select.options[select.selectedIndex] || select.options[0];

        // Create trigger button
        const trigger = document.createElement('div');
        trigger.className = `${UI_CLASSES.DROPDOWN.TRIGGER} status-btn-style ${UI_CLASSES.ULTIMATE_HOVER}${isItemStatus ? ` ${UI_CLASSES.DROPDOWN.ITEM_STATUS}` : ''}`;
        trigger.setAttribute('tabindex', '0');

        const labelSpan = document.createElement('span');
        labelSpan.className = UI_CLASSES.DROPDOWN.LABEL;
        labelSpan.textContent = currentOpt ? currentOpt.textContent : '';

        const chevronSvg = `
            <svg class="${UI_CLASSES.DROPDOWN.CHEVRON} svg-icon-margin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <use href="#icon-chevron-down"></use>
            </svg>
        `;

        trigger.appendChild(labelSpan);
        trigger.insertAdjacentHTML('beforeend', chevronSvg);
        wrapper.appendChild(trigger);

        // Create floating options menu
        const menu = document.createElement('div');
        menu.className = UI_CLASSES.DROPDOWN.MENU;

        /**
         * Renders the interactive option items inside the custom dropdown popup menu.
         * Updates the menu DOM tree with option buttons, active state, and ultimate hover effects.
         */
        const renderMenu = () => {
            menu.innerHTML = '';
            Array.from(select.options).forEach((opt, idx) => {
                const isSelected = idx === select.selectedIndex;
                const item = document.createElement('div');
                item.className = `${UI_CLASSES.DROPDOWN.OPTION} ${UI_CLASSES.ULTIMATE_HOVER}${isSelected ? ' active' : ''}`;
                if (isSelected) {
                    item.dataset.active = 'true';
                }
                item.dataset.value = opt.value;

                const textSpan = document.createElement('span');
                textSpan.textContent = opt.textContent;
                item.appendChild(textSpan);

                if (isSelected) {
                    const checkSvg = `
                        <svg class="${UI_CLASSES.DROPDOWN.CHECK}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <use href="#icon-check"></use>
                        </svg>
                    `;
                    item.insertAdjacentHTML('beforeend', checkSvg);
                }

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    select.value = opt.value;
                    labelSpan.textContent = opt.textContent;

                    // Trigger change event on native select
                    select.dispatchEvent(new Event('change', { bubbles: true }));

                    close();
                    renderMenu();
                });

                menu.appendChild(item);
            });
        };

        renderMenu();
        wrapper.appendChild(menu);

        // Toggle open state
        const toggle = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const isOpen = wrapper.dataset.open === 'true';
            DropdownManager.closeAll();
            if (!isOpen) {
                wrapper.dataset.open = 'true';
                wrapper.classList.add('open'); // Fallback for CSS compatibility
                const row = wrapper.closest('.detail-item-row');
                if (row) row.classList.add('dropdown-open');
                const acc = wrapper.closest('.item-accordion-wrapper');
                if (acc) acc.classList.add('dropdown-open');
            }
        };

        const close = () => {
            wrapper.dataset.open = 'false';
            wrapper.classList.remove('open');
            const row = wrapper.closest('.detail-item-row');
            if (row) row.classList.remove('dropdown-open');
            const acc = wrapper.closest('.item-accordion-wrapper');
            if (acc) acc.classList.remove('dropdown-open');
        };

        trigger.addEventListener('click', toggle);
        wrapper.addEventListener('click', (e) => e.stopPropagation());

        // Keyboard navigation support
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                toggle(e);
            }
        });

        // Insert wrapper next to select
        select.parentNode.insertBefore(wrapper, select.nextSibling);
    }

    /**
     * Closes all open custom dropdown menus across the document.
     */
    static closeAll() {
        document.querySelectorAll(`.${UI_CLASSES.DROPDOWN.WRAPPER}`).forEach(w => {
            w.dataset.open = 'false';
            w.classList.remove('open');
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
