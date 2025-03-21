// src/SpeechProcessor.ts

import EventEmitter from './EventEmitter';
import Player from './Player';

// Interface para representar uma tarefa de processamento de fala
interface SpeechTask {
    id: string;
    text: string;
    targetLanguage: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    result?: string;
    error?: any;
    resolve?: (value: string) => void;
    reject?: (reason: any) => void;
}

class SpeechProcessor extends EventEmitter {
    private static instance: SpeechProcessor;
    private player: Player;
    private recognition: any;
    private isListening: boolean = false;
    private isContinuousMode: boolean = false;
    private taskQueue: SpeechTask[] = [];
    private isProcessing: boolean = false;
    private defaultLanguage: string = 'pt-BR';
    private supportedLanguages: string[] = [
        'pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'ja-JP', 'ko-KR'
    ];
    // Adicione estas propriedades à classe SpeechProcessor
    private continuousHandlersConfigured: boolean = false;

    constructor(player: Player) {
        super();

        if (SpeechProcessor.instance) {
            return SpeechProcessor.instance;
        }

        if (!SpeechProcessor.isSupported()) {
            throw new Error('Reconhecimento de voz não é suportado neste navegador');
        }

        this.player = player;
        this.initSpeechRecognition();

        SpeechProcessor.instance = this;
    }

    private initSpeechRecognition(): void {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        // Configuração inicial
        this.recognition.lang = this.defaultLanguage;
        this.recognition.continuous = true;
        this.recognition.interimResults = false;

        // Configurar eventos
        this.recognition.onstart = () => {
            console.log('[SpeechProcessor] Reconhecimento de voz iniciado');
            this.isListening = true;
            this.emit('speech:listening');
        };

        this.recognition.onend = () => {
            console.log('[SpeechProcessor] Reconhecimento de voz finalizado');
            this.isListening = false;

            // Reiniciar automaticamente se estiver no modo contínuo
            if (this.isContinuousMode) {
                console.log('[SpeechProcessor] Reiniciando reconhecimento...');
                this.startListening(this.recognition.lang);
            } else {
                this.emit('speech:ended');
            }
        };

        this.recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    const transcript = event.results[i][0].transcript.trim();
                    if (transcript) {
                        console.log(`[SpeechProcessor] Texto reconhecido: "${transcript}"`);
                        this.emit('speech:transcribed', transcript);

                        // Adicionar à fila de processamento
                        this.addTranscriptionTask(transcript, this.recognition.lang);
                    }
                }
            }
        };

        this.recognition.onerror = (event: any) => {
            console.error(`[SpeechProcessor] Erro no reconhecimento: ${event.error}`);

            // Reiniciar em caso de erro, exceto se for 'aborted'
            if (event.error !== 'aborted' && this.isContinuousMode) {
                setTimeout(() => {
                    if (this.isContinuousMode) this.startListening(this.recognition.lang);
                }, 1000);
            }

            this.emit('speech:error', event.error);
        };
    }

    /**
     * Inicia o modo de reconhecimento contínuo
     * Captura tudo que é falado e adiciona à fila de processamento
     */
    public startContinuousListening(language: string = this.defaultLanguage): void {
        if (!SpeechProcessor.isSupported()) {
            this.emit('speech:error', 'API de reconhecimento de voz não suportada');
            return;
        }

        // Configurar o modo contínuo
        this.isContinuousMode = true;

        // Configurar manipuladores de eventos para o modo contínuo
        if (!this.continuousHandlersConfigured) {
            // Manipulador para resultados no modo contínuo
            this.recognition.onresult = (event: any) => {
                const transcript = event.results[event.results.length - 1][0].transcript.trim();
                console.log(`[SpeechProcessor] Texto reconhecido: "${transcript}"`);

                // Emitir evento com o texto reconhecido
                this.emit('speech:transcribed', transcript);

                // Adicionar à fila de processamento
                this.addTranscriptionTask(transcript, this.defaultLanguage);
            };

            // Manipulador para quando o reconhecimento terminar (no modo contínuo, reiniciar)
            this.recognition.onend = () => {
                this.isListening = false;
                console.log('[SpeechProcessor] Reconhecimento finalizado');

                // Se ainda estiver no modo contínuo, reiniciar
                if (this.isContinuousMode) {
                    console.log('[SpeechProcessor] Reiniciando reconhecimento contínuo...');
                    setTimeout(() => {
                        if (this.isContinuousMode) {
                            this.startListening(language);
                        }
                    }, 500);
                }
            };

            // Manipulador para erros no reconhecimento
            this.recognition.onerror = (event: any) => {
                console.error('[SpeechProcessor] Erro no reconhecimento:', event.error);
                this.emit('speech:error', `Erro: ${event.error}`);

                // Se for um erro temporário e estiver no modo contínuo, tentar reiniciar
                if (this.isContinuousMode && ['network', 'service-not-allowed'].includes(event.error)) {
                    setTimeout(() => {
                        if (this.isContinuousMode) {
                            this.startListening(language);
                        }
                    }, 1000);
                }
            };

            // Marcar que os manipuladores foram configurados
            this.continuousHandlersConfigured = true;
        }

        // Configurações específicas para o reconhecimento contínuo
        this.recognition.continuous = true;
        this.recognition.interimResults = false; // Apenas resultados finais

        // Iniciar o reconhecimento
        console.log(`[SpeechProcessor] Iniciando modo de reconhecimento contínuo em ${language}`);
        this.emit('speech:continuous-start');
        this.startListening(language);
    }

    /**
     * Inicia o reconhecimento de voz por uma única vez
     * Retorna uma Promise que será resolvida com o texto reconhecido
     */
    public listen(language: string = this.defaultLanguage): Promise<string> {
        if (!this.supportedLanguages.includes(language)) {
            console.warn(`[SpeechProcessor] Idioma ${language} não suportado. Usando o padrão: ${this.defaultLanguage}`);
            language = this.defaultLanguage;
        }

        this.isContinuousMode = false;

        return new Promise((resolve, reject) => {
            // Configurar eventos temporários para esta instância de reconhecimento
            const onResult = (event: any) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        const transcript = event.results[i][0].transcript.trim();
                        if (transcript) {
                            this.recognition.removeEventListener('result', onResult);
                            this.recognition.removeEventListener('error', onError);
                            this.recognition.removeEventListener('end', onEnd);

                            this.isListening = false;
                            this.recognition.stop();

                            resolve(transcript);
                        }
                    }
                }
            };

            const onError = (event: any) => {
                this.recognition.removeEventListener('result', onResult);
                this.recognition.removeEventListener('error', onError);
                this.recognition.removeEventListener('end', onEnd);

                this.isListening = false;
                reject(event.error);
            };

            const onEnd = () => {
                this.recognition.removeEventListener('result', onResult);
                this.recognition.removeEventListener('error', onError);
                this.recognition.removeEventListener('end', onEnd);

                this.isListening = false;
                reject('Reconhecimento finalizado sem resultado');
            };

            this.recognition.addEventListener('result', onResult);
            this.recognition.addEventListener('error', onError);
            this.recognition.addEventListener('end', onEnd);

            this.startListening(language);
        });
    }

    /**
     * Adiciona uma tarefa de transcrição à fila
     */
    public addTranscriptionTask(text: string, targetLanguage: string = this.defaultLanguage): string {
        // Criar um ID único para a tarefa
        const taskId = `speech-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Criar objeto Promise para retornar resultado quando processado
        let taskResolve: ((value: string) => void) | undefined;
        let taskReject: ((reason: any) => void) | undefined;

        const resultPromise = new Promise<string>((resolve, reject) => {
            taskResolve = resolve;
            taskReject = reject;
        });

        // Criar tarefa
        const task: SpeechTask = {
            id: taskId,
            text,
            targetLanguage,
            status: 'queued',
            resolve: taskResolve,
            reject: taskReject
        };

        // Adicionar à fila
        this.taskQueue.push(task);
        console.log(`[SpeechProcessor] Nova tarefa adicionada: ${taskId}. ${this.taskQueue.length} tarefas na fila.`);

        // Emitir evento com a posição na fila (1 = próxima a ser processada)
        this.emit('speech:queued', taskId, this.taskQueue.length);

        // Iniciar processamento se não estiver processando
        if (!this.isProcessing) {
            this.processNextTask();
        }

        return taskId;
    }

    /**
     * Processa a próxima tarefa na fila
     */
    private async processNextTask(): Promise<void> {
        if (this.taskQueue.length === 0 || this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        const task = this.taskQueue[0];
        task.status = 'processing';

        console.log(`[SpeechProcessor] Processando tarefa: ${task.id} - "${task.text}"`);
        this.emit('speech:processing', task.id);

        try {
            // Traduzir para o idioma alvo - por enquanto, simulamos a tradução
            this.player.translate(task.text);

            const translatedText = await this.translateText(task.text, task.targetLanguage);
            console.log(`[SpeechProcessor] Tradução concluída: "${translatedText}"`);

            task.result = translatedText;
            task.status = 'completed';
            console.log(`[SpeechProcessor] Tarefa concluída: ${task.id}`);
            this.emit('speech:completed', task.id, task.result);

            // Resolver a Promise relacionada à tarefa
            if (task.resolve) task.resolve(translatedText);

        } catch (error) {
            console.error(`[SpeechProcessor] Erro ao processar tarefa ${task.id}:`, error);
            task.status = 'failed';
            task.error = error;
            this.emit('speech:failed', task.id, error);

            // Rejeitar a Promise relacionada à tarefa
            if (task.reject) task.reject(error);
        } finally {
            // Remover a tarefa da fila
            this.taskQueue.shift();
            this.isProcessing = false;

            console.log(`[SpeechProcessor] Restam ${this.taskQueue.length} tarefas na fila.`);

            // Processar próxima tarefa se houver
            if (this.taskQueue.length > 0) {
                setTimeout(() => this.processNextTask(), 500);
            }
        }
    }

    /**
     * Simula a tradução de texto para outro idioma
     * Na implementação real, usaria uma API de tradução
     */
    private async translateText(text: string, targetLanguage: string): Promise<string> {
        return new Promise((resolve) => {
            console.log(`[SpeechProcessor] Traduzindo texto para ${targetLanguage}...`);

            // Simula um tempo de processamento
            setTimeout(() => {
                // Por enquanto, retorna o mesmo texto (simulação)
                // Em uma implementação real, chamaria uma API de tradução
                console.log('[SpeechProcessor] Tradução concluída');
                resolve(text);
            }, 1000);
        });
    }

    /**
     * Inicia o reconhecimento de voz
     */
    private startListening(language: string): void {
        if (this.isListening) {
            this.recognition.stop();
        }

        try {
            this.recognition.lang = language;
            this.recognition.start();
        } catch (error) {
            console.error('[SpeechProcessor] Erro ao iniciar reconhecimento:', error);

            // Tentar reiniciar após um breve intervalo em caso de erro
            if (this.isContinuousMode) {
                setTimeout(() => {
                    if (this.isContinuousMode) this.startListening(language);
                }, 1000);
            }

            this.emit('speech:error', error);
        }
    }

    /**
     * Cancela o reconhecimento de voz
     */
    public cancelListening(): void {
        if (this.isListening) {
            this.isContinuousMode = false;
            this.recognition.stop();
        }
    }

    /**
     * Para o modo contínuo de reconhecimento
     */
    public stopContinuousListening(): void {
        this.isContinuousMode = false;
        if (this.isListening) {
            this.recognition.stop();
        }
        console.log('[SpeechProcessor] Modo contínuo desativado');
    }

    /**
     * Limpa a fila de tarefas
     */
    public clearQueue(): void {
        const pendingTasks = this.taskQueue.length;
        this.taskQueue = [];
        console.log(`[SpeechProcessor] Fila limpa. ${pendingTasks} tarefas removidas.`);
        this.emit('queue:cleared', pendingTasks);
    }

    /**
     * Altera o idioma padrão de reconhecimento
     */
    public setDefaultLanguage(language: string): void {
        if (this.supportedLanguages.includes(language)) {
            this.defaultLanguage = language;
            console.log(`[SpeechProcessor] Idioma padrão alterado para: ${language}`);
        } else {
            console.warn(`[SpeechProcessor] Idioma ${language} não suportado.`);
        }
    }

    /**
     * Retorna a lista de idiomas suportados
     */
    public getSupportedLanguages(): string[] {
        return [...this.supportedLanguages];
    }

    /**
     * Verifica se o navegador suporta reconhecimento de voz
     */
    public static isSupported(): boolean {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
}

// Adicionando as definições ao Window
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export default SpeechProcessor;
