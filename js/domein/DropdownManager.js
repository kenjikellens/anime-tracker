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

        // Hide original native select element
        select.style.display = 'none';

        // Create custom dropdown wrapper container
        const isFullWidth = select.className.includes('full-width');
        const isItemStatus = select.className.includes('item-status-select');

        const wrapper = document.createElement('div');
        wrapper.className = `custom-select-wrapper${isFullWidth ? ' full-width' : ''}${isItemStatus ? ' item-status-select' : ''}`;

        // Get currently selected option
        const currentOpt = select.options[select.selectedIndex] || select.options[0];

        // Create trigger button
        const trigger = document.createElement('div');
        trigger.className = `custom-select-trigger ultimate-hover-effect${isItemStatus ? ' item-status-select' : ''}`;
        trigger.setAttribute('tabindex', '0');

        const labelSpan = document.createElement('span');
        labelSpan.className = 'custom-select-label';
        labelSpan.textContent = currentOpt ? currentOpt.textContent : '';

        const chevronSvg = `
            <svg class="custom-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;

        trigger.appendChild(labelSpan);
        trigger.insertAdjacentHTML('beforeend', chevronSvg);
        wrapper.appendChild(trigger);

        // Create floating options menu
        const menu = document.createElement('div');
        menu.className = 'custom-select-menu';

        // Render option items
        const renderMenu = () => {
            menu.innerHTML = '';
            Array.from(select.options).forEach((opt, idx) => {
                const isSelected = idx === select.selectedIndex;
                const item = document.createElement('div');
                item.className = `custom-select-option${isSelected ? ' active' : ''}`;
                item.dataset.value = opt.value;

                const textSpan = document.createElement('span');
                textSpan.textContent = opt.textContent;
                item.appendChild(textSpan);

                if (isSelected) {
                    const checkSvg = `
                        <svg class="custom-select-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
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
            const isOpen = wrapper.classList.contains('open');
            DropdownManager.closeAll();
            if (!isOpen) {
                wrapper.classList.add('open');
            }
        };

        const close = () => {
            wrapper.classList.remove('open');
        };

        trigger.addEventListener('click', toggle);

        // Keyboard navigation support
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
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
        document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
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
    if (!e.target.closest('.custom-select-wrapper')) {
        DropdownManager.closeAll();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        DropdownManager.closeAll();
    }
});
