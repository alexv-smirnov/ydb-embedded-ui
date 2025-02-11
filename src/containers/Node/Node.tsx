import React from 'react';

import {Tabs} from '@gravity-ui/uikit';
import {Helmet} from 'react-helmet-async';
import {Link, useRouteMatch} from 'react-router-dom';
import {useQueryParams} from 'use-query-params';

import {AutoRefreshControl} from '../../components/AutoRefreshControl/AutoRefreshControl';
import {BasicNodeViewer} from '../../components/BasicNodeViewer';
import {ResponseError} from '../../components/Errors/ResponseError';
import {FullNodeViewer} from '../../components/FullNodeViewer/FullNodeViewer';
import {Loader} from '../../components/Loader';
import routes from '../../routes';
import {
    useCapabilitiesLoaded,
    useDiskPagesAvailable,
} from '../../store/reducers/capabilities/hooks';
import {setHeaderBreadcrumbs} from '../../store/reducers/header/header';
import {nodeApi} from '../../store/reducers/node/node';
import type {AdditionalNodesProps} from '../../types/additionalProps';
import {cn} from '../../utils/cn';
import {useAutoRefreshInterval, useTypedDispatch} from '../../utils/hooks';
import {PaginatedStorage} from '../Storage/PaginatedStorage';
import {Tablets} from '../Tablets';

import type {NodeTab} from './NodePages';
import {
    NODE_PAGES,
    OVERVIEW,
    STORAGE,
    STRUCTURE,
    TABLETS,
    getDefaultNodePath,
    nodePageQueryParams,
} from './NodePages';
import NodeStructure from './NodeStructure/NodeStructure';

import './Node.scss';

const b = cn('node');

const STORAGE_ROLE = 'Storage';

interface NodeProps {
    additionalNodesProps?: AdditionalNodesProps;
    className?: string;
}

export function Node(props: NodeProps) {
    const container = React.useRef<HTMLDivElement>(null);

    const dispatch = useTypedDispatch();

    const match =
        useRouteMatch<{id: string; activeTab: string}>(routes.node) ?? Object.create(null);

    const {id: nodeId, activeTab} = match.params;
    const [{database: tenantNameFromQuery}] = useQueryParams(nodePageQueryParams);

    const [autoRefreshInterval] = useAutoRefreshInterval();
    const {currentData, isFetching, error} = nodeApi.useGetNodeInfoQuery(
        {nodeId},
        {pollingInterval: autoRefreshInterval},
    );
    const loading = isFetching && currentData === undefined;
    const node = currentData;
    const capabilitiesLoaded = useCapabilitiesLoaded();
    const isDiskPagesAvailable = useDiskPagesAvailable();

    const {activeTabVerified, nodeTabs} = React.useMemo(() => {
        const hasStorage = node?.Roles?.find((el) => el === STORAGE_ROLE);

        let nodePages = hasStorage ? NODE_PAGES : NODE_PAGES.filter((el) => el.id !== STORAGE);
        if (isDiskPagesAvailable) {
            nodePages = nodePages.filter((el) => el.id !== STRUCTURE);
        }

        const actualNodeTabs = nodePages.map((page) => {
            return {
                ...page,
                title: page.name,
            };
        });

        let actualActiveTab = actualNodeTabs.find(({id}) => id === activeTab);
        if (!actualActiveTab) {
            actualActiveTab = actualNodeTabs[0];
        }

        return {activeTabVerified: actualActiveTab, nodeTabs: actualNodeTabs};
    }, [activeTab, node, isDiskPagesAvailable]);

    const tenantName = node?.Tenants?.[0] || tenantNameFromQuery?.toString();

    let nodeRole: 'Storage' | 'Compute' | undefined;
    if (node) {
        // Compute nodes have tenantName, storage nodes doesn't
        const isStorage = !node?.Tenants?.[0];
        nodeRole = isStorage ? 'Storage' : 'Compute';
    }

    React.useEffect(() => {
        dispatch(
            setHeaderBreadcrumbs('node', {
                tenantName,
                nodeRole,
                nodeId,
            }),
        );
    }, [dispatch, tenantName, nodeId, nodeRole]);

    const renderTabs = () => {
        return (
            <div className={b('tabs')}>
                <Tabs
                    size="l"
                    items={nodeTabs}
                    activeTab={activeTabVerified.id}
                    wrapTo={({id}, tabNode) => (
                        <Link
                            to={getDefaultNodePath(
                                nodeId,
                                {
                                    database: tenantName,
                                },
                                id as NodeTab,
                            )}
                            key={id}
                            className={b('tab')}
                        >
                            {tabNode}
                        </Link>
                    )}
                    allowNotSelected={true}
                />
                <AutoRefreshControl />
            </div>
        );
    };
    const renderTabContent = () => {
        switch (activeTabVerified.id) {
            case STORAGE: {
                return (
                    <div className={b('storage')} ref={container}>
                        <PaginatedStorage
                            nodeId={nodeId}
                            parentRef={container}
                            viewContext={{
                                nodeId: nodeId?.toString(),
                            }}
                        />
                    </div>
                );
            }
            case TABLETS: {
                return (
                    <Tablets
                        nodeId={nodeId}
                        database={tenantName}
                        className={b('node-page-wrapper')}
                    />
                );
            }

            case STRUCTURE: {
                return <NodeStructure className={b('node-page-wrapper')} nodeId={nodeId} />;
            }
            case OVERVIEW: {
                return <FullNodeViewer node={node} className={b('overview-wrapper')} />;
            }

            default:
                return false;
        }
    };

    if (loading || !capabilitiesLoaded) {
        return <Loader size="l" />;
    }

    if (node) {
        return (
            <div className={b(null, props.className)}>
                <Helmet
                    titleTemplate={`%s — ${node.Host} — YDB Monitoring`}
                    defaultTitle={`${node.Host} — YDB Monitoring`}
                >
                    <title>{activeTabVerified.title}</title>
                </Helmet>

                <BasicNodeViewer
                    node={node}
                    additionalNodesProps={props.additionalNodesProps}
                    className={b('header')}
                />
                {error ? <ResponseError error={error} className={b('error')} /> : null}
                {renderTabs()}
                <div className={b('content')}>{renderTabContent()}</div>
            </div>
        );
    }

    if (error) {
        return <ResponseError error={error} />;
    }

    return <div className="error">no node data</div>;
}
