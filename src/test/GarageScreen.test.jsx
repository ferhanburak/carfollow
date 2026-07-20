import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { GarageScreen } from "../screens/GarageScreen";
import { createAuthenticatedUser, listQuickProfiles } from "../repositories/cruiserRepository";
import { computeFuelInsights, createFuelForm, createServiceLogForm } from "../utils/garage";
import { buildVehiclePassportSummary, getUpcomingMaintenance } from "../utils/vehiclePassport";

function buildProps(overrides = {}) {
  const user = createAuthenticatedUser(listQuickProfiles()[0]);
  return {
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
  it("renders vehicle history without exposing internal identifiers", () => {
    const props = buildProps();
    render(<GarageScreen {...props} />);

    expect(screen.queryByText(props.user.primaryVehicleId)).not.toBeInTheDocument();
    expect(screen.getByText("Records Match")).toBeInTheDocument();
    expect(screen.getByText("Vehicle History Report")).toBeInTheDocument();
    expect(screen.getByText("Arac Gecmisi Raporu")).toBeInTheDocument();
    expect(screen.queryByText(/Firebase|UID:|Connection:/i)).not.toBeInTheDocument();
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
