/**
 * CustomDropdown utility module.
 * Converts native HTML <select> elements into fully styled custom UI dropdowns with animated menus and custom option items.
 */
export class CustomDropdown {
    /**
     * Converts a target <select> element into a custom UI dropdown.
     * @param {HTMLSelectElement} selectElement - The original select element to convert.
     */
    static convert(selectElement) {
        if (!selectElement || selectElement.dataset.customized === 'true') return;
        selectElement.dataset.customized = 'true';

        // Hide original select element visually while keeping it for change events
        selectElement.style.display = 'none';

        // Create container wrapper
        const container = document.createElement('div');
        container.className = 'custom-dropdown-container';

        // Create trigger button
        const selectedOption = selectElement.options[selectElement.selectedIndex] || selectElement.options[0];
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'custom-dropdown-trigger ultimate-hover-effect';
        if (selectElement.className.includes('full-width')) {
            container.classList.add('full-width');
        }

        const triggerText = document.createElement('span');
        triggerText.className = 'custom-dropdown-label';
        triggerText.textContent = selectedOption ? selectedOption.textContent : '';

        const chevronSvg = `
            <svg class="custom-dropdown-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;

        trigger.appendChild(triggerText);
        trigger.insertAdjacentHTML('beforeend', chevronSvg);
        container.appendChild(trigger);

        // Create dropdown menu popup
        const menu = document.createElement('div');
        menu.className = 'custom-dropdown-menu';

        // Render option items
        const renderOptions = () => {
            menu.innerHTML = '';
            Array.from(selectElement.options).forEach((opt, idx) => {
                const isSelected = idx === selectElement.selectedIndex;
                const optionItem = document.createElement('div');
                optionItem.className = `custom-dropdown-option${isSelected ? ' selected' : ''}`;
                optionItem.dataset.value = opt.value;

                const labelSpan = document.createElement('span');
                labelSpan.textContent = opt.textContent;
                optionItem.appendChild(labelSpan);

                if (isSelected) {
                    const checkSvg = `
                        <svg class="custom-dropdown-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    `;
                    optionItem.insertAdjacentHTML('beforeend', checkSvg);
                }

                optionItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectElement.value = opt.value;
                    triggerText.textContent = opt.textContent;
                    
                    // Dispatch change event on original select element
                    selectElement.dispatchEvent(new Event('change', { bubbles: true }));

                    closeMenu();
                    renderOptions();
                });

                menu.appendChild(optionItem);
            });
        };

        renderOptions();
        container.appendChild(menu);

        // Toggle menu visibility
        const toggleMenu = (e) => {
            e.stopPropagation();
            const isOpen = container.classList.contains('open');
            // Close all other custom dropdowns
            document.querySelectorAll('.custom-dropdown-container.open').forEach(c => {
                if (c !== container) c.classList.remove('open');
            });

            if (isOpen) {
                closeMenu();
            } else {
                container.classList.add('open');
            }
        };

        const closeMenu = () => {
            container.classList.remove('open');
        };

        trigger.addEventListener('click', toggleMenu);

        // Close on click outside or ESC key
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                closeMenu();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMenu();
            }
        });

        // Insert container into DOM in place of the original select
        selectElement.parentNode.insertBefore(container, selectElement.nextSibling);
    }

    /**
     * Converts all matching <select> elements in a container or document.
     * @param {HTMLElement|Document} scope - The parent container to search for selects.
     */
    static convertAll(scope = document) {
        const selects = scope.querySelectorAll('select.app-dropdown');
        selects.forEach(sel => CustomDropdown.convert(sel));
    }
}
