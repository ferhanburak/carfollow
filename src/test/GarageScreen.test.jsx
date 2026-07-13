import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { GarageScreen } from "../screens/GarageScreen";
import { createAuthenticatedUser, listQuickProfiles } from "../repositories/cruiserRepository";
import { computeFuelInsights, createFuelForm, createServiceLogForm } from "../utils/garage";
import { buildVehiclePassportSummary, getUpcomingMaintenance } from "../utils/vehiclePassport";

function buildProps(overrides = {}) {
  const user = createAuthenticatedUser(listQuickProfiles()[0]);
  return {
    appId: "cruiser-app-prod",
    firebaseStatus: {
      mode: "mock",
      connection: "disabled",
      authUid: null,
      profile: "idle",
      fuel: "idle",
      service: "idle",
      lastProfileSyncAt: null,
      lastFuelSyncAt: null,
      lastServiceSyncAt: null,
      error: null,
    },
    fuelErrors: {},
    fuelFeedback: "",
    fuelForm: createFuelForm(user.odometer),
    fuelInsights: computeFuelInsights(user.fuelLogs),
    fuelPending: false,
    onCreatePassportExport: vi.fn(),
    onFuelFormChange: vi.fn(),
    onPrimeServiceLogForm: vi.fn(),
    onSubmitFuelLog: vi.fn(),
    onServiceLogFormChange: vi.fn(),
    onSubmitServiceLog: vi.fn(),
    passportExportFeedback: "",
    passportExportPending: false,
    passportExports: [],
    passportSummary: buildVehiclePassportSummary(user),
    serviceLogErrors: {},
    serviceLogFeedback: "",
    serviceLogForm: createServiceLogForm(user),
    serviceLogPending: false,
    upcomingMaintenance: getUpcomingMaintenance(user.parts, user.odometer),
    user,
    ...overrides,
  };
}

describe("GarageScreen", () => {
  it("renders the stable vehicle identity and passport integrity state", () => {
    const props = buildProps();
    render(<GarageScreen {...props} />);

    expect(screen.getAllByText(props.user.primaryVehicleId)).toHaveLength(2);
    expect(screen.getByText("Records Match")).toBeInTheDocument();
    expect(screen.getByText("Resale Passport")).toBeInTheDocument();
    expect(screen.getByText("Backend Export")).toBeInTheDocument();
    expect(screen.getByText("Vehicle Passport Data Ownership")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Service Log Ekle" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Receipt Ekle" })).toBeEnabled();
  });

  it("locks both write forms while Firebase mutations are pending", () => {
    render(<GarageScreen {...buildProps({ fuelPending: true, serviceLogPending: true })} />);

    const pendingButtons = screen.getAllByRole("button", { name: "Kaydediliyor..." });
    expect(pendingButtons).toHaveLength(2);
    pendingButtons.forEach((button) => expect(button).toBeDisabled());
  });
});
