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
    expect(await screen.findByText("CRUISER MAP")).toBeInTheDocument();
    expect((await screen.findAllByText("Mogan Lake Sunset")).length).toBeGreaterThan(0);
  });

  it("switches to the driving screen when the start ride button is pressed", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /34 MOTO 410/i }));
    await user.click(screen.getByRole("button", { name: "Suruse Basla" }));

    expect(await screen.findByText(/Surus Modu Aktif|Surus Modu Hazir/i)).toBeInTheDocument();
    expect(await screen.findByText("Live GPS HUD")).toBeInTheDocument();
    expect(await screen.findByText("Canli Aktif Suruculer")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /Servis/i }));
    const litersInput = await screen.findByRole("spinbutton", { name: "Liters" });
    const priceInput = await screen.findByRole("spinbutton", { name: "Price (TL)" });
    const currentKmInput = await screen.findByRole("spinbutton", { name: "Current KM" });
    const stationInput = await screen.findByRole("textbox", { name: "Station" });
    await user.clear(litersInput);
    await user.type(litersInput, "0");
    await user.clear(priceInput);
    await user.type(priceInput, "0");
    await user.clear(currentKmInput);
    await user.type(currentKmInput, "1");
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
    await user.click(screen.getByRole("button", { name: /Foam District Self Wash \(wash\)/i }));
    const noteInput = await screen.findByRole("textbox", { name: "Review Note" });
    await user.clear(noteInput);
    await user.type(noteInput, "Foam was dense and rinse quality stayed stable.");
    const foamInput = await screen.findByRole("spinbutton", { name: "Foam" });
    const waterInput = await screen.findByRole("spinbutton", { name: "Water" });
    await user.clear(foamInput);
    await user.type(foamInput, "5");
    await user.clear(waterInput);
    await user.type(waterInput, "4");
    await user.click(screen.getByRole("button", { name: "Review Ekle" }));

    expect(screen.getByText("Review added successfully.")).toBeInTheDocument();
    expect(screen.getByText("Foam was dense and rinse quality stayed stable.")).toBeInTheDocument();
  });

  it("shows achievements and profile stats on the dedicated profile screen", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: /Profil/i }));

    expect(await screen.findByText("Achievement Progress")).toBeInTheDocument();
    expect(screen.getByText("Driver Stats Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Social Cockpit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stats Ekranina Git" })).toBeInTheDocument();
  });

  it("opens the detailed public driver profile from stats", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: /Stats/i }));
    await user.click((await screen.findAllByRole("button", { name: /35 SRT 908/i }))[0]);
    await user.click(screen.getByRole("button", { name: "Detayli Profili Ac" }));

    expect(await screen.findByText("Public Driver Profile")).toBeInTheDocument();
    expect(screen.getByText("Konvoy Uyumu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mesaj Gonder" })).toBeInTheDocument();
  });
});
