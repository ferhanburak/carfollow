import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the auth landing view by default", () => {
    render(<App />);

    expect(screen.getByText("CRUISER // ACCESS")).toBeInTheDocument();
    expect(screen.getByText("Quick Test Profiles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter CRUISER" })).toBeInTheDocument();
  });

  it("shows an error for invalid login attempts", async () => {
    const user = userEvent.setup();
    render(<App />);

    const plateInput = screen.getByRole("textbox", { name: "Vehicle Plate" });
    const passwordInput = screen.getByLabelText("Password");

    await user.clear(plateInput);
    await user.type(plateInput, "00 XXX 000");
    await user.clear(passwordInput);
    await user.type(passwordInput, "wrongpass");
    await user.click(screen.getByRole("button", { name: "Enter CRUISER" }));

    expect(screen.getByText(/Profil bulunamadi/i)).toBeInTheDocument();
  });

  it("logs in from a quick profile and shows the map shell", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));

    expect(screen.getByText("CRUISER // Ankara Bati")).toBeInTheDocument();
    expect(screen.getByText("Interactive Map Layer")).toBeInTheDocument();
    expect(screen.getByText("Mogan Lake Sunset")).toBeInTheDocument();
  });

  it("switches to the driving screen when the start ride button is pressed", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /34 MOTO 410/i }));
    await user.click(screen.getByRole("button", { name: "Suruse Basla" }));

    expect(screen.getByText(/Surus Modu Aktif|Surus Modu Hazir/i)).toBeInTheDocument();
    expect(screen.getByText("Live GPS HUD")).toBeInTheDocument();
    expect(screen.getByText("Canli Aktif Suruculer")).toBeInTheDocument();
  });

  it("blocks invalid sign up and shows field errors", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    await user.click(screen.getByRole("button", { name: "Build My Garage" }));

    expect(screen.getByText("Full name is required.")).toBeInTheDocument();
    expect(screen.getByText("Plate is required.")).toBeInTheDocument();
    expect(screen.getByText("Primary garage is required.")).toBeInTheDocument();
  });

  it("blocks invalid fuel log submission and shows validation errors", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: /Garaj/i }));
    await user.clear(screen.getByRole("spinbutton", { name: "Liters" }));
    await user.type(screen.getByRole("spinbutton", { name: "Liters" }), "0");
    await user.clear(screen.getByRole("spinbutton", { name: "Price (TL)" }));
    await user.type(screen.getByRole("spinbutton", { name: "Price (TL)" }), "0");
    await user.clear(screen.getByRole("spinbutton", { name: "Current KM" }));
    await user.type(screen.getByRole("spinbutton", { name: "Current KM" }), "1");
    const stationInput = screen.getByRole("textbox", { name: "Station" });
    await user.clear(stationInput);
    await user.click(screen.getByRole("button", { name: "Receipt Ekle" }));

    expect(screen.getByText("Liters must be greater than 0.")).toBeInTheDocument();
    expect(screen.getByText("Price must be greater than 0.")).toBeInTheDocument();
    expect(screen.getByText("Current KM cannot be below odometer.")).toBeInTheDocument();
    expect(screen.getByText("Station is required.")).toBeInTheDocument();
  });

  it("submits a valid wash review and shows success feedback", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: "🧼" }));
    const noteInput = screen.getByRole("textbox", { name: "Review Note" });
    await user.clear(noteInput);
    await user.type(noteInput, "Foam was dense and rinse quality stayed stable.");
    await user.clear(screen.getByRole("spinbutton", { name: "Foam" }));
    await user.type(screen.getByRole("spinbutton", { name: "Foam" }), "5");
    await user.clear(screen.getByRole("spinbutton", { name: "Water" }));
    await user.type(screen.getByRole("spinbutton", { name: "Water" }), "4");
    await user.click(screen.getByRole("button", { name: "Review Ekle" }));

    expect(screen.getByText("Review added successfully.")).toBeInTheDocument();
    expect(screen.getByText("Foam was dense and rinse quality stayed stable.")).toBeInTheDocument();
  });
});
