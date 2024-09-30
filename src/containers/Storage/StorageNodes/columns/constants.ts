import type {SelectOption} from '@gravity-ui/uikit';
import {z} from 'zod';

import type {NodesGroupByField} from '../../../../types/api/nodes';
import type {ValueOf} from '../../../../types/common';

import i18n from './i18n';

export const STORAGE_NODES_COLUMNS_WIDTH_LS_KEY = 'storageNodesColumnsWidth';
export const STORAGE_NODES_SELECTED_COLUMNS_LS_KEY = 'storageNodesSelectedColumns';

export const STORAGE_NODES_COLUMNS_IDS = {
    NodeId: 'NodeId',
    Host: 'Host',
    DC: 'DC',
    Rack: 'Rack',
    Version: 'Version',
    Uptime: 'Uptime',
    PDisks: 'PDisks',
    Missing: 'Missing',
    DiskSpaceUsage: 'DiskSpaceUsage',
} as const;

type StorageNodesColumnId = ValueOf<typeof STORAGE_NODES_COLUMNS_IDS>;

export const DEFAULT_STORAGE_NODES_COLUMNS: StorageNodesColumnId[] = [
    'NodeId',
    'Host',
    'DC',
    'Rack',
    'Uptime',
    'PDisks',
];
export const REQUIRED_STORAGE_NODES_COLUMNS: StorageNodesColumnId[] = ['NodeId'];

// This code is running when module is initialized and correct language may not be set yet
// get functions guarantee that i18n fields will be inited on render with current render language
export const STORAGE_NODES_COLUMNS_TITLES = {
    get NodeId() {
        return i18n('nodes-id');
    },
    get Host() {
        return i18n('host');
    },
    get DC() {
        return i18n('dc');
    },
    get Rack() {
        return i18n('rack');
    },
    get Version() {
        return i18n('version');
    },
    get Uptime() {
        return i18n('uptime');
    },
    get PDisks() {
        return i18n('pdisks');
    },
    get Missing() {
        return i18n('missing');
    },
    get DiskSpaceUsage() {
        return i18n('disk-space-usage');
    },
} as const satisfies Record<StorageNodesColumnId, string>;

const STORAGE_NODES_GROUP_BY_PARAMS = [
    'Host',
    'DC',
    'Rack',
    'Version',
    'Uptime',
    'Missing',
    'DiskSpaceUsage',
] as const satisfies NodesGroupByField[];

export const STORAGE_NODES_GROUP_BY_OPTIONS: SelectOption[] = STORAGE_NODES_GROUP_BY_PARAMS.map(
    (param) => {
        return {
            value: param,
            content: STORAGE_NODES_COLUMNS_TITLES[param],
        };
    },
);

export const storageNodesGroupByParamSchema = z
    .custom<NodesGroupByField | undefined>((value) => STORAGE_NODES_GROUP_BY_PARAMS.includes(value))
    .catch(undefined);
