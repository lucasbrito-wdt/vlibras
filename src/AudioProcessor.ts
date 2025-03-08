// src/AudioProcessor.ts

import EventEmitter from './EventEmitter';
import GlosaTranslator from './GlosaTranslator';
import Player from './Player';

// Interface para representar uma tarefa de processamento de áudio
interface AudioTask {
    id: string;
    audio: Blob | File;
    targetLanguage: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    result?: string;
    error?: any;
}

class AudioProcessor extends EventEmitter {
    private static instance: AudioProcessor;
    private player: Player;
    private translator: GlosaTranslator;
    private taskQueue: AudioTask[] = [];
    private isProcessing: boolean = false;
    private defaultLanguage: string = 'pt-BR';

    constructor(player: Player) {
        super();

        if (AudioProcessor.instance) {
            return AudioProcessor.instance;
        }

        this.player = player;
        this.translator = new GlosaTranslator(import.meta.env.VITE_TRANSLATOR_URL);

        AudioProcessor.instance = this;

        // Inicializa ouvintes de eventos
        this.initEventListeners();
    }

    private initEventListeners(): void {
        this.player.on('gloss:end', () => {
            this.processNextTask();
        });
    }

    /**
     * Adiciona uma nova tarefa de áudio à fila
     */
    public addAudioTask(audio: Blob | File, targetLanguage: string = this.defaultLanguage): string {
        const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const task: AudioTask = {
            id: taskId,
            audio,
            targetLanguage,
            status: 'queued'
        };

        this.taskQueue.push(task);
        console.log(`[AudioProcessor] Nova tarefa adicionada: ${taskId}. ${this.taskQueue.length} tarefas na fila.`);

        this.emit('task:added', taskId);

        // Se não estiver processando, inicie o processamento
        if (!this.isProcessing) {
            this.processNextTask();
        }

        return taskId;
    }

    /**
     * Processa a próxima tarefa da fila
     */
    private async processNextTask(): Promise<void> {
        if (this.taskQueue.length === 0 || this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        const task = this.taskQueue[0];
        task.status = 'processing';

        console.log(`[AudioProcessor] Processando tarefa: ${task.id}`);
        this.emit('task:processing', task.id);

        try {
            // 1. Transcrever áudio para texto
            const transcribedText = await this.transcribeAudio(task.audio);
            console.log(`[AudioProcessor] Transcrição concluída: "${transcribedText}"`);

            // 2. Traduzir texto se necessário
            if (task.targetLanguage === 'glosa') {
                // Traduzir diretamente para LIBRAS (glosa)
                await this.player.translate(transcribedText);
                task.result = transcribedText;
            } else {
                // Caso precise traduzir para outro idioma antes (não implementado)
                // Por enquanto, apenas assume que já está em português
                await this.player.translate(transcribedText);
                task.result = transcribedText;
            }

            task.status = 'completed';
            console.log(`[AudioProcessor] Tarefa concluída: ${task.id}`);
            this.emit('task:completed', task.id, task.result);

        } catch (error) {
            console.error(`[AudioProcessor] Erro ao processar tarefa ${task.id}:`, error);
            task.status = 'failed';
            task.error = error;
            this.emit('task:failed', task.id, error);
        } finally {
            // Remove a tarefa da fila
            this.taskQueue.shift();
            this.isProcessing = false;

            console.log(`[AudioProcessor] Restam ${this.taskQueue.length} tarefas na fila.`);

            // Se ainda houver tarefas, processa a próxima
            if (this.taskQueue.length > 0) {
                setTimeout(() => this.processNextTask(), 500);
            }
        }
    }

    /**
     * Simula a transcrição de áudio para texto
     * Na implementação real, usaria uma API de reconhecimento de voz
     */
    private async transcribeAudio(audio: Blob | File): Promise<string> {
        return new Promise((resolve) => {
            const simulatedTexts = [
                "Olá, como você está?",
                "O dia está bonito hoje.",
                "Gostaria de aprender Libras.",
                "Este é um sistema de tradução automática.",
                "Bem-vindo ao tradutor de áudio para Libras."
            ];

            const randomText = simulatedTexts[Math.floor(Math.random() * simulatedTexts.length)];

            console.log('[AudioProcessor] Realizando transcrição de áudio...');

            // Simula o tempo de processamento de transcrição
            setTimeout(() => {
                console.log('[AudioProcessor] Transcrição concluída');
                resolve(randomText);
            }, 1500);
        });
    }

    /**
     * Obtém o status de uma tarefa específica
     */
    public getTaskStatus(taskId: string): AudioTask | null {
        const task = this.taskQueue.find(t => t.id === taskId);
        return task || null;
    }

    /**
     * Limpa a fila de tarefas
     */
    public clearQueue(): void {
        const pendingTasks = this.taskQueue.length;
        this.taskQueue = [];
        console.log(`[AudioProcessor] Fila limpa. ${pendingTasks} tarefas removidas.`);
        this.emit('queue:cleared', pendingTasks);
    }

    /**
     * Altera o idioma padrão de destino
     */
    public setDefaultLanguage(language: string): void {
        this.defaultLanguage = language;
        console.log(`[AudioProcessor] Idioma padrão alterado para: ${language}`);
    }
}

export default AudioProcessor;
