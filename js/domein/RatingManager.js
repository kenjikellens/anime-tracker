import { UI_CLASSES } from './UIConstants.js';

/**
 * Maps ratings to visual classes and updates the anime model.
 * Linked to: rating badges and glow effects in the CSS.
 */
export class RatingManager {
    /**
     * Returns a card-level glow class.
     * @param {number} rating - The rating value.
     * @returns {string} The card glow class name or empty string.
     */
    static getCardClass(rating) {
        if (!rating || rating === 0) return '';
        if (rating >= 9) return UI_CLASSES.RATING.GLOW_GOLD;
        return '';
    }

    /**
     * Returns a compact badge class for a numeric rating.
     * @param {number} rating - The rating value.
     * @returns {string} The badge class token.
     */
    static getBadgeClass(rating) {
        if (rating === 0 || !rating) return UI_CLASSES.RATING.UNRATED;
        if (rating >= 9.0) return UI_CLASSES.RATING.CINEMA;
        if (rating >= 8.0) return UI_CLASSES.RATING.AWESOME;
        if (rating >= 7.0) return UI_CLASSES.RATING.GREAT;
        if (rating >= 6.0) return UI_CLASSES.RATING.GOOD;
        if (rating >= 5.0) return UI_CLASSES.RATING.REGULAR;
        if (rating >= 4.0) return UI_CLASSES.RATING.BAD;
        return UI_CLASSES.RATING.GARBAGE;
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
