import type {
    ColumnAliasSuggestion,
    KeywordSuggestion,
    VariableSuggestion,
} from '@gravity-ui/websql-autocomplete/shared';
import type {YQLEntity, YqlAutocompleteResult} from '@gravity-ui/websql-autocomplete/yql';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import {isAutocompleteColumn} from '../../../types/api/autocomplete';
import type {
    AutocompleteColumn,
    AutocompleteEntityType,
    TAutocompleteEntity,
} from '../../../types/api/autocomplete';

import {
    AggregateFunctions,
    EntitySettings,
    Pragmas,
    SimpleFunctions,
    SimpleTypes,
    TableFunction,
    Udfs,
    WindowFunctions,
} from './constants';

const CompletionItemKind: {
    [K in keyof typeof monaco.languages.CompletionItemKind]: (typeof monaco.languages.CompletionItemKind)[K];
} = {
    Method: 0,
    Function: 1,
    Constructor: 2,
    Field: 3,
    Variable: 4,
    Class: 5,
    Struct: 6,
    Interface: 7,
    Module: 8,
    Property: 9,
    Event: 10,
    Operator: 11,
    Unit: 12,
    Value: 13,
    Constant: 14,
    Enum: 15,
    EnumMember: 16,
    Keyword: 17,
    Text: 18,
    Color: 19,
    File: 20,
    Reference: 21,
    Customcolor: 22,
    Folder: 23,
    TypeParameter: 24,
    User: 25,
    Issue: 26,
    Snippet: 27,
};

const re = /[\s'"-/@]/;

const suggestionEntityToAutocomplete: Partial<Record<YQLEntity, AutocompleteEntityType[]>> = {
    externalDataSource: ['external_data_source'],
    externalTable: ['external_table'],
    replication: ['replication'],
    table: ['table', 'column_table'],
    tableStore: ['column_store'],
    topic: ['pers_queue_group'],
    view: ['view'],
    tableIndex: ['table_index', 'index'],
};

const commonSuggestionEntities: AutocompleteEntityType[] = ['dir', 'unknown', 'ext_sub_domain'];

const directoryTypes: AutocompleteEntityType[] = ['dir', 'ext_sub_domain'];

function filterAutocompleteEntities(
    autocompleteEntities: TAutocompleteEntity[] | undefined,
    suggestions: YQLEntity[],
) {
    const suggestionsSet = suggestions.reduce((acc, el) => {
        const autocompleteEntity = suggestionEntityToAutocomplete[el];
        if (autocompleteEntity) {
            autocompleteEntity.forEach((el) => acc.add(el));
        }
        return acc;
    }, new Set(commonSuggestionEntities));
    return autocompleteEntities?.filter(({Type}) => suggestionsSet.has(Type));
}

function wrapStringToBackticks(value: string) {
    let result = value;
    if (value.match(re)) {
        result = `\`${value}\``;
    }
    return result;
}

function removeBackticks(value: string) {
    let sliceStart = 0;
    let sliceEnd = value.length;
    if (value.startsWith('`')) {
        sliceStart = 1;
    }
    if (value.endsWith('`')) {
        sliceEnd = -1;
    }
    return value.slice(sliceStart, sliceEnd);
}

function isVariable(value: string) {
    return value.startsWith('$');
}

function removeStartSlash(value: string) {
    if (value.startsWith('/')) {
        return value.slice(1);
    }
    return value;
}

function normalizeEntityPrefix(value = '', database: string) {
    const valueWithoutBackticks = removeBackticks(value);
    if (!valueWithoutBackticks.startsWith('/')) {
        return valueWithoutBackticks;
    }
    let cleanedValue = removeStartSlash(valueWithoutBackticks);
    const cleanedDatabase = removeStartSlash(database);
    if (cleanedValue.startsWith(cleanedDatabase)) {
        cleanedValue = cleanedValue.slice(cleanedDatabase.length);
    }
    return removeStartSlash(cleanedValue);
}

type SuggestionType =
    | keyof Omit<YqlAutocompleteResult, 'errors' | 'suggestDatabases'>
    | 'suggestAllColumns';

const SuggestionsWeight: Record<SuggestionType, number> = {
    suggestTemplates: 0,
    suggestPragmas: 1,
    suggestEntity: 2,
    suggestAllColumns: 3,
    suggestColumns: 4,
    suggestColumnAliases: 5,
    suggestVariables: 6,
    suggestTableIndexes: 7,
    suggestTableHints: 8,
    suggestEntitySettings: 9,
    suggestKeywords: 10,
    suggestAggregateFunctions: 11,
    suggestTableFunctions: 12,
    suggestWindowFunctions: 13,
    suggestFunctions: 14,
    suggestSimpleTypes: 15,
    suggestUdfs: 16,
};

function getSuggestionIndex(suggestionType: SuggestionType) {
    return SuggestionsWeight[suggestionType];
}

async function getSimpleFunctions() {
    return SimpleFunctions;
}
async function getWindowFunctions() {
    return WindowFunctions;
}
async function getTableFunctions() {
    return TableFunction;
}
async function getAggregateFunctions() {
    return AggregateFunctions;
}
async function getPragmas() {
    return Pragmas;
}
async function getEntitySettings(entityType: YQLEntity) {
    return EntitySettings[entityType];
}
async function getUdfs() {
    return Udfs;
}
async function getSimpleTypes() {
    return SimpleTypes;
}

function getColumnDetails(col: AutocompleteColumn) {
    const {PKIndex, NotNull, Default} = col;
    const details = [];
    if (PKIndex !== undefined) {
        details.push(`PK${PKIndex}`);
    }
    if (NotNull) {
        details.push('NN');
    }
    if (Default) {
        details.push('Default');
    }
    const detailsString = details.length ? details.join(', ') : '';
    // return `Column${detailsString}`;
    return detailsString;
}

export async function generateColumnsSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
    suggestColumns: YqlAutocompleteResult['suggestColumns'],
    suggestVariables: YqlAutocompleteResult['suggestVariables'],
    database: string,
): Promise<monaco.languages.CompletionItem[]> {
    if (!suggestColumns?.tables) {
        return [];
    }
    const suggestions: monaco.languages.CompletionItem[] = [];
    const normalizedColumns = suggestColumns.all ? ([] as string[]) : undefined;
    const multi = suggestColumns.tables.length > 1;

    const normalizedSuggestions =
        suggestColumns.tables?.map((entity) => {
            let normalizedEntityName = removeBackticks(entity.name);
            if (!normalizedEntityName.endsWith('/') && !isVariable(normalizedEntityName)) {
                normalizedEntityName = `${normalizedEntityName}/`;
            }
            return {...entity, name: normalizeEntityPrefix(normalizedEntityName, database)};
        }) ?? [];

    const normalizedTableNames = normalizedSuggestions.map((entity) => entity.name);

    // remove duplicates if any
    const filteredTableNames = Array.from(new Set(normalizedTableNames));

    const tableSources = filteredTableNames.filter((name) => !isVariable(name));

    let autocompleteEntities: TAutocompleteEntity[] = [];
    if (tableSources.length) {
        const autocompleteResponse = await window.api.viewer.autocomplete({
            database,
            table: tableSources,
            limit: 1000,
        });
        if (autocompleteResponse.Success) {
            autocompleteEntities = autocompleteResponse.Result.Entities ?? [];
        }
    }

    const variableSources = filteredTableNames.filter(isVariable);
    const columnsFromVariable: TAutocompleteEntity[] = [];
    if (variableSources.length) {
        variableSources.forEach((source) => {
            const newColumns =
                suggestVariables
                    // Variable name from suggestions doesn't include $ sign
                    ?.find((variable) => source.slice(1) === variable.name)
                    ?.value?.columns?.map((col) => ({
                        Name: col,
                        Type: 'column' as const,
                        Parent: source,
                    })) ?? [];
            columnsFromVariable.push(...newColumns);
        });
    }

    const predefinedColumns: TAutocompleteEntity[] = normalizedSuggestions.reduce<
        TAutocompleteEntity[]
    >((acc, entity) => {
        const columns = entity.columns;
        if (columns) {
            acc.push(
                ...columns.map((col) => ({
                    Name: col,
                    Type: 'column' as const,
                    Parent: entity.name,
                })),
            );
        }
        return acc;
    }, []);

    const tableNameToAliasMap = suggestColumns.tables?.reduce(
        (acc, entity) => {
            const normalizedEntityName = normalizeEntityPrefix(
                removeBackticks(entity.name),
                database,
            );
            const aliases = acc[normalizedEntityName] ?? [];
            if (entity.alias) {
                aliases.push(entity.alias);
            }
            acc[normalizedEntityName] = aliases;
            return acc;
        },
        {} as Record<string, string[]>,
    );

    [...autocompleteEntities, ...columnsFromVariable, ...predefinedColumns].forEach((col) => {
        if (!isAutocompleteColumn(col)) {
            return;
        }

        const columnDetails = getColumnDetails(col);
        const normalizedName = wrapStringToBackticks(col.Name);

        const normalizedParentName = normalizeEntityPrefix(col.Parent, database);
        const aliases = tableNameToAliasMap[normalizedParentName];
        const currentSuggestionIndex = suggestions.length;
        if (aliases?.length) {
            aliases.forEach((a) => {
                const columnNameSuggestion = `${a}.${normalizedName}`;
                suggestions.push({
                    label: {label: columnNameSuggestion, description: columnDetails},
                    insertText: columnNameSuggestion,
                    kind: CompletionItemKind.Variable,
                    detail: 'Column',
                    range: rangeToInsertSuggestion,
                    sortText:
                        suggestionIndexToWeight(getSuggestionIndex('suggestColumns')) +
                        suggestionIndexToWeight(currentSuggestionIndex),
                });
                normalizedColumns?.push(columnNameSuggestion);
            });
        } else {
            let columnNameSuggestion = normalizedName;
            if (multi) {
                columnNameSuggestion = `${wrapStringToBackticks(normalizedParentName)}.${normalizedName}`;
            }
            suggestions.push({
                label: {
                    label: columnNameSuggestion,
                    description: columnDetails,
                },
                insertText: columnNameSuggestion,
                kind: CompletionItemKind.Variable,
                detail: 'Column',
                range: rangeToInsertSuggestion,
                sortText:
                    suggestionIndexToWeight(getSuggestionIndex('suggestColumns')) +
                    suggestionIndexToWeight(currentSuggestionIndex),
            });
            normalizedColumns?.push(columnNameSuggestion);
        }
    });
    if (normalizedColumns && normalizedColumns.length > 1) {
        const allColumns = normalizedColumns.join(', ');
        suggestions.push({
            label: allColumns,
            insertText: allColumns,
            kind: CompletionItemKind.Variable,
            range: rangeToInsertSuggestion,
            sortText: suggestionIndexToWeight(getSuggestionIndex('suggestAllColumns')),
        });
    }
    return suggestions;
}

export function generateColumnAliasesSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
    suggestColumnAliases?: ColumnAliasSuggestion[],
) {
    if (!suggestColumnAliases) {
        return [];
    }
    return suggestColumnAliases?.map((columnAliasSuggestion) => ({
        label: columnAliasSuggestion.name,
        insertText: columnAliasSuggestion.name,
        kind: CompletionItemKind.Variable,
        detail: 'Column alias',
        range: rangeToInsertSuggestion,
        sortText: suggestionIndexToWeight(getSuggestionIndex('suggestColumnAliases')),
    }));
}
export function generateKeywordsSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
    suggestKeywords?: KeywordSuggestion[],
) {
    if (!suggestKeywords) {
        return [];
    }
    return suggestKeywords.map((keywordSuggestion) => ({
        label: keywordSuggestion.value,
        insertText: keywordSuggestion.value,
        kind: CompletionItemKind.Keyword,
        detail: 'Keyword',
        range: rangeToInsertSuggestion,
        sortText: suggestionIndexToWeight(getSuggestionIndex('suggestKeywords')),
    }));
}

export function generateVariableSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
    suggestVariables?: VariableSuggestion[],
) {
    if (!suggestVariables) {
        return [];
    }
    return suggestVariables.map(({name}) => {
        const variable = '$' + name;
        return {
            label: variable,
            insertText: variable,
            kind: CompletionItemKind.Variable,
            detail: 'Variable',
            range: rangeToInsertSuggestion,
            sortText: suggestionIndexToWeight(getSuggestionIndex('suggestVariables')),
        };
    });
}

export async function generateEntitiesSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
    suggestEntities: YQLEntity[],
    database: string,
    prefix?: string,
): Promise<monaco.languages.CompletionItem[]> {
    const normalizedPrefix = normalizeEntityPrefix(prefix, database);
    const data = await window.api.viewer.autocomplete({
        database,
        prefix: normalizedPrefix,
        limit: 1000,
    });
    const withBackticks = prefix?.startsWith('`');
    if (data.Success) {
        const filteredEntities = filterAutocompleteEntities(data.Result.Entities, suggestEntities);
        if (!filteredEntities) {
            return [];
        }
        return filteredEntities.reduce((acc, {Name, Type}) => {
            const isDir = directoryTypes.includes(Type);
            const label = isDir ? `${Name}/` : Name;
            let labelAsSnippet;
            if (isDir && !withBackticks) {
                labelAsSnippet = `\`${label}$0\``;
            }
            const suggestionIndex = acc.length;
            acc.push({
                label,
                insertText: labelAsSnippet ?? label,
                kind: isDir ? CompletionItemKind.Folder : CompletionItemKind.Text,
                insertTextRules: labelAsSnippet
                    ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                    : monaco.languages.CompletionItemInsertTextRule.None,
                detail: Type,
                range: rangeToInsertSuggestion,
                command: label.endsWith('/')
                    ? {id: 'editor.action.triggerSuggest', title: ''}
                    : undefined,
                // first argument is responsible for sorting groups of suggestions, the second - to preserve suggestions order returned from backend
                sortText:
                    suggestionIndexToWeight(getSuggestionIndex('suggestEntity')) +
                    suggestionIndexToWeight(suggestionIndex),
            });
            return acc;
        }, [] as monaco.languages.CompletionItem[]);
    }
    return [];
}
export async function generateSimpleFunctionsSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
): Promise<monaco.languages.CompletionItem[]> {
    const functions = await getSimpleFunctions();
    return functions.map((el) => ({
        label: el,
        insertText: el,
        kind: CompletionItemKind.Function,
        detail: 'Function',
        range: rangeToInsertSuggestion,
        sortText: suggestionIndexToWeight(getSuggestionIndex('suggestFunctions')),
    }));
}
export async function generateSimpleTypesSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
): Promise<monaco.languages.CompletionItem[]> {
    const simpleTypes = await getSimpleTypes();
    return simpleTypes.map((el) => ({
        label: el,
        insertText: el,
        kind: CompletionItemKind.TypeParameter,
        detail: 'Type',
        range: rangeToInsertSuggestion,
        sortText: suggestionIndexToWeight(getSuggestionIndex('suggestSimpleTypes')),
    }));
}
export async function generateUdfSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
): Promise<monaco.languages.CompletionItem[]> {
    const udfs = await getUdfs();
    return udfs.map((el) => ({
        label: el,
        insertText: el,
        kind: CompletionItemKind.Function,
        detail: 'UDF',
        range: rangeToInsertSuggestion,
        sortText: suggestionIndexToWeight(getSuggestionIndex('suggestUdfs')),
    }));
}
export async function generateWindowFunctionsSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
): Promise<monaco.languages.CompletionItem[]> {
    const windowFunctions = await getWindowFunctions();
    return windowFunctions.map((el) => ({
        label: el,
        insertText: el,
        kind: CompletionItemKind.Function,
        detail: 'Window function',
        range: rangeToInsertSuggestion,
        sortText: suggestionIndexToWeight(getSuggestionIndex('suggestWindowFunctions')),
    }));
}
export async function generateTableFunctionsSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
): Promise<monaco.languages.CompletionItem[]> {
    const tableFunctions = await getTableFunctions();
    return tableFunctions.map((el) => ({
        label: el,
        insertText: el,
        kind: CompletionItemKind.Function,
        detail: 'Table function',
        range: rangeToInsertSuggestion,
        sortText: suggestionIndexToWeight(getSuggestionIndex('suggestTableFunctions')),
    }));
}
export async function generateAggregateFunctionsSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
): Promise<monaco.languages.CompletionItem[]> {
    const aggreagteFunctions = await getAggregateFunctions();
    return aggreagteFunctions.map((el) => ({
        label: el,
        insertText: el,
        kind: CompletionItemKind.Function,
        detail: 'Aggregate function',
        range: rangeToInsertSuggestion,
        sortText: suggestionIndexToWeight(getSuggestionIndex('suggestAggregateFunctions')),
    }));
}
export async function generatePragmasSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
): Promise<monaco.languages.CompletionItem[]> {
    const pragmas = await getPragmas();
    return pragmas.map((el) => ({
        label: el,
        insertText: el,
        kind: CompletionItemKind.Module,
        detail: 'Pragma',
        range: rangeToInsertSuggestion,
        sortText: suggestionIndexToWeight(getSuggestionIndex('suggestPragmas')),
    }));
}
export async function generateEntitySettingsSuggestion(
    rangeToInsertSuggestion: monaco.IRange,
    entityType: YQLEntity,
): Promise<monaco.languages.CompletionItem[]> {
    const entitySettings = await getEntitySettings(entityType);
    return entitySettings.map((el) => ({
        label: el,
        insertText: el,
        kind: CompletionItemKind.Property,
        detail: 'Setting',
        range: rangeToInsertSuggestion,
        sortText: suggestionIndexToWeight(getSuggestionIndex('suggestEntitySettings')),
    }));
}

const alphabet = 'abcdefghijklmnopqrstuvwxyz';

function suggestionIndexToWeight(index: number): string {
    const characterInsideAlphabet = alphabet[index];
    if (characterInsideAlphabet) {
        return characterInsideAlphabet;
    }

    const duplicateTimes = Math.floor(index / alphabet.length);
    const remains = index % alphabet.length;

    const lastCharacter = alphabet.slice(-1);

    return lastCharacter.repeat(duplicateTimes) + alphabet[remains];
}
