import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    onDeleteServiceLog: vi.fn().mockResolvedValue(true),
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
    serviceLogDeletePendingId: "",
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

  it("opens part percentages only after the compact vehicle map is selected", async () => {
    const user = userEvent.setup();
    render(<GarageScreen {...buildProps()} />);

    expect(screen.queryByRole("dialog", { name: "Parca sagligi merkezi" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Arac parca sagligi detaylarini ac" }));

    const dialog = screen.getByRole("dialog", { name: "Parca sagligi merkezi" });
    expect(within(dialog).getByText("Parca Sagligi")).toBeInTheDocument();
    expect(within(dialog).getAllByText(/%\d+/).length).toBeGreaterThan(1);

    await user.click(within(dialog).getByRole("button", { name: "Parca sagligi merkezini kapat" }));
    expect(screen.queryByRole("dialog", { name: "Parca sagligi merkezi" })).not.toBeInTheDocument();
  });

  it("shows every service record by default and filters history independently by part", async () => {
    const userEventDriver = userEvent.setup();
    const props = buildProps();
    render(<GarageScreen {...props} />);

    const historyPartFilter = screen.getByRole("combobox", { name: "Gecmis Parcasi" });
    expect(historyPartFilter).toHaveValue("all");
    props.user.serviceLogs.forEach((log) => {
      const partName = props.user.parts.find((part) => part.key === log.partKey)?.name ?? log.partKey;
      expect(screen.getByRole("button", { name: `${partName} servis kaydini sil` })).toBeInTheDocument();
    });

    const selectedLog = props.user.serviceLogs[1];
    await userEventDriver.selectOptions(historyPartFilter, selectedLog.partKey);

    expect(screen.getByRole("button", {
      name: `${props.user.parts.find((part) => part.key === selectedLog.partKey)?.name} servis kaydini sil`,
    })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /servis kaydini sil$/ })).toHaveLength(1);
  });

  it("requires confirmation before deleting a mistaken service record", async () => {
    const userEventDriver = userEvent.setup();
    const props = buildProps();
    const firstLog = props.user.serviceLogs[0];
    const partName = props.user.parts.find((part) => part.key === firstLog.partKey)?.name ?? firstLog.partKey;
    render(<GarageScreen {...props} />);

    await userEventDriver.click(screen.getByRole("button", { name: `${partName} servis kaydini sil` }));

    const warning = screen.getByRole("alert");
    expect(within(warning).getByText("Bu servis kaydi kalici olarak silinecek.")).toBeInTheDocument();
    expect(props.onDeleteServiceLog).not.toHaveBeenCalled();

    await userEventDriver.click(within(warning).getByRole("button", { name: "Silmeyi Onayla" }));
    expect(props.onDeleteServiceLog).toHaveBeenCalledWith(firstLog.id);
  });
});
