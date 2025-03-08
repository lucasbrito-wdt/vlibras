import EventEmitter from './EventEmitter';

interface Window {
    onLoadPlayer(): void;
    updateProgress(progress: any): void;
    onPlayingStateChange(
        isPlaying: string | boolean,
        isPaused: string | boolean,
        isPlayingIntervalAnimation: string | boolean,
        isLoading: string | boolean,
        isRepeatable: string | boolean
    ): void;
    CounterGloss(counter: any, glosaLength: string): void;
    GetAvatar(avatar: any): void;
    FinishWelcome(bool: boolean): void;
}

declare global {
    interface Window {
        onLoadPlayer(): void;
        updateProgress(progress: any): void;
        onPlayingStateChange(
            isPlaying: string | boolean,
            isPaused: string | boolean,
            isPlayingIntervalAnimation: string | boolean,
            isLoading: string | boolean,
            isRepeatable: string | boolean
        ): void;
        CounterGloss(counter: any, glosaLength: string): void;
        GetAvatar(avatar: any): void;
        FinishWelcome(bool: boolean): void;
    }
}

const GAME_OBJECT = "PlayerManager";

class PlayerManagerAdapter extends EventEmitter {
    private static instance: PlayerManagerAdapter;
    private player: any;
    public subtitle: boolean = true;
    public currentBaseUrl: string = "";

    constructor() {
        super();

        if (PlayerManagerAdapter.instance) {
            return PlayerManagerAdapter.instance;
        }

        this.on("load", () => {
            this._send("initRandomAnimationsProcess");
        });

        // Inicializa eventos globais
        this.initializeGlobalEvents();

        PlayerManagerAdapter.instance = this;
    }

    private initializeGlobalEvents(): void {
        window.onLoadPlayer = () => {
            PlayerManagerAdapter.instance.emit("load");
        };

        window.updateProgress = (progress) => {
            PlayerManagerAdapter.instance.emit("progress", progress);
        };

        window.onPlayingStateChange = (
            isPlaying,
            isPaused,
            isPlayingIntervalAnimation,
            isLoading,
            isRepeatable
        ) => {
            PlayerManagerAdapter.instance.emit(
                "stateChange",
                this.toBoolean(isPlaying),
                this.toBoolean(isPaused),
                this.toBoolean(isLoading)
            );
        };

        window.CounterGloss = (counter, glosaLength) => {
            PlayerManagerAdapter.instance.emit("CounterGloss", counter, glosaLength);
        };

        window.GetAvatar = (avatar) => {
            PlayerManagerAdapter.instance.emit("GetAvatar", avatar);
        };

        window.FinishWelcome = (bool) => {
            PlayerManagerAdapter.instance.emit("FinishWelcome", bool);
        };
    }

    public setPlayerReference(player: any): void {
        this.player = player;
    }

    private _send(method: string, params?: any): void {
        this.player.SendMessage(GAME_OBJECT, method, params);
    }

    public play(glosa?: string): void {
        if (glosa) {
            this._send("playNow", glosa);
        } else {
            this._send("setPauseState", 0);
        }
    }

    public setPersonalization(personalization: any): void {
        this.player.SendMessage("CustomizationBridge", "setURL", personalization);
    }

    public pause(): void {
        this._send("setPauseState", 1);
    }

    public stop(): void {
        this._send("stopAll");
    }

    public setSpeed(speed: number): void {
        this._send("setSlider", speed);
    }

    public toggleSubtitle(): void {
        this.subtitle = !this.subtitle;
        this._send("setSubtitlesState", this.toInt(this.subtitle));
    }

    public playWellcome(): void {
        this._send("playWellcome");
    }

    public changeAvatar(avatarName: string): void {
        this._send("Change", avatarName);
    }

    public setBaseUrl(url: string): void {
        this._send("setBaseUrl", url);
        this.currentBaseUrl = url;
    }

    private toInt(boolean: boolean): number {
        return boolean ? 1 : 0;
    }

    private toBoolean(bool: string | boolean): boolean {
        return bool !== "False";
    }
}

export default PlayerManagerAdapter;
