export class RatingManager {
    static getCardClass(rating) {
        if (!rating || rating === 0) return '';
        if (rating >= 9) return 'glow-gold';
        if (rating < 2) return 'glow-red';
        return '';
    }

    static getBadgeClass(rating) {
        if (rating === 0 || !rating) return 'unrated';
        if (rating >= 9.0) return 'r-cinema';  // Gold (Excellent)
        if (rating >= 8.0) return 'r-awesome'; // Dark Green
        if (rating >= 7.0) return 'r-great';   // Green
        if (rating >= 6.0) return 'r-good';    // Yellow
        if (rating >= 5.0) return 'r-regular'; // Orange
        if (rating >= 4.0) return 'r-bad';     // Red
        return 'r-garbage';                    // Purple
    }

    static updateRating(anime, newRating) {
        anime.setRating(parseFloat(newRating));
    }
}