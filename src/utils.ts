export function randomChoice<T>(items: T[]): T {
    if (items.length === 0) {
        throw new Error('Cannot pick from empty list');
    }
    const index = Math.floor(Math.random() * items.length);
    return items[index];
}
