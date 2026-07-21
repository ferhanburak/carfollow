import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

    expect(screen.getAllByText(/Profil bulunamadi/i)).toHaveLength(2);
  });

  it("logs in from a quick profile and shows the map shell", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));

    expect(screen.getByText("CRUISER // Ankara Bati")).toBeInTheDocument();
    expect(screen.queryByText("Node Management Hub")).not.toBeInTheDocument();
    expect(screen.queryByText(/Event, photo spot ve wash noktalarini burada yonet/i)).not.toBeInTheDocument();
    const spotMarker = await screen.findByRole("button", { name: "Mogan Lake Sunset (spot)" });
    expect(spotMarker).toBeInTheDocument();
    expect(screen.queryByText("Mogan Lake Sunset")).not.toBeInTheDocument();

    await user.click(spotMarker);
    const spotDetails = await screen.findByRole("heading", { name: "Mogan Lake Sunset" });
    const nodeComposer = screen.getByRole("heading", { name: "Yeni Nokta Olustur" });
    expect(spotDetails.compareDocumentPosition(nodeComposer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not persist quick profile passwords in the local session", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));

    await waitFor(() => {
      const persistedSession = window.localStorage.getItem("cruiser-app-state");
      expect(persistedSession).toBeTruthy();
      expect(persistedSession).not.toContain("seat1907");
      expect(persistedSession).not.toContain('"password"');
    });
  });

  it("switches to the driving screen when the start ride button is pressed", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /34 MOTO 410/i }));
    await user.click(screen.getByRole("button", { name: "Suruse Basla" }));

    expect(await screen.findByText(/Surus Modu Aktif|Surus Modu Hazir/i)).toBeInTheDocument();
    expect(await screen.findByText("Live GPS HUD")).toBeInTheDocument();
    expect(await screen.findByText("Canli Aktif Suruculer")).toBeInTheDocument();
    expect(screen.queryByText("Secure Drive Session")).not.toBeInTheDocument();
    expect(screen.queryByText(/Telemetry Sync|UID:|Connection:|RTDB|Firebase Live/i)).not.toBeInTheDocument();
  });

  it("renders one accessible action toolbar on Live Map", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: /Live Map/i }));

    expect(await screen.findAllByRole("button", { name: "Bildirim merkezi" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "DM merkezi" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Suruse Basla" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Ayarlar merkezi" })).toHaveLength(1);

    const liveMap = screen.getByTestId("live-map-screen");
    expect(within(liveMap).queryByText("Selected Node")).not.toBeInTheDocument();
    expect(within(liveMap).queryByText("Serbest surus")).not.toBeInTheDocument();

    await user.click(within(liveMap).getByRole("button", { name: "Mogan Lake Sunset (spot)" }));
    expect(within(liveMap).getByTestId("live-map-node-overlay")).toBeInTheDocument();
    await user.click(within(liveMap).getByRole("button", { name: "Kapat" }));
    expect(within(liveMap).queryByTestId("live-map-node-overlay")).not.toBeInTheDocument();
    expect(within(liveMap).getByText("Marker secilmedi")).toBeInTheDocument();
  });

  it("opens recent conversations from the global DM button", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));

    const dmButton = screen.getByRole("button", { name: "DM merkezi" });
    expect(within(dmButton).getByText("1")).toBeInTheDocument();
    await user.click(dmButton);

    expect(screen.getByRole("dialog", { name: "DM merkezi paneli" })).toBeInTheDocument();
    expect(screen.getByText("Son Sohbetler")).toBeInTheDocument();
    expect(screen.getByText("Olur, ben de route'u hazirliyorum.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Ece Yalin/i }));
    expect(screen.getByRole("textbox", { name: "Mesaj yaz" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sohbet listesine don" })).toBeInTheDocument();
  });

  it("opens profile controls from the global settings center", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: "Ayarlar merkezi" }));

    expect(screen.getByRole("dialog", { name: "Ayarlar merkezi paneli" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gizlilik ve Konum/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Engellenen Kullanicilar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Arac ve Profil/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hesap ve Veri Kontrolleri/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sifre ve Guvenlik/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oturumu Kapat" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Arac ve Profil/i }));
    expect(screen.getByRole("textbox", { name: "Vehicle Model" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Profili Guncelle" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ayarlar listesine don" }));
    await user.click(screen.getByRole("button", { name: "Oturumu Kapat" }));
    expect(screen.getByText("Oturumu kapat?")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Oturumu Kapat" }).at(-1));
    expect(await screen.findByText("CRUISER // ACCESS")).toBeInTheDocument();
    expect(screen.queryByText("Oturumu kapat?")).not.toBeInTheDocument();
  });

  it("keeps the Social screen focused on friendships instead of embedding DM", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: /Social/i }));

    expect(await screen.findByText("Arkadas Bul ve Baglan")).toBeInTheDocument();
    expect(screen.queryByText("DM Panel")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Klani Kur" })).not.toBeInTheDocument();

    const clanCard = screen.getByRole("button", { name: "Neon Wolves klan detaylarini ac" });
    await user.click(clanCard);
    expect(screen.getByRole("dialog", { name: "Klan merkezi paneli" })).toBeInTheDocument();
    expect(screen.getByText("Klan Kadrosu")).toBeInTheDocument();
    expect(screen.getByText("Klan Eventleri")).toBeInTheDocument();
    expect(screen.getByText("Event Sayisi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Klandan Ayril" })).toBeInTheDocument();
  });

  it("blocks invalid sign up and shows field errors", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    await user.click(screen.getByRole("button", { name: "Build My Garage" }));

    expect(screen.getAllByText("Zorunlu alanlari doldurunuz.").length).toBeGreaterThan(0);
    expect(screen.getByText("Gorunen ad zorunludur.")).toBeInTheDocument();
    expect(screen.getByText("Plate is required.")).toBeInTheDocument();
    expect(screen.queryByText("Primary garage is required.")).not.toBeInTheDocument();
    expect(screen.getByText("Mevcut KM 0 ile 5.000.000 arasinda olmali.")).toBeInTheDocument();
  });

  it("registers a mock driver with entered mileage and a device photo", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    await user.type(screen.getByLabelText(/Gorunen Ad/), "Yeni Surucu");
    await user.type(screen.getByLabelText(/Plate/), "06 NEW 606");
    await user.type(screen.getByLabelText(/Password/), "secure123");
    await user.type(screen.getByLabelText(/Car\/Bike Model/), "Honda Civic");
    await user.type(screen.getByLabelText(/Horsepower/), "182");
    await user.type(screen.getByLabelText(/Mevcut KM/), "54321");
    await user.type(screen.getByLabelText(/Primary Garage\/Tuning Shop/), "Ankara Garage");
    await user.upload(screen.getByLabelText("Profil Fotografi"), new File(["avatar"], "avatar.png", { type: "image/png" }));
    await user.click(screen.getByRole("checkbox", { name: /Kullanim Kosullarini kabul ediyorum/i }));
    expect(await screen.findByAltText("Profil fotografi onizleme")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Build My Garage" }));
    expect(await screen.findByText("54.321 KM")).toBeInTheDocument();
  });

  it("shows a general required-fields notification for an incomplete event", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(await screen.findByRole("button", { name: "Editoru Ac" }));
    fireEvent.submit(screen.getByRole("button", { name: "Event Ekle" }).closest("form"));

    expect((await screen.findAllByText("Zorunlu alanlari doldurunuz.")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("alert")).toHaveTextContent("Zorunlu alanlari doldurunuz.");
    expect(await screen.findByText("Node name is required.")).toBeInTheDocument();
    expect(await screen.findByText("Route summary is required.")).toBeInTheDocument();
  });

  it("offers mileage editing and device photo upload in vehicle settings", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: "Ayarlar merkezi" }));
    await user.click(screen.getByRole("button", { name: /Arac ve Profil/i }));

    expect(screen.getByRole("spinbutton", { name: "Mevcut KM" })).toHaveValue(68420);
    expect(screen.getByLabelText("Profil Fotografi")).toHaveAttribute("type", "file");
    expect(screen.queryByLabelText("Avatar URL")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Profili Guncelle" }));
    const actionToast = await screen.findByRole("status");
    expect(within(actionToast).getByText("Profil, fotograf ve kilometre bilgileri guncellendi.")).toBeInTheDocument();
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

  it("selects a maintenance part without showing an informational action toast", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: /Servis/i }));
    await user.click(await screen.findByRole("button", { name: "Arac parca sagligi detaylarini ac" }));

    const dialog = screen.getByRole("dialog", { name: "Parca sagligi merkezi" });
    const batteryActions = within(dialog).getAllByRole("button", { name: /Battery/i });
    await user.click(batteryActions.at(-1));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/loaded into service form/i)).not.toBeInTheDocument();
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

    expect(screen.getAllByText("Review added successfully.")).toHaveLength(2);
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
    expect(screen.queryByText("Vehicle Passport Snapshot")).not.toBeInTheDocument();
    expect(screen.queryByText("Pasaport")).not.toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    expect(screen.getByText("Crew Apex")).toBeInTheDocument();
    expect(screen.queryByText("Garaj Arsivi")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Basarim detaylarini ac" }));
    expect(screen.getByRole("dialog", { name: "Basarim merkezi paneli" })).toBeInTheDocument();
    expect(screen.getByText("Devam Edenler")).toBeInTheDocument();
    expect(screen.getByText("Tamamlananlar")).toBeInTheDocument();
    expect(screen.getByText("Garaj Arsivi")).toBeInTheDocument();
  });

  it("opens the shared public driver profile from stats", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: /Social/i }));
    await user.click((await screen.findAllByRole("button", { name: /35 SRT 908/i }))[0]);

    expect(await screen.findByText("Public Driver Profile")).toBeInTheDocument();
    expect(screen.getByText("Konvoy Uyumu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mesaj Gonder" })).toBeInTheDocument();
  });
});
