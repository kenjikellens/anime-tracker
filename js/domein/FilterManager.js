/**
 * Manages the advanced filter popup modal, options state, localStorage persistence,
 * and multi-dimensional filter evaluations.
 */
export class FilterManager {
    static STORAGE_KEY = 'rascal_filter_options';

    /**
     * Initializes default empty filter options.
     */
    static getDefaultOptions() {
        return {
            franchiseStatuses: [],
            itemStatuses: [],
            itemTypes: [],
            ratingTiers: [],
            minRating: 0,
            genres: [],
            studios: [],
            years: [],
            progress: []
        };
    }

    /**
     * Loads persisted filter options from localStorage.
     * @returns {Object} Parsed filter options or defaults.
     */
    static loadOptions() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...this.getDefaultOptions(), ...parsed };
            }
        } catch (e) {
            console.error('Failed to load filter options:', e);
        }
        return this.getDefaultOptions();
    }

    /**
     * Persists active filter options to localStorage.
     * @param {Object} options - The filter options object to store.
     */
    static saveOptions(options) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(options));
        } catch (e) {
            console.error('Failed to save filter options:', e);
        }
    }

    /**
     * Counts how many non-default filter constraints are actively selected.
     * @param {Object} options - The filter options to inspect.
     * @returns {number} The total count of active filter dimensions.
     */
    static getActiveCount(options) {
        if (!options) return 0;
        let count = 0;
        if (options.franchiseStatuses && options.franchiseStatuses.length > 0) count += options.franchiseStatuses.length;
        if (options.itemStatuses && options.itemStatuses.length > 0) count += options.itemStatuses.length;
        if (options.itemTypes && options.itemTypes.length > 0) count += options.itemTypes.length;
        if (options.ratingTiers && options.ratingTiers.length > 0) count += options.ratingTiers.length;
        if (options.minRating && options.minRating > 0) count += 1;
        if (options.genres && options.genres.length > 0) count += options.genres.length;
        if (options.studios && options.studios.length > 0) count += options.studios.length;
        if (options.years && options.years.length > 0) count += options.years.length;
        if (options.progress && options.progress.length > 0) count += options.progress.length;
        return count;
    }

    /**
     * Checks whether any filter option is currently active.
     * @param {Object} options - The filter options to inspect.
     * @returns {boolean} True if any filter is set.
     */
    static hasActiveFilters(options) {
        return this.getActiveCount(options) > 0;
    }

    /**
     * Sets up the filter modal DOM listeners and binds trigger events.
     * @param {AnimeRepository} repository - Data repository for dynamic options.
     * @param {Function} onApplyCallback - Callback invoked when filters change.
     */
    static setup(repository, onApplyCallback) {
        const overlay = document.getElementById('filter-modal-overlay');
        const closeBtn = document.getElementById('close-filter-modal');
        const resetBtn = document.getElementById('reset-filters-btn');
        const applyBtn = document.getElementById('apply-filters-btn');

        if (!overlay) return;

        let activeOptions = this.loadOptions();

        const updateFilterButtonBadge = () => {
            const count = this.getActiveCount(activeOptions);
            const badge = document.getElementById('filter-active-count');
            const filterBtn = document.getElementById('filter-popup-btn');
            if (badge) {
                badge.textContent = count > 0 ? `(${count})` : '';
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
            if (filterBtn) {
                filterBtn.classList.toggle('has-active-filters', count > 0);
            }
        };

        updateFilterButtonBadge();

        const openModal = () => {
            this.populateModalOptions(overlay, repository, activeOptions);
            overlay.classList.remove('hidden');
            overlay.dataset.visible = 'true';
        };

        const closeModal = () => {
            overlay.classList.add('hidden');
            overlay.dataset.visible = 'false';
        };

        // Delegated click on document so dynamic buttons in home.html always trigger
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#filter-popup-btn');
            if (btn) {
                e.preventDefault();
                openModal();
            }
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                activeOptions = this.getDefaultOptions();
                this.saveOptions(activeOptions);
                this.populateModalOptions(overlay, repository, activeOptions);
                updateFilterButtonBadge();
                closeModal();
                if (onApplyCallback) onApplyCallback(activeOptions);
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                activeOptions = this.collectModalOptions(overlay);
                this.saveOptions(activeOptions);
                updateFilterButtonBadge();
                closeModal();
                if (onApplyCallback) onApplyCallback(activeOptions);
            });
        }

        return {
            getActiveOptions: () => activeOptions,
            updateBadge: () => updateFilterButtonBadge(),
            open: () => openModal(),
            reset: () => {
                activeOptions = this.getDefaultOptions();
                this.saveOptions(activeOptions);
                updateFilterButtonBadge();
                if (onApplyCallback) onApplyCallback(activeOptions);
            }
        };
    }

    /**
     * Populates dynamic genres, studios, years, and types into the filter modal.
     * @param {HTMLElement} overlay - Modal root overlay element.
     * @param {AnimeRepository} repository - Data repository.
     * @param {Object} options - Current active filter options.
     */
    static populateModalOptions(overlay, repository, options) {
        // 1. Franchise Status checkboxes
        overlay.querySelectorAll('input[name="filter-franchise-status"]').forEach(cb => {
            cb.checked = options.franchiseStatuses && options.franchiseStatuses.includes(cb.value);
        });

        // 2. Item Status checkboxes
        overlay.querySelectorAll('input[name="filter-item-status"]').forEach(cb => {
            cb.checked = options.itemStatuses && options.itemStatuses.includes(cb.value);
        });

        // 3. Item Types
        const typesContainer = overlay.querySelector('#filter-types-container');
        if (typesContainer) {
            const types = repository.getUniqueItemTypes();
            typesContainer.innerHTML = types.map(type => `
                <label class="filter-chip-checkbox ultimate-hover-effect">
                    <input type="checkbox" name="filter-item-type" value="${type}" ${(options.itemTypes || []).includes(type) ? 'checked' : ''}>
                    <span>${type}</span>
                </label>
            `).join('');
        }

        // 4. Rating tiers
        overlay.querySelectorAll('input[name="filter-rating-tier"]').forEach(cb => {
            cb.checked = options.ratingTiers && options.ratingTiers.includes(cb.value);
        });

        // 5. Min Rating slider/number
        const minRatingInput = overlay.querySelector('#filter-min-rating');
        const minRatingDisplay = overlay.querySelector('#filter-min-rating-val');
        if (minRatingInput) {
            minRatingInput.value = options.minRating || 0;
            if (minRatingDisplay) minRatingDisplay.textContent = options.minRating > 0 ? options.minRating.toFixed(1) : 'Alles';
            minRatingInput.oninput = (e) => {
                const val = parseFloat(e.target.value);
                if (minRatingDisplay) minRatingDisplay.textContent = val > 0 ? val.toFixed(1) : 'Alles';
            };
        }

        // 6. Genres
        const genresContainer = overlay.querySelector('#filter-genres-container');
        if (genresContainer) {
            const genres = repository.getUniqueGenres();
            genresContainer.innerHTML = genres.map(genre => `
                <label class="filter-chip-checkbox ultimate-hover-effect">
                    <input type="checkbox" name="filter-genre" value="${genre}" ${(options.genres || []).includes(genre) ? 'checked' : ''}>
                    <span>${genre}</span>
                </label>
            `).join('');
        }

        // 7. Studios
        const studioSelect = overlay.querySelector('#filter-studio-select');
        if (studioSelect) {
            const studios = repository.getUniqueStudios();
            studioSelect.innerHTML = `<option value="">Alle Studio's</option>` + studios.map(s => `
                <option value="${s}" ${(options.studios || []).includes(s) ? 'selected' : ''}>${s}</option>
            `).join('');
        }

        // 8. Years
        const yearSelect = overlay.querySelector('#filter-year-select');
        if (yearSelect) {
            const years = repository.getUniqueYears();
            yearSelect.innerHTML = `<option value="">Alle Jaren</option>` + years.map(y => `
                <option value="${y}" ${(options.years || []).includes(y.toString()) ? 'selected' : ''}>${y}</option>
            `).join('');
        }

        // 9. Progress
        overlay.querySelectorAll('input[name="filter-progress"]').forEach(cb => {
            cb.checked = options.progress && options.progress.includes(cb.value);
        });
    }

    /**
     * Reads all user inputs from the filter modal and constructs the options object.
     * @param {HTMLElement} overlay - Modal root overlay element.
     * @returns {Object} Collected filter options.
     */
    static collectModalOptions(overlay) {
        const getCheckedValues = (name) => {
            return Array.from(overlay.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);
        };

        const franchiseStatuses = getCheckedValues('filter-franchise-status');
        const itemStatuses = getCheckedValues('filter-item-status');
        const itemTypes = getCheckedValues('filter-item-type');
        const ratingTiers = getCheckedValues('filter-rating-tier');
        const progress = getCheckedValues('filter-progress');
        const genres = getCheckedValues('filter-genre');

        const minRatingInput = overlay.querySelector('#filter-min-rating');
        const minRating = minRatingInput ? parseFloat(minRatingInput.value) || 0 : 0;

        const studioSelect = overlay.querySelector('#filter-studio-select');
        const studios = studioSelect && studioSelect.value ? [studioSelect.value] : [];

        const yearSelect = overlay.querySelector('#filter-year-select');
        const years = yearSelect && yearSelect.value ? [yearSelect.value] : [];

        return {
            franchiseStatuses,
            itemStatuses,
            itemTypes,
            ratingTiers,
            minRating,
            genres,
            studios,
            years,
            progress
        };
    }
}
