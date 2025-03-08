import axios from 'axios';

class GlosaTranslator {
    private readonly endpoint: string;

    constructor(endpoint: string) {
        this.endpoint = endpoint;
    }

    async translate(text: string, domain: string): Promise<string> {
        let time = 15;
        const size = text.split(' ').length;

        if (size > 50) time += size * 0.4 / 10;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, time * 1000);

            const response = await axios.post(
                this.endpoint,
                { text, domain },
                {
                    signal: controller.signal,
                    timeout: time * 1000
                }
            );

            clearTimeout(timeoutId);
            return response.data;
        } catch (error) {
            // @ts-ignore
            if (axios.isCancel(error) || error.code === 'ECONNABORTED') {
                throw 'timeout_error';
            }
            throw error;
        }
    }
}

export default GlosaTranslator;
