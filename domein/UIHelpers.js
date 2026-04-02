// domein/UIHelpers.js
window.UIHelpers = (function() {

    /**
     * Geeft de Font Awesome CSS-klasse terug passend bij de gegeven status.
     * @param {number|null} status
     * @returns {string} FontAwesome klasse
     */
    function statusIcon(status) {
        if (status === null) return 'fas fa-clock';
        const icons = {
            '-1': 'fas fa-clock',
            '0': 'fas fa-play',
            '1': 'fas fa-check'
        };
        return icons[String(status)] || icons['-1'];
    }

    /**
     * Geeft de Nederlandse statuslabel terug voor de gegeven numerieke status.
     * @param {number|null} status
     * @returns {string}
     */
    function statusLabel(status) {
        if (status === null) return 'Gepland';
        return status === -1 ? 'Te Bekijken' : status === 0 ? 'Bezig' : 'Bekeken';
    }

    /**
     * Bepaalt de CSS-klasse voor de ratingbadge op basis van het cijfer.
     * Klassen r-0 t/m r-9 regelen kleur en stijl van de badge.
     * @param {number} rating
     * @returns {string} CSS-klasse
     */
    function getRatingClass(rating) {
        if (rating === undefined || rating === null || rating < 0) return 'unrated';
        if (rating >= 9) return 'r-9';
        if (rating >= 8) return 'r-8';
        if (rating >= 7) return 'r-7';
        if (rating >= 6) return 'r-6';
        if (rating >= 5) return 'r-5';
        if (rating >= 4) return 'r-4';
        return 'r-0';
    }

    return {
        statusIcon,
        statusLabel,
        getRatingClass
    };
})();
