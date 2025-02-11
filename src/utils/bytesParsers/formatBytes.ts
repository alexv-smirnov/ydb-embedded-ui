import {GIGABYTE, KILOBYTE, MEGABYTE, TERABYTE} from '../constants';
import type {FormatToSizeArgs, FormatValuesArgs} from '../dataFormatters/common';
import {formatNumber, roundToPrecision} from '../dataFormatters/dataFormatters';
import {UNBREAKABLE_GAP, isNumeric} from '../utils';

import i18n from './i18n';

const sizes = {
    b: {
        value: 1,
        label: i18n('b'),
    },
    kb: {
        value: KILOBYTE,
        label: i18n('kb'),
    },
    mb: {
        value: MEGABYTE,
        label: i18n('mb'),
    },
    gb: {
        value: GIGABYTE,
        label: i18n('gb'),
    },
    tb: {
        value: TERABYTE,
        label: i18n('tb'),
    },
};

export type BytesSizes = keyof typeof sizes;

/**
 * This function is needed to keep more than 3 digits of the same size.
 *
 * @param significantDigits - number of digits above 3
 * @returns size to format value to get required number of digits
 *
 * By default value converted to the next size when it's above 1000,
 * so we have 900mb and 1gb. To extend it additional significantDigits could be set
 *
 * significantDigits value added above default 3
 *
 * significantDigits = 1 - 9 000 mb and 10 gb
 *
 * significantDigits = 2 - 90 000 mb and 100 gb
 *
 * significantDigits = 3 - 900 000 mb and 1000 gb
 */
export const getSizeWithSignificantDigits = (value: number, significantDigits: number) => {
    const multiplier = 10 ** significantDigits;

    const tbLevel = sizes.tb.value * multiplier;
    const gbLevel = sizes.gb.value * multiplier;
    const mbLevel = sizes.mb.value * multiplier;
    const kbLevel = sizes.kb.value * multiplier;

    let size: BytesSizes = 'b';

    if (value >= kbLevel) {
        size = 'kb';
    }
    if (value >= mbLevel) {
        size = 'mb';
    }
    if (value >= gbLevel) {
        size = 'gb';
    }
    if (value >= tbLevel) {
        size = 'tb';
    }

    return size;
};

const formatToSize = ({value, size = 'mb', precision = 0}: FormatToSizeArgs<BytesSizes>) => {
    const result = roundToPrecision(Number(value) / sizes[size].value, precision);

    return formatNumber(result);
};

const addSizeLabel = (result: string, size: BytesSizes, delimiter = UNBREAKABLE_GAP) => {
    return result + delimiter + sizes[size].label;
};

const addSpeedLabel = (result: string, size: BytesSizes) => {
    return addSizeLabel(result, size) + i18n('perSecond');
};

/**
 * @param significantDigits - number of digits above 3
 */
export const formatBytes = ({
    value,
    size,
    withSpeedLabel = false,
    withSizeLabel = true,
    significantDigits = 0,
    delimiter,
    ...params
}: FormatValuesArgs<BytesSizes>) => {
    if (!isNumeric(value)) {
        return '';
    }

    const numValue = Number(value);

    const sizeToConvert = size ?? getSizeWithSignificantDigits(numValue, significantDigits);

    const result = formatToSize({value: numValue, size: sizeToConvert, ...params});

    if (withSpeedLabel) {
        return addSpeedLabel(result, sizeToConvert);
    }

    if (withSizeLabel) {
        return addSizeLabel(result, sizeToConvert, delimiter);
    }

    return result;
};
