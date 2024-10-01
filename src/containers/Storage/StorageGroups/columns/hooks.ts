import React from 'react';

import {VISIBLE_ENTITIES} from '../../../../store/reducers/storage/constants';
import {useSelectedColumns} from '../../../../utils/hooks/useSelectedColumns';

import {getStorageGroupsColumns} from './columns';
import {
    DEFAULT_STORAGE_GROUPS_COLUMNS,
    REQUIRED_STORAGE_GROUPS_COLUMNS,
    STORAGE_GROUPS_COLUMNS_IDS,
    STORAGE_GROUPS_COLUMNS_TITLES,
    STORAGE_GROUPS_SELECTED_COLUMNS_LS_KEY,
} from './constants';
import type {GetStorageGroupsColumnsParams} from './types';

export function useGetStorageGroupsColumns(nodeId?: string) {
    return React.useMemo(() => {
        return getStorageGroupsColumns({nodeId});
    }, [nodeId]);
}

export function useStorageGroupsSelectedColumns({
    visibleEntities,
    nodeId,
}: GetStorageGroupsColumnsParams) {
    const columns = useGetStorageGroupsColumns(nodeId);

    const requiredColumns = React.useMemo(() => {
        if (visibleEntities === VISIBLE_ENTITIES.missing) {
            return [...REQUIRED_STORAGE_GROUPS_COLUMNS, STORAGE_GROUPS_COLUMNS_IDS.Degraded];
        }

        if (visibleEntities === VISIBLE_ENTITIES.space) {
            return [...REQUIRED_STORAGE_GROUPS_COLUMNS, STORAGE_GROUPS_COLUMNS_IDS.DiskSpace];
        }

        return REQUIRED_STORAGE_GROUPS_COLUMNS;
    }, [visibleEntities]);

    return useSelectedColumns(
        columns,
        STORAGE_GROUPS_SELECTED_COLUMNS_LS_KEY,
        STORAGE_GROUPS_COLUMNS_TITLES,
        DEFAULT_STORAGE_GROUPS_COLUMNS,
        requiredColumns,
    );
}
