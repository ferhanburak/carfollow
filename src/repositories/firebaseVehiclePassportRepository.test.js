import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const snapshots = new Map();
  const transaction = {
    get: vi.fn((reference) => Promise.resolve(snapshots.get(reference.path))),
    set: vi.fn(),
    update: vi.fn(),
  };

  return {
    getDocs: vi.fn(),
    getFirebaseServices: vi.fn(),
    invokeCallable: vi.fn(),
    runTransaction: vi.fn((_firestore, callback) => callback(transaction)),
    serverTimestamp: vi.fn(() => ({ type: "server-timestamp" })),
    snapshots,
    transaction,
  };
});

vi.mock("../services/firebaseClient", () => ({
  getFirebaseServices: mocks.getFirebaseServices,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_firestore, path) => ({ path })),
  doc: vi.fn((_firestore, path) => ({ path })),
  getDocs: mocks.getDocs,
  query: vi.fn((reference) => reference),
  runTransaction: mocks.runTransaction,
  serverTimestamp: mocks.serverTimestamp,
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn((_functions, name) => (payload) => mocks.invokeCallable(name, payload)),
}));

import {
  cancelFirebaseVehiclePassportTransfer,
  createFirebaseVehiclePassportExport,
  loadFirebaseVehiclePassportExports,
  loadFirebaseVehiclePassportTransferState,
  requestFirebaseVehiclePassportTransfer,
  saveFirebaseFuelLog,
  saveFirebaseServiceLog,
} from "./firebaseVehiclePassportRepository";

const userId = "user-1";
const vehicleId = "vehicle-user-1";
const basePath = `/artifacts/cruiser-app-prod/users/${userId}`;

function snapshot(data = null) {
  return {
    exists: () => data !== null,
    data: () => data,
  };
}

function prepareCoreSnapshots() {
  mocks.snapshots.set(`${basePath}/vehicles/${vehicleId}`, snapshot({
    ownerId: userId,
    vehicleId,
    odometer: 68000,
  }));
  mocks.snapshots.set(`${basePath}/vehiclePassports/${vehicleId}`, snapshot({
    vehicleId,
    serviceLogCount: 2,
    fuelLogCount: 3,
    totalServiceSpend: 5000,
  }));
  mocks.snapshots.set(`${basePath}/profile/current`, snapshot({
    primaryVehicleId: vehicleId,
    odometer: 68000,
  }));
}

beforeEach(() => {
  mocks.snapshots.clear();
  mocks.getDocs.mockReset();
  mocks.invokeCallable.mockReset();
  mocks.transaction.get.mockClear();
  mocks.transaction.set.mockClear();
  mocks.transaction.update.mockClear();
  mocks.runTransaction.mockClear();
  mocks.serverTimestamp.mockClear();
  mocks.getFirebaseServices.mockReset();
  mocks.getFirebaseServices.mockResolvedValue({
    firestore: { id: "firestore" },
    functions: { id: "functions" },
    authUser: { uid: userId },
  });
  mocks.getDocs.mockResolvedValue({ docs: [] });
  prepareCoreSnapshots();
});

describe("Firebase Vehicle Passport repository", () => {
  it("writes a fuel record and passport counters in one transaction", async () => {
    mocks.snapshots.set(`${basePath}/fuelLogs/fuel-1`, snapshot());

    const result = await saveFirebaseFuelLog({
      id: "fuel-1",
      vehicleId,
      liters: 36,
      price: 1848,
      currentKm: 68110,
      station: "OPET Bilkent",
    });

    expect(result).toMatchObject({ vehicleId, duplicate: false, odometer: 68110 });
    expect(mocks.transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: `${basePath}/fuelLogs/fuel-1` }),
      expect.objectContaining({ id: "fuel-1", userId, vehicleId }),
    );
    expect(mocks.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: `${basePath}/vehiclePassports/${vehicleId}` }),
      expect.objectContaining({ fuelLogCount: 4, lastMutationId: "fuel-1", lastMutationType: "fuel" }),
    );
  });

  it("updates the replacement part with the matching service record", async () => {
    mocks.snapshots.set(`${basePath}/serviceLogs/service-1`, snapshot());
    mocks.snapshots.set(`${basePath}/parts/${vehicleId}--oil`, snapshot({ createdAt: "original-created-at" }));

    const result = await saveFirebaseServiceLog(
      {
        id: "service-1",
        vehicleId,
        partKey: "oil",
        type: "replacement",
        serviceDate: "2026-07-13",
        serviceKm: 68420,
        serviceShop: "Apex Garage",
        cost: 2250,
        notes: "Oil and filter changed",
      },
      {
        key: "oil",
        name: "Engine Oil",
        lifeExpectancyKm: 8000,
        lifeExpectancyMonths: 12,
        replacedKm: 68420,
        replacedAt: "2026-07-13",
      },
    );

    expect(result).toMatchObject({ vehicleId, duplicate: false, odometer: 68420 });
    expect(mocks.transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: `${basePath}/parts/${vehicleId}--oil` }),
      expect.objectContaining({
        key: "oil",
        lastServiceLogId: "service-1",
        replacedKm: 68420,
        createdAt: "original-created-at",
      }),
    );
    expect(mocks.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: `${basePath}/vehiclePassports/${vehicleId}` }),
      expect.objectContaining({
        serviceLogCount: 3,
        totalServiceSpend: 7250,
        lastMutationId: "service-1",
      }),
    );
  });

  it("treats a repeated deterministic log id as an idempotent success", async () => {
    mocks.snapshots.set(`${basePath}/fuelLogs/fuel-1`, snapshot({
      id: "fuel-1",
      userId,
      vehicleId,
      liters: 36,
      price: 1848,
      currentKm: 68110,
      station: "OPET Bilkent",
    }));

    const result = await saveFirebaseFuelLog({
      id: "fuel-1",
      vehicleId,
      liters: 36,
      price: 1848,
      currentKm: 68110,
      station: "OPET Bilkent",
    });

    expect(result).toMatchObject({ duplicate: true, odometer: 68000 });
    expect(mocks.transaction.set).not.toHaveBeenCalled();
    expect(mocks.transaction.update).not.toHaveBeenCalled();
  });

  it("rejects a deterministic id collision with different fuel data", async () => {
    mocks.snapshots.set(`${basePath}/fuelLogs/fuel-1`, snapshot({
      id: "fuel-1",
      userId,
      vehicleId,
      liters: 20,
      price: 1000,
      currentKm: 68050,
      station: "Different Station",
    }));

    await expect(saveFirebaseFuelLog({
      id: "fuel-1",
      vehicleId,
      liters: 36,
      price: 1848,
      currentKm: 68110,
      station: "OPET Bilkent",
    })).rejects.toMatchObject({ code: "cruiser/fuel-log-id-conflict" });

    expect(mocks.transaction.set).not.toHaveBeenCalled();
    expect(mocks.transaction.update).not.toHaveBeenCalled();
  });

  it("rejects a deterministic id collision with different service data", async () => {
    mocks.snapshots.set(`${basePath}/serviceLogs/service-1`, snapshot({
      id: "service-1",
      userId,
      vehicleId,
      partKey: "oil",
      type: "inspection",
      serviceDate: "2026-07-13",
      serviceKm: 68000,
      serviceShop: "Apex Garage",
      cost: 500,
      notes: "Inspection",
      receiptImageUrl: "",
    }));

    await expect(saveFirebaseServiceLog({
      id: "service-1",
      vehicleId,
      partKey: "oil",
      type: "repair",
      serviceDate: "2026-07-13",
      serviceKm: 68000,
      serviceShop: "Apex Garage",
      cost: 500,
      notes: "Repair",
      receiptImageUrl: "",
    }, null)).rejects.toMatchObject({ code: "cruiser/service-log-id-conflict" });

    expect(mocks.transaction.set).not.toHaveBeenCalled();
    expect(mocks.transaction.update).not.toHaveBeenCalled();
  });

  it("creates a backend-owned Vehicle Passport export through a callable function", async () => {
    mocks.invokeCallable.mockResolvedValue({
      data: {
        ok: true,
        exportId: "passport-export-1",
        export: { id: "passport-export-1", readinessScore: 88 },
      },
    });

    const result = await createFirebaseVehiclePassportExport();

    expect(mocks.invokeCallable).toHaveBeenCalledWith("createVehiclePassportExport", {});
    expect(result.export.readinessScore).toBe(88);
  });

  it("loads private Vehicle Passport export history newest first", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [
        {
          id: "older",
          data: () => ({ id: "older", generatedAt: { seconds: 10 }, readinessScore: 70 }),
        },
        {
          id: "newer",
          data: () => ({ id: "newer", generatedAt: { seconds: 20 }, readinessScore: 90 }),
        },
      ],
    });

    const exports = await loadFirebaseVehiclePassportExports();

    expect(exports.map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("creates and cancels backend-owned Vehicle Passport transfer requests", async () => {
    mocks.invokeCallable
      .mockResolvedValueOnce({
        data: {
          ok: true,
          transferId: "passport-transfer-1",
          transfer: { id: "passport-transfer-1", status: "pending" },
        },
      })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          transferId: "passport-transfer-1",
          transfer: { id: "passport-transfer-1", status: "cancelled" },
        },
      });

    const requested = await requestFirebaseVehiclePassportTransfer({ targetPlate: "34 MOTO 410" });
    const cancelled = await cancelFirebaseVehiclePassportTransfer({ transferId: "passport-transfer-1" });

    expect(mocks.invokeCallable).toHaveBeenNthCalledWith(1, "requestVehiclePassportTransfer", {
      targetPlate: "34 MOTO 410",
    });
    expect(mocks.invokeCallable).toHaveBeenNthCalledWith(2, "cancelVehiclePassportTransfer", {
      transferId: "passport-transfer-1",
    });
    expect(requested.transfer.status).toBe("pending");
    expect(cancelled.transfer.status).toBe("cancelled");
  });

  it("loads Vehicle Passport transfer and audit history newest first", async () => {
    mocks.getDocs
      .mockResolvedValueOnce({
        docs: [
          { id: "older-transfer", data: () => ({ id: "older-transfer", updatedAt: { seconds: 10 } }) },
          { id: "newer-transfer", data: () => ({ id: "newer-transfer", updatedAt: { seconds: 20 } }) },
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          { id: "older-audit", data: () => ({ id: "older-audit", createdAt: { seconds: 10 } }) },
          { id: "newer-audit", data: () => ({ id: "newer-audit", createdAt: { seconds: 20 } }) },
        ],
      });

    const state = await loadFirebaseVehiclePassportTransferState();

    expect(state.transfers.map((item) => item.id)).toEqual(["newer-transfer", "older-transfer"]);
    expect(state.auditEvents.map((item) => item.id)).toEqual(["newer-audit", "older-audit"]);
  });
});
