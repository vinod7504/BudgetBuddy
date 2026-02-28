const DEFAULT_TIMEOUT = Number(process.env.BANK_AGGREGATOR_TIMEOUT_MS || 20000);

export class AggregatorError extends Error {
  constructor(message, { status = 500, code = 'AGGREGATOR_ERROR', details = null } = {}) {
    super(message);
    this.name = 'AggregatorError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function providerName() {
  return String(process.env.BANK_AGGREGATOR_PROVIDER || 'SETU').trim().toUpperCase();
}

function sanitizePhone(input) {
  return String(input || '').replace(/\D/g, '').slice(-10);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function isRouteNotFound(err) {
  if (!(err instanceof AggregatorError)) return false;
  const message = String(err?.details?.upstreamMessage || err?.message || '').toLowerCase();
  return err.status === 404 || message.includes('route not found');
}

function pickFirstArray(...candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }
  return [];
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function toReadableMessage(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((item) => toReadableMessage(item)).filter(Boolean);
    return parts.join(', ');
  }
  if (typeof value === 'object') {
    const nested = firstDefined(
      value?.message,
      value?.error_description,
      value?.error,
      value?.title,
      value?.detail,
      value?.reason
    );
    if (nested !== null && nested !== undefined && nested !== value) {
      const text = toReadableMessage(nested);
      if (text) return text;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function joinUrl(base, path) {
  if (!base) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const a = base.endsWith('/') ? base.slice(0, -1) : base;
  const b = path.startsWith('/') ? path : `/${path}`;
  return `${a}${b}`;
}

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function httpRequest({
  url,
  method = 'GET',
  headers = {},
  query = null,
  body = null,
  timeoutMs = DEFAULT_TIMEOUT
}) {
  const target = new URL(url);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') target.searchParams.set(key, String(val));
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const data = await parseJsonSafe(response);
    if (!response.ok) {
      const remoteMessage = toReadableMessage(firstDefined(
        data?.message,
        data?.error_description,
        data?.error?.message,
        data?.error,
        data?.title,
        data?.raw
      ));
      const baseMessage = remoteMessage
        ? `Aggregator request failed: ${remoteMessage}`
        : `Aggregator request failed (HTTP ${response.status})`;
      throw new AggregatorError(baseMessage, {
        status: response.status,
        code: 'AGGREGATOR_HTTP_ERROR',
        details: {
          url: target.toString(),
          method,
          upstreamStatus: response.status,
          upstreamMessage: remoteMessage || '',
          upstreamBody: data
        }
      });
    }
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new AggregatorError('Aggregator request timed out', {
        status: 504,
        code: 'AGGREGATOR_TIMEOUT'
      });
    }
    if (err instanceof AggregatorError) throw err;
    throw new AggregatorError(err?.message || 'Aggregator request error', {
      status: 502,
      code: 'AGGREGATOR_REQUEST_FAILED'
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeBankCode(name) {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
}

function maskFromLast4(last4) {
  const clean = String(last4 || '').replace(/\D/g, '').slice(-4);
  return clean ? `XXXXXX${clean}` : 'XXXXXX0000';
}

function normalizeBanks(payload) {
  const rows = pickFirstArray(
    payload?.banks,
    payload?.linkedBanks,
    payload?.data?.banks,
    payload?.data?.linkedBanks
  );

  const sourceRows = rows.length
    ? rows
    : pickFirstArray(payload?.accounts, payload?.data?.accounts, payload?.data);

  const output = [];
  const seen = new Set();

  sourceRows.forEach((row) => {
    const name = firstDefined(
      row?.name,
      row?.bankName,
      row?.bank_name,
      row?.displayName,
      row?.institutionName,
      row?.institution_name,
      row?.fipName,
      row?.fip_name
    );
    const codeRaw = firstDefined(
      row?.code,
      row?.bankCode,
      row?.bank_code,
      row?.id,
      row?.fipId,
      row?.fip_id,
      name
    );
    const code = normalizeBankCode(codeRaw);
    if (!code || !name) return;
    if (seen.has(code)) return;
    seen.add(code);

    const accountMask = firstDefined(
      row?.accountMask,
      row?.maskedAccountNumber,
      row?.maskedAccount,
      row?.mask,
      row?.account_number_mask
    );
    const last4 = firstDefined(row?.last4, row?.accountLast4, row?.account_last4);

    output.push({
      code,
      name: String(name),
      accountMask: accountMask ? String(accountMask) : maskFromLast4(last4),
      meta: row
    });
  });

  return output;
}

function normalizeLinkedBankResult(payload, fallback) {
  const bankName = firstDefined(
    payload?.bankName,
    payload?.bank_name,
    payload?.name,
    payload?.data?.bankName,
    payload?.data?.name,
    fallback?.name
  );
  const bankCode = normalizeBankCode(
    firstDefined(
      payload?.bankCode,
      payload?.bank_code,
      payload?.code,
      payload?.data?.bankCode,
      payload?.data?.code,
      fallback?.code
    )
  );
  const accountMask = firstDefined(
    payload?.accountMask,
    payload?.maskedAccountNumber,
    payload?.data?.accountMask,
    fallback?.accountMask
  );

  return {
    code: bankCode || fallback?.code || '',
    name: bankName || fallback?.name || '',
    accountMask: accountMask || fallback?.accountMask || 'XXXXXX0000',
    consentId: firstDefined(payload?.consentId, payload?.consent_id, payload?.data?.consentId),
    accountRef: firstDefined(payload?.accountRef, payload?.account_ref, payload?.data?.accountRef),
    providerRef: firstDefined(
      payload?.referenceId,
      payload?.reference_id,
      payload?.requestId,
      payload?.request_id,
      payload?.data?.referenceId
    ),
    raw: payload
  };
}

function inferCategory(rawCategory, rawNarration) {
  if (rawCategory) return String(rawCategory);
  const text = String(rawNarration || '').toLowerCase();
  if (/rent|landlord|lease/.test(text)) return 'Rent';
  if (/grocery|restaurant|food|zomato|swiggy/.test(text)) return 'Food';
  if (/electric|water|utility|gas|internet|mobile bill/.test(text)) return 'Utilities';
  if (/pharmacy|medicine|hospital|clinic/.test(text)) return 'Medicine';
  if (/saving|deposit|investment|fd|rd|mutual/.test(text)) return 'Savings';
  return 'Others';
}

function normalizeTransactions(payload) {
  const rows =
    toArray(payload?.transactions).length
      ? payload.transactions
      : toArray(payload?.data?.transactions).length
        ? payload.data.transactions
        : toArray(payload?.items).length
          ? payload.items
          : toArray(payload?.data?.items);

  return rows
    .map((row) => {
      const amountRaw = firstDefined(row?.amount, row?.txnAmount, row?.value, row?.transactionAmount);
      const amountNum = Number(amountRaw);
      if (!Number.isFinite(amountNum)) return null;

      const direction = String(
        firstDefined(row?.direction, row?.type, row?.txnType, row?.transactionType, 'DEBIT')
      ).toUpperCase();
      const signedAmount = direction.includes('CREDIT') ? -Math.abs(amountNum) : Math.abs(amountNum);
      const spendAmount = signedAmount > 0 ? signedAmount : 0;

      const dateRaw = firstDefined(
        row?.date,
        row?.txnDate,
        row?.transactionDate,
        row?.postedAt,
        row?.timestamp
      );
      const parsedDate = dateRaw ? new Date(dateRaw) : new Date();

      const bankCode = normalizeBankCode(firstDefined(row?.bankCode, row?.bank_code, row?.fipId, row?.bankName));
      const bankName = firstDefined(row?.bankName, row?.bank_name, row?.fipName, row?.institutionName);
      const narration = firstDefined(row?.narration, row?.description, row?.merchantName, row?.remarks, '');
      const category = inferCategory(
        firstDefined(row?.category, row?.categoryName, row?.spendCategory),
        narration
      );

      return {
        id: String(firstDefined(row?.id, row?.txnId, row?.transactionId, `${parsedDate.getTime()}-${amountNum}`)),
        amount: Number(spendAmount.toFixed(2)),
        date: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
        bankCode,
        bankName: bankName ? String(bankName) : '',
        category,
        narration: String(narration || '')
      };
    })
    .filter(Boolean);
}

const tokenCache = {
  token: '',
  expiresAt: 0
};

function setuBaseUrl() {
  return process.env.SETU_BASE_URL || process.env.BANK_AGGREGATOR_BASE_URL || '';
}

async function setuToken() {
  const useOauth = String(process.env.SETU_USE_OAUTH || 'false').toLowerCase() === 'true';
  if (!useOauth) return '';

  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt) return tokenCache.token;

  const clientId = process.env.SETU_CLIENT_ID;
  const secret = process.env.SETU_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new AggregatorError('SETU_CLIENT_ID and SETU_CLIENT_SECRET are required', {
      status: 500,
      code: 'AGGREGATOR_CONFIG_ERROR'
    });
  }

  const oauthUrl = process.env.SETU_OAUTH_URL || 'https://accountservice.setu.co/v1/users/login';
  const clientHeader = process.env.SETU_OAUTH_CLIENT || 'bridge';
  const data = await httpRequest({
    url: oauthUrl,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      client: clientHeader
    },
    body: {
      clientID: clientId,
      secret,
      grant_type: 'client_credentials'
    }
  });

  const accessToken = firstDefined(data?.access_token, data?.token, data?.data?.access_token);
  if (!accessToken) {
    throw new AggregatorError('Failed to fetch Setu access token', {
      status: 502,
      code: 'AGGREGATOR_AUTH_ERROR',
      details: data
    });
  }

  const expiresInSec = Number(firstDefined(data?.expires_in, data?.expiresIn, data?.data?.expires_in) || 300);
  tokenCache.token = String(accessToken);
  tokenCache.expiresAt = now + Math.max(30, expiresInSec - 15) * 1000;
  return tokenCache.token;
}

async function setuHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (process.env.SETU_CLIENT_ID) headers['x-client-id'] = process.env.SETU_CLIENT_ID;
  if (process.env.SETU_CLIENT_SECRET) headers['x-client-secret'] = process.env.SETU_CLIENT_SECRET;
  if (process.env.SETU_PRODUCT_INSTANCE_ID) {
    headers['x-product-instance-id'] = process.env.SETU_PRODUCT_INSTANCE_ID;
  }

  const token = await setuToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function setuRequest(path, { method = 'GET', body = null, query = null } = {}) {
  const base = setuBaseUrl();
  if (!base) {
    throw new AggregatorError('SETU_BASE_URL is required for Setu provider', {
      status: 500,
      code: 'AGGREGATOR_CONFIG_ERROR'
    });
  }
  return httpRequest({
    url: joinUrl(base, path),
    method,
    headers: await setuHeaders(),
    body,
    query
  });
}

function customBaseUrl() {
  return process.env.BANK_AGGREGATOR_BASE_URL || '';
}

function customHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  const apiKey = process.env.BANK_AGGREGATOR_API_KEY;
  if (apiKey) {
    const headerName = process.env.BANK_AGGREGATOR_API_KEY_HEADER || 'Authorization';
    const prefix = process.env.BANK_AGGREGATOR_API_KEY_PREFIX || 'Bearer';
    headers[headerName] = prefix ? `${prefix} ${apiKey}` : apiKey;
  }
  return headers;
}

async function customRequest(path, { method = 'GET', body = null, query = null } = {}) {
  const base = customBaseUrl();
  if (!base) {
    throw new AggregatorError('BANK_AGGREGATOR_BASE_URL is required', {
      status: 500,
      code: 'AGGREGATOR_CONFIG_ERROR'
    });
  }
  return httpRequest({
    url: joinUrl(base, path),
    method,
    headers: customHeaders(),
    body,
    query
  });
}

function requirePath(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new AggregatorError(`${name} is required`, {
      status: 500,
      code: 'AGGREGATOR_CONFIG_ERROR'
    });
  }
  return value;
}

async function discoverWithSetu(phone) {
  const availabilityPath = process.env.SETU_ACCOUNT_AVAILABILITY_PATH || '';
  const availabilityPayloadKey = process.env.BANK_AGGREGATOR_PHONE_FIELD || 'mobileNumber';

  let availability = null;
  if (availabilityPath) {
    try {
      availability = await setuRequest(availabilityPath, {
        method: 'POST',
        body: { [availabilityPayloadKey]: phone }
      });
    } catch (err) {
      if (!isRouteNotFound(err)) throw err;
      // Ignore old/unavailable route and continue with discovery fallback.
      availability = { skipped: true };
    }
  }

  const discoveryPath = String(process.env.SETU_PHONE_DISCOVERY_PATH || '').trim();
  if (discoveryPath) {
    try {
      const discovered = await setuRequest(discoveryPath, {
        method: process.env.BANK_AGGREGATOR_DISCOVER_METHOD || 'POST',
        body: { [availabilityPayloadKey]: phone }
      });
      const banks = normalizeBanks(discovered);
      if (banks.length > 0) {
        return { provider: 'SETU', banks, raw: discovered };
      }
    } catch (err) {
      if (!isRouteNotFound(err)) throw err;
      // If configured discovery route is invalid, fallback to FIP list endpoint.
    }
  }

  // Fallback: Setu Active FIP API (documented endpoint) to show selectable banks.
  let fipData;
  try {
    fipData = await setuRequest('/v2/fips', { method: 'GET' });
  } catch (err) {
    if (!isRouteNotFound(err)) throw err;
    fipData = await setuRequest('/api/v2/fips', { method: 'GET' });
  }
  const banks = normalizeBanks(fipData);
  return { provider: 'SETU', banks, raw: { availability, discoveryFallback: '/v2/fips', fipData } };
}

async function discoverWithCustom(phone) {
  const path = requirePath('BANK_AGGREGATOR_DISCOVER_PATH');
  const method = process.env.BANK_AGGREGATOR_DISCOVER_METHOD || 'POST';
  const phoneField = process.env.BANK_AGGREGATOR_PHONE_FIELD || 'mobileNumber';
  const data = await customRequest(path, {
    method,
    body: { [phoneField]: phone }
  });
  return { provider: 'CUSTOM_HTTP', banks: normalizeBanks(data), raw: data };
}

async function linkWithSetu({ phone, bankCode, userRef }) {
  const path = requirePath('SETU_LINK_PATH');
  const method = process.env.BANK_AGGREGATOR_LINK_METHOD || 'POST';
  const phoneField = process.env.BANK_AGGREGATOR_PHONE_FIELD || 'mobileNumber';
  const bankField = process.env.BANK_AGGREGATOR_BANK_CODE_FIELD || 'bankCode';
  const userRefField = process.env.BANK_AGGREGATOR_USER_REF_FIELD || 'userRef';

  const data = await setuRequest(path, {
    method,
    body: {
      [phoneField]: phone,
      [bankField]: bankCode,
      [userRefField]: userRef
    }
  });
  return normalizeLinkedBankResult(data, { code: bankCode });
}

async function linkWithCustom({ phone, bankCode, userRef }) {
  const path = requirePath('BANK_AGGREGATOR_LINK_PATH');
  const method = process.env.BANK_AGGREGATOR_LINK_METHOD || 'POST';
  const phoneField = process.env.BANK_AGGREGATOR_PHONE_FIELD || 'mobileNumber';
  const bankField = process.env.BANK_AGGREGATOR_BANK_CODE_FIELD || 'bankCode';
  const userRefField = process.env.BANK_AGGREGATOR_USER_REF_FIELD || 'userRef';

  const data = await customRequest(path, {
    method,
    body: {
      [phoneField]: phone,
      [bankField]: bankCode,
      [userRefField]: userRef
    }
  });
  return normalizeLinkedBankResult(data, { code: bankCode });
}

async function transactionsWithSetu({ phone, bankCode, fromDate, toDate, userRef }) {
  const path = requirePath('SETU_TRANSACTIONS_PATH');
  const method = process.env.BANK_AGGREGATOR_TRANSACTIONS_METHOD || 'POST';
  const phoneField = process.env.BANK_AGGREGATOR_PHONE_FIELD || 'mobileNumber';
  const bankField = process.env.BANK_AGGREGATOR_BANK_CODE_FIELD || 'bankCode';
  const fromField = process.env.BANK_AGGREGATOR_FROM_FIELD || 'fromDate';
  const toField = process.env.BANK_AGGREGATOR_TO_FIELD || 'toDate';
  const userRefField = process.env.BANK_AGGREGATOR_USER_REF_FIELD || 'userRef';

  const data = await setuRequest(path, {
    method,
    body: {
      [phoneField]: phone,
      [bankField]: bankCode,
      [fromField]: fromDate,
      [toField]: toDate,
      [userRefField]: userRef
    }
  });
  return { provider: 'SETU', transactions: normalizeTransactions(data), raw: data };
}

async function transactionsWithCustom({ phone, bankCode, fromDate, toDate, userRef }) {
  const path = requirePath('BANK_AGGREGATOR_TRANSACTIONS_PATH');
  const method = process.env.BANK_AGGREGATOR_TRANSACTIONS_METHOD || 'POST';
  const phoneField = process.env.BANK_AGGREGATOR_PHONE_FIELD || 'mobileNumber';
  const bankField = process.env.BANK_AGGREGATOR_BANK_CODE_FIELD || 'bankCode';
  const fromField = process.env.BANK_AGGREGATOR_FROM_FIELD || 'fromDate';
  const toField = process.env.BANK_AGGREGATOR_TO_FIELD || 'toDate';
  const userRefField = process.env.BANK_AGGREGATOR_USER_REF_FIELD || 'userRef';

  const data = await customRequest(path, {
    method,
    body: {
      [phoneField]: phone,
      [bankField]: bankCode,
      [fromField]: fromDate,
      [toField]: toDate,
      [userRefField]: userRef
    }
  });
  return { provider: 'CUSTOM_HTTP', transactions: normalizeTransactions(data), raw: data };
}

export async function discoverBanksByPhone(rawPhone) {
  const phone = sanitizePhone(rawPhone);
  if (!/^\d{10}$/.test(phone)) {
    throw new AggregatorError('Enter a valid 10 digit mobile number', {
      status: 400,
      code: 'INVALID_PHONE'
    });
  }

  if (providerName() === 'SETU') return discoverWithSetu(phone);
  return discoverWithCustom(phone);
}

export async function linkBankWithAggregator({ phone, bankCode, userRef }) {
  if (!bankCode) {
    throw new AggregatorError('Bank code is required', {
      status: 400,
      code: 'INVALID_BANK'
    });
  }
  if (providerName() === 'SETU') return linkWithSetu({ phone, bankCode, userRef });
  return linkWithCustom({ phone, bankCode, userRef });
}

export async function fetchTransactionsFromAggregator({ phone, bankCode, fromDate, toDate, userRef }) {
  if (providerName() === 'SETU') {
    return transactionsWithSetu({ phone, bankCode, fromDate, toDate, userRef });
  }
  return transactionsWithCustom({ phone, bankCode, fromDate, toDate, userRef });
}
