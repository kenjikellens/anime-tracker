/**
 * Maps ratings to visual classes and updates the anime model.
 * Linked to: rating badges and glow effects in the CSS.
 */
export class RatingManager {
    /**
     * Returns a card-level glow class.
     */
    static getCardClass(rating) {
        if (!rating || rating === 0) return '';
        if (rating >= 9) return 'glow-gold';
        if (rating < 2) return 'glow-red';
        return '';
    }

    /**
     * Returns a compact badge class for a numeric rating.
     */
    static getBadgeClass(rating) {
        if (rating === 0 || !rating) return 'unrated';
        if (rating >= 9.0) return 'r-cinema';
        if (rating >= 8.0) return 'r-awesome';
        if (rating >= 7.0) return 'r-great';
        if (rating >= 6.0) return 'r-good';
        if (rating >= 5.0) return 'r-regular';
        if (rating >= 4.0) return 'r-bad';
        return 'r-garbage';
    }

    /**
     * Writes the new rating into the model.
     */
    static updateRating(anime, newRating) {
        anime.setRating(parseFloat(newRating));
    }

    /**
     * Writes the new rating into the item model.
     */
    static updateItemRating(item, newRating) {
        item.setRating(parseFloat(newRating));
    }
}
