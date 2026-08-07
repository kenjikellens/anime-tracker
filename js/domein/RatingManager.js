/**
 * Maps ratings to semantic rating tiers and updates domain models.
 * Linked to: rating badges and glow effects in CSS via data attributes.
 */
export class RatingManager {
    /**
     * Returns a card-level glow tier identifier.
     * @param {number} rating - The rating value.
     * @returns {string} The card glow tier identifier or empty string.
     */
    static getCardClass(rating) {
        if (!rating || rating === 0) return '';
        if (rating >= 9) return 'glow-gold';
        return '';
    }

    /**
     * Returns a compact semantic tier key for a numeric rating.
     * @param {number} rating - The rating value.
     * @returns {string} Semantic rating tier identifier.
     */
    static getBadgeClass(rating) {
        if (rating === 0 || !rating) return 'unrated';
        if (rating >= 9.0) return 'cinema';
        if (rating >= 8.0) return 'awesome';
        if (rating >= 7.0) return 'great';
        if (rating >= 6.0) return 'good';
        if (rating >= 5.0) return 'regular';
        if (rating >= 4.0) return 'bad';
        return 'garbage';
    }

    /**
     * Writes the new rating into the model.
     * @param {Object} anime - Target anime model.
     * @param {number|string} newRating - New rating value.
     */
    static updateRating(anime, newRating) {
        anime.setRating(parseFloat(newRating));
    }

    /**
     * Writes the new rating into the item model.
     * @param {Object} item - Target item model.
     * @param {number|string} newRating - New rating value.
     */
    static updateItemRating(item, newRating) {
        item.setRating(parseFloat(newRating));
    }
}
