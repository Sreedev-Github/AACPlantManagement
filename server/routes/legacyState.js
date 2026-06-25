import { Router } from 'express';

import { STATE_DOC_ID, STATE_KEYS } from '../constants.js';
import { collections } from '../db.js';

const router = Router();

const ensureStateDocument = async () => {
  const col = collections().appState;
  const existing = await col.findOne({ _id: STATE_DOC_ID });
  if (existing) return existing;

  const doc = {
    _id: STATE_DOC_ID,
    orders: [],
    dieselEntries: [],
    logs: [],
    rawStock: {},
    finishedStock: {},
    updatedAt: new Date().toISOString(),
  };

  await col.insertOne(doc);
  return doc;
};

const stripMeta = (doc) => {
  const { _id, updatedAt, ...state } = doc;
  return state;
};

const safeNum = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeMonth = (value) => {
  const month = String(value || '').trim();
  return /^\d{4}-\d{2}$/.test(month) ? month : '';
};

const resolveEntryDate = (entry = {}) => {
  const directDate = String(entry.date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(directDate)) {
    return directDate.slice(0, 10);
  }

  const createdAt = String(entry.createdAt || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(createdAt)) {
    return createdAt.slice(0, 10);
  }

  return '';
};

const resolveEntryMonth = (entry = {}) => {
  const date = resolveEntryDate(entry);
  return date ? date.slice(0, 7) : '';
};

const resolveVehicle = (entry = {}) => String(entry.vehicle || entry.name || '').trim().toUpperCase();

const resolveTripValue = (entry = {}, key) => {
  if (key === 'km') {
    return safeNum(entry.km);
  }

  return safeNum(entry.hsd ?? entry.liters);
};

const buildMonthlyDieselReport = (entries = [], month = '') => {
  const normalizedMonth = normalizeMonth(month);
  const monthEntries = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({ ...entry, resolvedDate: resolveEntryDate(entry), resolvedMonth: resolveEntryMonth(entry), resolvedVehicle: resolveVehicle(entry) }))
    .filter((entry) => entry.resolvedMonth === normalizedMonth && entry.resolvedVehicle && String(entry.flowType || '').toLowerCase() !== 'inflow');

  const byVehicle = new Map();

  for (const entry of monthEntries) {
    const key = entry.resolvedVehicle;
    if (!byVehicle.has(key)) {
      byVehicle.set(key, {
        vehicleNumber: key,
        kilometers: 0,
        dieselUsed: 0,
        tripCount: 0,
        trips: [],
      });
    }

    const summary = byVehicle.get(key);
    const trip = {
      id: entry.id,
      date: entry.resolvedDate || entry.date || '',
      vehicle: key,
      location: String(entry.location || '').trim(),
      driver: String(entry.driver || '').trim(),
      purpose: String(entry.purpose || '').trim(),
      km: resolveTripValue(entry, 'km'),
      dieselUsed: resolveTripValue(entry, 'hsd'),
      invoiceNumber: String(entry.invoiceNumber || '').trim(),
      createdAt: String(entry.createdAt || '').trim(),
    };

    summary.kilometers += trip.km;
    summary.dieselUsed += trip.dieselUsed;
    summary.tripCount += 1;
    summary.trips.push(trip);
  }

  const vehicles = Array.from(byVehicle.values())
    .map((vehicle) => ({
      ...vehicle,
      kilometers: Number(vehicle.kilometers.toFixed(2)),
      dieselUsed: Number(vehicle.dieselUsed.toFixed(2)),
      trips: vehicle.trips
        .slice()
        .sort((left, right) => String(left.date || '').localeCompare(String(right.date || '')) || String(left.createdAt || '').localeCompare(String(right.createdAt || '')))
        .map((trip) => ({
          ...trip,
          km: Number(trip.km.toFixed(2)),
          dieselUsed: Number(trip.dieselUsed.toFixed(2)),
        })),
    }))
    .sort((left, right) => left.vehicleNumber.localeCompare(right.vehicleNumber, undefined, { numeric: true, sensitivity: 'base' }));

  const totals = vehicles.reduce((accumulator, vehicle) => ({
    kilometers: accumulator.kilometers + vehicle.kilometers,
    dieselUsed: accumulator.dieselUsed + vehicle.dieselUsed,
    tripCount: accumulator.tripCount + vehicle.tripCount,
  }), { kilometers: 0, dieselUsed: 0, tripCount: 0 });

  return {
    month: normalizedMonth,
    totals: {
      kilometers: Number(totals.kilometers.toFixed(2)),
      dieselUsed: Number(totals.dieselUsed.toFixed(2)),
      tripCount: totals.tripCount,
      vehicleCount: vehicles.length,
    },
    vehicles: vehicles.map(({ trips, ...vehicle }) => vehicle),
  };
};

const buildVehicleDieselTrips = (entries = [], month = '', vehicleNumber = '') => {
  const normalizedMonth = normalizeMonth(month);
  const normalizedVehicle = String(vehicleNumber || '').trim().toUpperCase();

  const trips = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({ ...entry, resolvedDate: resolveEntryDate(entry), resolvedMonth: resolveEntryMonth(entry), resolvedVehicle: resolveVehicle(entry) }))
    .filter((entry) => entry.resolvedMonth === normalizedMonth && entry.resolvedVehicle === normalizedVehicle && String(entry.flowType || '').toLowerCase() !== 'inflow')
    .sort((left, right) => String(left.resolvedDate || '').localeCompare(String(right.resolvedDate || '')) || String(left.createdAt || '').localeCompare(String(right.createdAt || '')))
    .map((entry) => ({
      id: entry.id,
      date: entry.resolvedDate || entry.date || '',
      vehicle: entry.resolvedVehicle,
      location: String(entry.location || '').trim(),
      driver: String(entry.driver || '').trim(),
      purpose: String(entry.purpose || '').trim(),
      km: Number(resolveTripValue(entry, 'km').toFixed(2)),
      dieselUsed: Number(resolveTripValue(entry, 'hsd').toFixed(2)),
      invoiceNumber: String(entry.invoiceNumber || '').trim(),
      createdAt: String(entry.createdAt || '').trim(),
    }));

  const totals = trips.reduce((accumulator, trip) => ({
    kilometers: accumulator.kilometers + trip.km,
    dieselUsed: accumulator.dieselUsed + trip.dieselUsed,
  }), { kilometers: 0, dieselUsed: 0 });

  return {
    month: normalizedMonth,
    vehicleNumber: normalizedVehicle,
    totals: {
      kilometers: Number(totals.kilometers.toFixed(2)),
      dieselUsed: Number(totals.dieselUsed.toFixed(2)),
      tripCount: trips.length,
    },
    trips,
  };
};

router.get('/state', async (_req, res) => {
  try {
    const stateDoc = await ensureStateDocument();
    res.json(stripMeta(stateDoc));
  } catch (error) {
    res.status(500).json({ message: 'Failed to load state', error: error.message });
  }
});

router.put('/state/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!STATE_KEYS.includes(key)) {
      return res.status(400).json({ message: `Invalid state key: ${key}` });
    }

    await ensureStateDocument();

    await collections().appState.updateOne(
      { _id: STATE_DOC_ID },
      {
        $set: {
          [key]: req.body?.value,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update state', error: error.message });
  }
});

router.get('/diesel/monthly-report', async (req, res) => {
  try {
    const month = normalizeMonth(req.query.month);
    if (!month) {
      return res.status(400).json({ message: 'A valid month in YYYY-MM format is required.' });
    }

    const stateDoc = await ensureStateDocument();
    const report = buildMonthlyDieselReport(stateDoc.dieselEntries || [], month);
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load diesel monthly report', error: error.message });
  }
});

router.get('/diesel/monthly-report/:month/vehicles/:vehicleNumber', async (req, res) => {
  try {
    const month = normalizeMonth(req.params.month);
    const vehicleNumber = String(req.params.vehicleNumber || '').trim();

    if (!month) {
      return res.status(400).json({ message: 'A valid month in YYYY-MM format is required.' });
    }

    if (!vehicleNumber) {
      return res.status(400).json({ message: 'Vehicle number is required.' });
    }

    const stateDoc = await ensureStateDocument();
    const report = buildVehicleDieselTrips(stateDoc.dieselEntries || [], month, vehicleNumber);
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load vehicle diesel trips', error: error.message });
  }
});

export default router;
