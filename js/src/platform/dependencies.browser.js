// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
// Browser builds bundle the declared codecs; XML uses the browser-native DOM.
import Decimal from 'decimal.js';
import Big from 'big.js';
import * as messagePack from '@msgpack/msgpack';

export const DecimalJS = Decimal;
export const BigJS = Big;
export const msgpack = messagePack;
export const NodeDOMParser = null;
export const NodeXMLSerializer = null;
