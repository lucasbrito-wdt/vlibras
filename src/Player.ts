import EventEmitter from './EventEmitter';
import assign from 'object-assign';
import url from 'url-join';

import PlayerManagerAdapter from './PlayerManagerAdapter';
import GlosaTranslator from './GlosaTranslator';
import SpeechProcessor from './SpeechProcessor';

const translatorURL = import.meta.env.VITE_TRANSLATOR_URL

console.log(`Translator URL: ${translatorURL}`);

// Declaração de tipos para o ambiente global
declare global {
    interface Window {
        UnityLoader: any;
    }
    const UnityLoader: any;
}

enum STATUS {
    IDLE = 'idle',
    PREPARING = 'preparing',
    PLAYING = 'playing',
}

interface PlayerOptions {
    translator?: string;
    targetPath?: string;
    onLoad?: () => void;
    progress?: any;
}

interface TranslationOptions {
    isEnabledStats?: boolean;
}

interface PlayOptions {
    fromTranslation?: boolean;
    isEnabledStats?: boolean;
}

class Player extends EventEmitter {
    private options: PlayerOptions;
    private playerManager: any;
    private translator: GlosaTranslator;
    private gloss?: string;
    private loaded: boolean;
    private gameContainer: HTMLDivElement | null;
    private player: any;
    private status: STATUS;
    private region: string;
    private static globalGlosaLength: string = '';
    speechProcessor: SpeechProcessor;

    constructor(options: PlayerOptions = {}) {
        super();

        this.options = assign(
            {
                translator: import.meta.env.VITE_TRANSLATOR_URL,
                targetPath: 'target',
            },
            options
        );

        this.playerManager = new PlayerManagerAdapter();
        this.translator = new GlosaTranslator(this.options.translator as string);
        this.speechProcessor = new SpeechProcessor(this);

        this.gloss = undefined;
        this.loaded = false;
        this.gameContainer = null;
        this.player = null;
        this.status = STATUS.IDLE;
        this.region = 'BR';

        this.initEventListeners();
    }

    private initEventListeners(): void {
        this.playerManager.on('load', () => {
            this.loaded = true;
            this.emit('load');

            this.playerManager.setBaseUrl(import.meta.env.VITE_DICTIONARY_UR);

            if (this.options.onLoad) {
                this.options.onLoad();
            } else {
                this.play(null, {fromTranslation: true});
            }
        });

        this.playerManager.on('progress', (progress: any) => {
            this.emit('animation:progress', progress);
        });

        this.playerManager.on('stateChange', (isPlaying: boolean, isPaused: boolean, isLoading: boolean) => {
            if (isPaused) {
                this.emit('animation:pause');
            } else if (isPlaying && !isPaused) {
                this.emit('animation:play');
                this.changeStatus(STATUS.PLAYING);
            } else if (!isPlaying && !isLoading) {
                this.emit('animation:end');
                this.changeStatus(STATUS.IDLE);
            }
        });

        this.playerManager.on('CounterGloss', (counter: any, glosaLength: string) => {
            this.emit('response:glosa', counter, glosaLength);
            Player.globalGlosaLength = glosaLength;
        });

        this.playerManager.on('GetAvatar', (avatar: any) => {
            this.emit('GetAvatar', avatar);
        });

        this.playerManager.on('FinishWelcome', (bool: boolean) => {
            this.emit('stop:welcome', bool);
        });
    }

    public translate(text: string, options: TranslationOptions = {}): void {
        const {isEnabledStats = true} = options;

        this.emit('translate:start');

        if (this.loaded) {
            this.stop();
        }


        try {
            this.translator.translate(text, window.location.host)
                .then((gloss: string) => {
                    this.play(gloss, {fromTranslation: true, isEnabledStats});
                    this.emit('translate:end');
                })
                .catch((error: any) => {
                    this.play(text.toUpperCase());
                    this.emit(
                        'error',
                        error === 'timeout_error' ? error : 'translation_error'
                    );
                });
        } catch (error) {
            this.play(text.toUpperCase());
            this.emit('error', 'translation_error');
        }
    }

    public play(glosa?: string | null, options: PlayOptions = {}): void {
        const {isEnabledStats = true} = options;

        const isDefaultUrl = (): boolean => {
            return (
                this.playerManager.currentBaseUrl ===
                import.meta.env.VITE_DICTIONARY_URL + this.region + '/'
            );
        };

        if (!isEnabledStats && isDefaultUrl()) {
            this.playerManager.setBaseUrl(import.meta.env.VITE_DICTIONARY_STATIC_URL + this.region + '/');
        } else if (isEnabledStats && !isDefaultUrl()) {
            this.playerManager.setBaseUrl(import.meta.env.VITE_DICTIONARY_URL + this.region + '/');
        }

        if (glosa !== null && glosa !== undefined) {
            this.gloss = glosa;
        }

        if (this.gloss !== undefined && this.loaded) {
            this.changeStatus(STATUS.PREPARING);
            this.playerManager.play(this.gloss);
        }
    }

    public playWellcome(): void {
        this.playerManager.playWellcome();
        this.emit('start:welcome');
    }

    public continue(): void {
        this.playerManager.play();
    }

    public repeat(): void {
        this.play();
    }

    public pause(): void {
        this.playerManager.pause();
    }

    public stop(): void {
        this.playerManager.stop();
    }

    public setSpeed(speed: number): void {
        this.playerManager.setSpeed(speed);
    }

    public setPersonalization(personalization: any): void {
        this.playerManager.setPersonalization(personalization);
    }

    public changeAvatar(avatarName: string): void {
        this.playerManager.changeAvatar(avatarName);
    }

    public toggleSubtitle(): void {
        this.playerManager.toggleSubtitle();
    }

    public setRegion(region: string): void {
        this.region = region;
        this.playerManager.setBaseUrl(import.meta.env.VITE_DICTIONARY_URL + region + '/');
    }

    // Adicione este método para iniciar o reconhecimento de voz
    public listenSpeech(targetLanguage?: string): Promise<string> {
        return this.speechProcessor.listen(targetLanguage);
    }

    // Adicione este método para cancelar o reconhecimento de voz
    public cancelSpeech(): void {
        this.speechProcessor.cancelListening();
    }

    // Método para verificar suporte à API de reconhecimento de voz
    public static isSpeechRecognitionSupported(): boolean {
        return SpeechProcessor.isSupported();
    }

    public load(wrapper: HTMLElement): void {
        this.gameContainer = document.createElement('div');
        this.gameContainer.setAttribute('id', 'gameContainer');
        this.gameContainer.classList.add('emscripten');

        if (typeof this.options.progress === 'function') {
        }

        wrapper.appendChild(this.gameContainer);

        this._initializeTarget();
    }

    private _getTargetScript(): string {
        return url(this.options.targetPath as string, 'UnityLoader.js');
    }

    private _initializeTarget(): void {
        const targetSetup = url(this.options.targetPath as string, 'playerweb.json');
        const targetScript = document.createElement('script');

        targetScript.src = this._getTargetScript();
        targetScript.onload = () => {
            this.player = window.UnityLoader.instantiate('gameContainer', targetSetup, {
                compatibilityCheck: (_: any, accept: Function, deny: Function) => {
                    if (window.UnityLoader.SystemInfo.hasWebGL) {
                        return accept();
                    }

                    this.emit('error', 'unsupported');
                    alert('Seu navegador não suporta WEBGL');
                    console.error('Seu navegador não suporta WEBGL');
                    deny();
                },
            });

            this.playerManager.setPlayerReference(this.player);
        };

        document.body.appendChild(targetScript);
    }

    public changeStatus(status: STATUS): void {
        switch (status) {
            case STATUS.IDLE:
                if (this.status === STATUS.PLAYING) {
                    this.status = status;
                    this.emit('gloss:end', Player.globalGlosaLength);
                }
                break;

            case STATUS.PREPARING:
                this.status = status;
                break;

            case STATUS.PLAYING:
                if (this.status === STATUS.PREPARING) {
                    this.status = status;
                    this.emit('gloss:start');
                }
                break;
        }
    }
}

export default Player;
