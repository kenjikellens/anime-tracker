export class StatusUpdater {
    static updateGlobalStatus(anime, newStatus) {
        anime.setGlobalStatus(parseInt(newStatus, 10));
    }
    
    static updateItemStatus(item, newStatus) {
        item.setStatus(newStatus);
    }
}