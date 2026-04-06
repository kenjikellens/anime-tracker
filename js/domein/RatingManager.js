export class RatingManager {
    static getRatingClass(rating) {
        if (rating === 0 || !rating) return 'unrated';
        if (rating >= 9) return 'r-9 glow-gold';
        if (rating >= 8) return 'r-8';
        if (rating >= 7) return 'r-7';
        if (rating >= 6) return 'r-6';
        if (rating >= 5) return 'r-5';
        if (rating >= 2) return 'r-4 glow-red';
        return 'r-0 glow-red';
    }

    static updateRating(anime, newRating) {
        anime.setRating(parseFloat(newRating));
    }
}