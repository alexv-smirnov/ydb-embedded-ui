/* eslint-disable @typescript-eslint/consistent-type-imports */
enum RumErrorLevel {
    DEBUG = 'debug',
    ERROR = 'error',
    FATAL = 'fatal',
    INFO = 'info',
    WARN = 'warn',
}

interface RumLogData {
    message?: string;
    block?: string;
    method?: string;
    source?: string;
    sourceMethod?: string;
    type?: string;
    page?: string;
    service?: string;
    level?: RumErrorLevel;
    additional?: {
        [key: string]: string;
    };
}

interface RumCounter {
    ERROR_LEVEL: typeof RumErrorLevel;
    logError: (data: RumLogData, error?: Error) => void;
}

interface Window {
    Ya?: {
        Rum?: RumCounter;
    };

    ydbEditor?: Monaco.editor.IStandaloneCodeEditor;

    web_version?: boolean;
    custom_backend?: string;
    meta_backend?: string;

    userSettings?: import('../services/settings').SettingsObject;
    systemSettings?: import('../services/settings').SettingsObject;

    api: import('../services/api').YdbEmbeddedAPI;
}
