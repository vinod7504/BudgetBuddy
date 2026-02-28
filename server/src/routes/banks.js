import { Router } from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import {
  AggregatorError,
  discoverBanksByPhone,
  linkBankWithAggregator,
  fetchTransactionsFromAggregator
} from '../lib/bankAggregator.js';

const router = Router();

function monthRange(monthInput, yearInput) {
  const now = new Date();
  const month = Number(monthInput || now.getMonth() + 1);
  const year = Number(yearInput || now.getFullYear());
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  const safeYear = Number.isFinite(year) && year >= 1970 ? year : now.getFullYear();

  const start = new Date(safeYear, safeMonth - 1, 1);
  const end = new Date(safeYear, safeMonth, 1);
  return { month: safeMonth, year: safeYear, start, end };
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatDateInput(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function toMapBy(arr, keySelector) {
  const map = new Map();
  arr.forEach((item) => {
    const key = keySelector(item);
    if (!key) return;
    map.set(key, item);
  });
  return map;
}

function sendError(res, err, fallbackMessage) {
  if (err instanceof AggregatorError) {
    return res.status(err.status || 500).json({
      error: err.message || fallbackMessage,
      code: err.code || 'AGGREGATOR_ERROR',
      details: err.details || null
    });
  }
  console.error(fallbackMessage, err?.message || err);
  return res.status(500).json({ error: fallbackMessage });
}

function analyzeTransactions(transactions, linkedBanks = []) {
  const spendTransactions = transactions.filter((txn) => Number(txn.amount) > 0);
  const totalSpend = round2(spendTransactions.reduce((sum, txn) => sum + Number(txn.amount || 0), 0));

  const byCategoryMap = new Map();
  spendTransactions.forEach((txn) => {
    const key = String(txn.category || 'Others');
    const prev = byCategoryMap.get(key) || { type: key, total: 0, count: 0 };
    prev.total += Number(txn.amount || 0);
    prev.count += 1;
    byCategoryMap.set(key, prev);
  });
  const byCategory = Array.from(byCategoryMap.values())
    .map((row) => ({ ...row, total: round2(row.total) }))
    .sort((a, b) => b.total - a.total);

  const linkedByCode = toMapBy(linkedBanks, (bank) => bank.code);
  const byBankMap = new Map();
  spendTransactions.forEach((txn) => {
    const code = String(txn.bankCode || '').toUpperCase() || 'UNKNOWN';
    const linked = linkedByCode.get(code);
    const bankName = txn.bankName || linked?.name || 'Unknown Bank';
    const accountMask = linked?.accountMask || 'XXXXXX0000';
    const prev = byBankMap.get(code) || {
      code,
      name: bankName,
      accountMask,
      total: 0,
      count: 0
    };
    prev.total += Number(txn.amount || 0);
    prev.count += 1;
    byBankMap.set(code, prev);
  });

  linkedBanks.forEach((bank) => {
    if (!byBankMap.has(bank.code)) {
      byBankMap.set(bank.code, {
        code: bank.code,
        name: bank.name,
        accountMask: bank.accountMask,
        total: 0,
        count: 0
      });
    }
  });

  const byBank = Array.from(byBankMap.values())
    .map((row) => ({
      ...row,
      total: round2(row.total),
      sharePct: totalSpend > 0 ? round2((row.total / totalSpend) * 100) : 0
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalSpend,
    transactionCount: spendTransactions.length,
    byCategory,
    byBank
  };
}

router.use(auth);

router.get('/status', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'phone linkedBanks activeBankCode bankConsentAt onboardingCompletedAt'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const activeBank =
      user.linkedBanks.find((bank) => bank.code === user.activeBankCode) || user.linkedBanks[0] || null;

    return res.json({
      onboardingComplete: Boolean(user.onboardingCompletedAt && user.linkedBanks.length > 0 && user.phone),
      phone: user.phone || '',
      linkedBanks: user.linkedBanks || [],
      activeBank,
      bankConsentAt: user.bankConsentAt || null,
      onboardingCompletedAt: user.onboardingCompletedAt || null
    });
  } catch (err) {
    return sendError(res, err, 'Unable to fetch bank status');
  }
});

router.put('/active', async (req, res) => {
  try {
    const bankCode = String(req.body?.bankCode || '').toUpperCase();
    if (!bankCode) {
      return res.status(400).json({ error: 'bankCode is required' });
    }

    const user = await User.findById(req.user.id).select(
      'phone linkedBanks activeBankCode bankConsentAt onboardingCompletedAt'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const selected = user.linkedBanks.find((bank) => bank.code === bankCode);
    if (!selected) {
      return res.status(400).json({ error: 'This bank is not linked to your account' });
    }

    user.activeBankCode = selected.code;
    user.onboardingCompletedAt = user.onboardingCompletedAt || new Date();
    await user.save();

    return res.json({
      message: 'Active bank updated',
      activeBank: selected,
      linkedBanks: user.linkedBanks
    });
  } catch (err) {
    return sendError(res, err, 'Unable to update active bank');
  }
});

router.get('/options', async (req, res) => {
  try {
    const phone = String(req.query.phone || '').replace(/\D/g, '').slice(-10);
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid 10 digit mobile number' });
    }

    const discovered = await discoverBanksByPhone(phone);
    const discoveryMode = discovered.discoveryMode || 'unknown';
    const message =
      discoveryMode === 'fip-list'
        ? 'Phone-linked account discovery is unavailable in current FIU setup. Showing supported banks list.'
        : '';
    return res.json({
      phone,
      provider: discovered.provider,
      discoveryMode,
      message,
      banks: discovered.banks
    });
  } catch (err) {
    return sendError(res, err, 'Unable to fetch linked banks from aggregator');
  }
});

router.post('/link', async (req, res) => {
  try {
    const { phone, bankCode, permissionGranted } = req.body || {};
    const normalized = String(phone || '').replace(/\D/g, '').slice(-10);

    if (!/^\d{10}$/.test(normalized)) {
      return res.status(400).json({ error: 'Enter a valid 10 digit mobile number' });
    }
    if (!permissionGranted) {
      return res.status(400).json({ error: 'Bank permission is required to continue' });
    }
    if (!bankCode) {
      return res.status(400).json({ error: 'Select a bank' });
    }

    const discovered = await discoverBanksByPhone(normalized);
    const selected = discovered.banks.find((bank) => bank.code === String(bankCode).toUpperCase());
    if (!selected) {
      return res.status(400).json({ error: 'Selected bank is not linked with this number' });
    }

    const linked = await linkBankWithAggregator({
      phone: normalized,
      bankCode: selected.code,
      userRef: req.user.id
    });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.phone = normalized;
    user.bankConsentAt = new Date();
    user.onboardingCompletedAt = new Date();
    user.activeBankCode = linked.code || selected.code;

    const nextBank = {
      code: linked.code || selected.code,
      name: linked.name || selected.name,
      accountMask: linked.accountMask || selected.accountMask,
      linkedAt: new Date(),
      consentId: linked.consentId || '',
      accountRef: linked.accountRef || '',
      providerRef: linked.providerRef || ''
    };

    const existingIdx = user.linkedBanks.findIndex((bank) => bank.code === nextBank.code);
    if (existingIdx >= 0) {
      user.linkedBanks[existingIdx] = nextBank;
    } else {
      user.linkedBanks.push(nextBank);
    }

    await user.save();

    return res.json({
      message: 'Bank linked successfully',
      onboardingComplete: true,
      activeBank: nextBank,
      linkedBanks: user.linkedBanks
    });
  } catch (err) {
    return sendError(res, err, 'Unable to link bank with aggregator');
  }
});

router.get('/analysis', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('phone linkedBanks activeBankCode onboardingCompletedAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.onboardingCompletedAt || user.linkedBanks.length === 0) {
      return res.status(400).json({ error: 'Complete bank onboarding first' });
    }

    const { month, year, start, end } = monthRange(req.query.month, req.query.year);
    const activeBank =
      user.linkedBanks.find((bank) => bank.code === user.activeBankCode) || user.linkedBanks[0] || null;
    if (!activeBank) {
      return res.status(400).json({ error: 'No active linked bank found' });
    }

    const [currData, prevData] = await Promise.all([
      fetchTransactionsFromAggregator({
        phone: user.phone,
        bankCode: activeBank.code,
        fromDate: formatDateInput(start),
        toDate: formatDateInput(new Date(end.getTime() - 24 * 60 * 60 * 1000)),
        userRef: req.user.id
      }),
      (async () => {
        const prevStart = new Date(year, month - 2, 1);
        const prevEnd = new Date(year, month - 1, 1);
        return fetchTransactionsFromAggregator({
          phone: user.phone,
          bankCode: activeBank.code,
          fromDate: formatDateInput(prevStart),
          toDate: formatDateInput(new Date(prevEnd.getTime() - 24 * 60 * 60 * 1000)),
          userRef: req.user.id
        });
      })()
    ]);

    const current = analyzeTransactions(currData.transactions, user.linkedBanks);
    const previous = analyzeTransactions(prevData.transactions, user.linkedBanks);
    const deltaPercent =
      previous.totalSpend > 0 ? round2(((current.totalSpend - previous.totalSpend) / previous.totalSpend) * 100) : null;

    const insights = [];
    if (current.byCategory.length > 0) {
      const top = current.byCategory[0];
      insights.push(`Top spend category is ${top.type} with INR ${top.total.toLocaleString('en-IN')}.`);
    } else {
      insights.push('No debit spend transactions were returned by the aggregator for this period.');
    }
    if (deltaPercent == null) {
      insights.push('No previous month baseline available from aggregator data.');
    } else {
      const dir = deltaPercent >= 0 ? 'higher' : 'lower';
      insights.push(`Spend is ${Math.abs(deltaPercent)}% ${dir} than previous month.`);
    }
    if (current.byBank.length > 0) {
      insights.push(`${current.byBank[0].name} has the highest spend share in this period.`);
    }

    return res.json({
      period: { month, year },
      bankProfile: {
        phone: user.phone,
        activeBank,
        linkedBanks: user.linkedBanks
      },
      totals: {
        spend: current.totalSpend,
        transactions: current.transactionCount,
        previousMonthSpend: previous.totalSpend,
        changePercent: deltaPercent
      },
      byCategory: current.byCategory,
      byBank: current.byBank,
      insights,
      source: `${currData.provider} aggregator`
    });
  } catch (err) {
    return sendError(res, err, 'Unable to generate aggregator analysis');
  }
});

export default router;
