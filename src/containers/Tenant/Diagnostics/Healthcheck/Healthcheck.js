import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import cn from 'bem-cn-lite';

import {Loader, Button} from '@gravity-ui/uikit';

import IssuesViewer from './IssuesViewer/IssuesViewer';

import {getHealthcheckInfo} from '../../../../store/reducers/healthcheckInfo';
import {hideTooltip, showTooltip} from '../../../../store/reducers/tooltip';
import {AutoFetcher} from '../../../../utils/autofetcher';

import i18n from './i18n';
import './Healthcheck.scss';

const b = cn('healthcheck');

class Healthcheck extends React.Component {
    static propTypes = {
        data: PropTypes.object,
        loading: PropTypes.bool,
        wasLoaded: PropTypes.bool,
        error: PropTypes.object,
        getHealthcheckInfo: PropTypes.func,
        tenant: PropTypes.string,
        preview: PropTypes.bool,
        showMoreHandler: PropTypes.func,
    };

    autofetcher;

    componentDidMount() {
        this.autofetcher = new AutoFetcher();
        this.fetchHealthcheck();
        if (this.props.autorefresh) {
            this.autofetcher.start();
            this.autofetcher.fetch(() => this.fetchHealthcheck());
        }
    }

    componentDidUpdate(prevProps) {
        const {autorefresh} = this.props;

        if (autorefresh && !prevProps.autorefresh) {
            this.fetchHealthcheck();
            this.autofetcher.stop();
            this.autofetcher.start();
            this.autofetcher.fetch(() => this.fetchHealthcheck());
        }
        if (!autorefresh && prevProps.autorefresh) {
            this.autofetcher.stop();
        }
    }

    componentWillUnmount() {
        this.autofetcher.stop();
    }

    fetchHealthcheck = () => {
        const {tenant, getHealthcheckInfo} = this.props;
        getHealthcheckInfo(tenant);
    };

    renderLoader() {
        return (
            <div className={b('loader')}>
                <Loader size="m" />
            </div>
        );
    }

    renderUpdateButton() {
        const {loading} = this.props;
        return (
            <Button size="s" onClick={this.fetchHealthcheck} loading={loading}>
                {i18n('label.update')}
            </Button>
        );
    }

    renderPreview = () => {
        const {data, showMoreHandler} = this.props;
        const {self_check_result: selfCheckResult} = data;
        const modifier = selfCheckResult.toLowerCase();

        const statusOk = selfCheckResult === 'GOOD';
        const text = statusOk
            ? i18n('status_message.ok')
            : i18n('status_message.error');

        return (
            <div>
                <div className={b('status-wrapper')}>
                    <div className={b('preview-title')}>{i18n('title.healthcheck')}</div>
                    <div className={b('self-check-status-indicator', {[modifier]: true})}>
                        {statusOk ? i18n('ok') : i18n('error')}
                    </div>
                    {this.renderUpdateButton()}
                </div>
                <div className={b('preview-content')}>
                    {text}
                    {!statusOk && (
                        <Button
                            view="flat-info"
                            onClick={showMoreHandler}
                            size="s"
                        >
                            {i18n('label.show-details')}
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    renderOverviewStatus = () => {
        const {data} = this.props;
        const {self_check_result: selfCheckResult} = data;
        const modifier = selfCheckResult.toLowerCase();

        return (
            <div className={b('self-check-status')}>
                <h3 className={b('self-check-status-label')}>{i18n('title.self-check-status')}</h3>
                <div className={b('self-check-status-indicator', {[modifier]: true})} />
                {selfCheckResult}
                <div className={b('self-check-update')}>{this.renderUpdateButton()}</div>
            </div>
        );
    };

    renderHealthcheckIssues() {
        const {data, showTooltip, hideTooltip} = this.props;
        const {issue_log: issueLog} = data;

        if (!issueLog) {
            return null;
        }

        return (
            <div className={b('issues')}>
                <h3>{i18n('title.issues')}</h3>
                <IssuesViewer
                    issues={issueLog}
                    showTooltip={showTooltip}
                    hideTooltip={hideTooltip}
                />
            </div>
        );
    }

    renderContent = () => {
        const {preview} = this.props;
        return preview ? (
            this.renderPreview()
        ) : (
            <div className={b()}>
                {this.renderOverviewStatus()}
                {this.renderHealthcheckIssues()}
            </div>
        );
    };

    render() {
        const {error, data, loading, wasLoaded} = this.props;

        if (error) {
            return <div>{error.statusText}</div>;
        } else if (data && data['self_check_result']) {
            return this.renderContent();
        } else if (loading && !wasLoaded) {
            return this.renderLoader();
        } else return <div className="error">{i18n('no-data')}</div>;
    }
}

function mapStateToProps(state) {
    const {data, loading, wasLoaded, error} = state.healthcheckInfo;
    const {autorefresh} = state.schema;

    return {
        data,
        loading,
        wasLoaded,
        error,
        autorefresh,
    };
}

const mapDispatchToProps = {
    getHealthcheckInfo,
    hideTooltip,
    showTooltip,
};

export default connect(mapStateToProps, mapDispatchToProps)(Healthcheck);
