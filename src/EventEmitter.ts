export default class EventEmitter {
    private events: Record<string, Function[]> = {};

    on(event: string, listener: Function): this {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return this;
    }

    emit(event: string, ...args: any[]): boolean {
        if (!this.events[event]) {
            return false;
        }
        this.events[event].forEach(listener => listener(...args));
        return true;
    }

    removeListener(event: string, listener: Function): this {
        if (!this.events[event]) {
            return this;
        }
        this.events[event] = this.events[event].filter(l => l !== listener);
        return this;
    }
}
