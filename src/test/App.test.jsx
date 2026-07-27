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

    expect(screen.getAllByText(/Profil bulunamadı/i)).toHaveLength(1);
  });

  it("logs in from a quick profile and shows the map shell", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));

    const compactHeader = screen.getByTestId("compact-app-header");
    expect(within(compactHeader).getByText("Poyraz Alkan")).toBeInTheDocument();
    expect(within(compactHeader).getByText("Seat Ibiza Cupra")).toBeInTheDocument();
    expect(within(compactHeader).queryByText(/CRUISER \/\//i)).not.toBeInTheDocument();
    expect(within(compactHeader).queryByText("Odometer")).not.toBeInTheDocument();
    expect(within(within(compactHeader).getByRole("button", { name: "Sürüşe Başla" })).queryByText("Başlat")).not.toBeInTheDocument();
    expect(screen.queryByText("Node Management Hub")).not.toBeInTheDocument();
    expect(screen.queryByText(/Event, photo spot ve wash noktalarini burada yönet/i)).not.toBeInTheDocument();
    expect(await screen.findByText("Etkinlik Haritası")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Etkinlik Ekle" })).toBeInTheDocument();
    const spotMarker = await screen.findByRole("button", { name: "Mogan Lake Sunset (spot)" });
    expect(spotMarker).toBeInTheDocument();
    expect(screen.queryByText("Mogan Lake Sunset")).not.toBeInTheDocument();

    await user.click(spotMarker);
    const spotDetails = await screen.findByRole("heading", { name: "Mogan Lake Sunset" });
    const nodeComposer = screen.getByLabelText("Nokta editoru");
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
    await user.click(screen.getByRole("button", { name: "Sürüşe Başla" }));

    expect(await screen.findByText(/Sürüş Modu Aktif|Sürüş Modu Hazır/i)).toBeInTheDocument();
    expect(screen.queryByText("Live GPS HUD")).not.toBeInTheDocument();
    expect(screen.queryByText("Current Setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Trip Energy")).not.toBeInTheDocument();
    expect(await screen.findByText("Oturum")).toBeInTheDocument();
    expect(await screen.findByText("Canlı Aktif Sürücüler")).toBeInTheDocument();
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
    expect(screen.getAllByRole("button", { name: "Sürüşe Başla" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Ayarlar merkezi" })).toHaveLength(1);

    const liveMap = screen.getByTestId("live-map-screen");
    expect(within(liveMap).getByText("Poyraz Alkan")).toBeInTheDocument();
    expect(within(liveMap).getByText("Seat Ibiza Cupra")).toBeInTheDocument();
    expect(within(liveMap).queryByText("CRUISER LIVE MAP")).not.toBeInTheDocument();
    expect(within(liveMap).queryByText("Selected Node")).not.toBeInTheDocument();
    expect(within(liveMap).queryByText("Serbest sürüş")).not.toBeInTheDocument();

    await user.click(within(liveMap).getByRole("button", { name: "Mogan Lake Sunset (spot)" }));
    expect(within(liveMap).getByTestId("live-map-node-overlay")).toBeInTheDocument();
    await user.click(within(liveMap).getByRole("button", { name: "Kapat" }));
    expect(within(liveMap).queryByTestId("live-map-node-overlay")).not.toBeInTheDocument();
    expect(within(liveMap).getByText("Marker seçilmedi")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Sohbet listesine dön" })).toBeInTheDocument();
  });

  it("opens profile controls from the global settings center", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: "Ayarlar merkezi" }));

    expect(screen.getByRole("dialog", { name: "Ayarlar merkezi paneli" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gizlilik ve Konum/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Engellenen Kullanıcılar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Araç ve Profil/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hesap ve Veri Kontrolleri/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Şifre ve Güvenlik/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oturumu Kapat" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Araç ve Profil/i }));
    expect(screen.getByRole("textbox", { name: "Vehicle Model" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Profili Güncelle" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ayarlar listesine dön" }));
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

    expect(await screen.findByText("Arkadaş Bul ve Bağlan")).toBeInTheDocument();
    expect(screen.queryByText("DM Panel")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Klani Kur" })).not.toBeInTheDocument();

    const outgoingRequests = screen.getByLabelText("Giden istekler");
    expect(within(outgoingRequests).getByText("Mete Alp")).toBeInTheDocument();
    expect(within(outgoingRequests).getByText("Golf GTI")).toBeInTheDocument();
    expect(within(outgoingRequests).queryByText("16 GTI 232")).not.toBeInTheDocument();
    expect(within(outgoingRequests).getByRole("button", { name: "Mete Alp arkadaşlık istegini geri çek" })).toBeInTheDocument();

    const friends = screen.getByLabelText("Arkadaş listesi");
    expect(within(friends).getByText("Ece Yalin")).toBeInTheDocument();
    expect(within(friends).getByText("Ducati Monster")).toBeInTheDocument();
    expect(within(friends).queryByText("35 SRT 908")).not.toBeInTheDocument();
    expect(within(friends).getByRole("button", { name: "Ece Yalin ile sohbet ac" })).toBeInTheDocument();
    expect(within(friends).getByRole("button", { name: /Ece Yalin (klana davet et|klan daveti gönderildi)/ })).toBeInTheDocument();
    expect(within(friends).getByRole("button", { name: "Ece Yalin arkadaşlıktan çıkar" })).toBeInTheDocument();
    expect(within(friends).getByRole("button", { name: "Ece Yalin engelle" })).toBeInTheDocument();

    const clanCard = screen.getByRole("button", { name: "Neon Wolves klan detaylarini ac" });
    await user.click(clanCard);
    expect(screen.getByRole("dialog", { name: "Klan merkezi paneli" })).toBeInTheDocument();
    expect(screen.getByText("Klan Kadrosu")).toBeInTheDocument();
    expect(screen.getByText("Klan Eventleri")).toBeInTheDocument();
    expect(screen.getByText("Event Sayısı")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Klandan Ayrıl" })).toBeInTheDocument();
  });

  it("blocks invalid sign up and shows field errors", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    await user.click(screen.getByRole("button", { name: "Build My Garage" }));

    expect(screen.getAllByText("Zorunlu alanları doldurunuz.").length).toBeGreaterThan(0);
    expect(screen.getByText("Görünen ad zorunludur.")).toBeInTheDocument();
    expect(screen.getByText("Plate is required.")).toBeInTheDocument();
    expect(screen.queryByText("Primary garage is required.")).not.toBeInTheDocument();
    expect(screen.getByText("Mevcut KM 0 ile 5.000.000 arasinda olmali.")).toBeInTheDocument();
  });

  it("registers a mock driver with entered mileage and a device photo", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    await user.type(screen.getByLabelText(/Görünen Ad/), "Yeni Sürücü");
    await user.type(screen.getByLabelText(/Plate/), "06 NEW 606");
    await user.type(screen.getByLabelText(/Password/), "secure123");
    await user.type(screen.getByLabelText(/Car\/Bike Model/), "Honda Civic");
    await user.type(screen.getByLabelText(/Horsepower/), "182");
    await user.type(screen.getByLabelText(/Mevcut KM/), "54321");
    await user.type(screen.getByLabelText(/Primary Garage\/Tuning Shop/), "Ankara Garage");
    await user.upload(screen.getByLabelText("Profil Fotoğrafı"), new File(["avatar"], "avatar.png", { type: "image/png" }));
    await user.click(screen.getByRole("checkbox", { name: /Kullanım Koşullarını kabul ediyorum/i }));
    expect(await screen.findByAltText("Profil fotoğrafı önizleme")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Build My Garage" }));
    await user.click(await screen.findByRole("button", { name: "Ayarlar merkezi" }));
    await user.click(screen.getByRole("button", { name: /Araç ve Profil/i }));
    expect(screen.getByRole("spinbutton", { name: "Mevcut KM" })).toHaveValue(54321);
  });

  it("shows a general required-fields notification for an incomplete event", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(await screen.findByRole("button", { name: "+ Ekle" }));
    fireEvent.submit(screen.getByRole("button", { name: "Event Ekle" }).closest("form"));

    expect((await screen.findAllByText("Zorunlu alanları doldurunuz.")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("alert")).toHaveTextContent("Zorunlu alanları doldurunuz.");
    expect(await screen.findByText("Node name is required.")).toBeInTheDocument();
    expect(await screen.findByText("Route summary is required.")).toBeInTheDocument();
  });

  it("offers mileage editing and device photo upload in vehicle settings", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: "Ayarlar merkezi" }));
    await user.click(screen.getByRole("button", { name: /Araç ve Profil/i }));

    expect(screen.getByRole("spinbutton", { name: "Mevcut KM" })).toHaveValue(68420);
    expect(screen.getByLabelText("Profil Fotoğrafı")).toHaveAttribute("type", "file");
    expect(screen.queryByLabelText("Avatar URL")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Profili Güncelle" }));
    expect(await screen.findByText("Profil, fotoğraf ve kilometre bilgileri güncellendi.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("blocks invalid fuel log submission and shows validation errors", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: "Profil" }));
    await user.click(await screen.findByRole("button", { name: "Servis" }));
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
    await user.click(screen.getByRole("button", { name: "Profil" }));
    await user.click(await screen.findByRole("button", { name: "Servis" }));
    await user.click(await screen.findByRole("button", { name: "Araç parça sağlığı detaylarini ac" }));

    const dialog = screen.getByRole("dialog", { name: "Parça sağlığı merkezi" });
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

    expect(screen.getAllByText("Review added successfully.")).toHaveLength(1);
    expect(screen.getByText("Foam was dense and rinse quality stayed stable.")).toBeInTheDocument();
  });

  it("shows achievements and profile stats on the dedicated profile screen", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: /Profil/i }));

    expect(await screen.findByText("Başarımlar")).toBeInTheDocument();
    expect(screen.getByText("Driver Stats Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Aylık Sürüş")).toBeInTheDocument();
    expect(screen.getByText("Aylık Max Hız")).toBeInTheDocument();
    expect(screen.queryByText("Onaylı Sürüş")).not.toBeInTheDocument();
    expect(screen.getByText("Social Cockpit")).toBeInTheDocument();
    expect(screen.getByLabelText("Driver stats")).toHaveClass("p-3");
    expect(screen.getByLabelText("Social cockpit")).toHaveClass("p-3");
    expect(screen.queryByRole("button", { name: "Stats Ekranina Git" })).not.toBeInTheDocument();
    expect(screen.queryByText("Vehicle Passport Snapshot")).not.toBeInTheDocument();
    expect(screen.queryByText("Pasaport")).not.toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    expect(screen.getByText("Crew Apex")).toBeInTheDocument();
    expect(screen.queryByText("Garaj Arsivi")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Başarım detaylarini ac" }));
    expect(screen.getByRole("dialog", { name: "Başarım merkezi paneli" })).toBeInTheDocument();
    expect(screen.getByText("Devam Edenler")).toBeInTheDocument();
    expect(screen.getByText("Tamamlananlar")).toBeInTheDocument();
    expect(screen.getByText("Garaj Arsivi")).toBeInTheDocument();
  });

  it("switches individual leaderboard ranking metrics", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: /Leaders/i }));

    expect(await screen.findByText("Aylık Sürücü Sıralaması")).toBeInTheDocument();
    expect(screen.getByText("Aylık Klan Sıralaması")).toBeInTheDocument();
    expect(screen.queryByText(/Tümünü Gör/)).not.toBeInTheDocument();
    const periodGroup = screen.getByLabelText("Sürücü sıralama dönemi");
    expect(within(periodGroup).getByRole("button", { name: "Aylık" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(periodGroup).getByRole("button", { name: "Haftalık" }));
    expect(screen.getByText("Haftalık Sürücü Sıralaması")).toBeInTheDocument();
    await user.click(within(periodGroup).getByRole("button", { name: "Günlük" }));
    expect(screen.getByText("Günlük Sürücü Sıralaması")).toBeInTheDocument();
    await user.click(within(periodGroup).getByRole("button", { name: "Aylık" }));

    const metricGroup = screen.getByLabelText("Leaderboard ölçütü");
    expect(within(metricGroup).getByRole("button", { name: "KM" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(metricGroup).getByRole("button", { name: "Sürüş Süresi" }));
    expect(within(metricGroup).getByRole("button", { name: "Sürüş Süresi" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(metricGroup).getByRole("button", { name: "Maksimum Hız" }));
    expect(within(metricGroup).getByRole("button", { name: "Maksimum Hız" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Max Hız")).toBeInTheDocument();

    const clanMetricGroup = screen.getByLabelText("Klan leaderboard ölçütü");
    await user.click(within(clanMetricGroup).getByRole("button", { name: "Sürüş Süresi" }));
    expect(within(clanMetricGroup).getByRole("button", { name: "Sürüş Süresi" })).toHaveAttribute("aria-pressed", "true");

    const driverLeaderboard = screen.getByLabelText("Aylık sürücü sıralaması");
    expect(within(driverLeaderboard).queryByText("Verified")).not.toBeInTheDocument();
    expect(within(driverLeaderboard).queryByText("06 PWA 101")).not.toBeInTheDocument();

    await user.click(within(driverLeaderboard).getByRole("button", { name: /Aylık Sürücü Sıralaması/i }));
    expect(within(driverLeaderboard).getByText("Tüm sürücüler")).toBeInTheDocument();

    await user.click(driverLeaderboard);
    expect(within(driverLeaderboard).getByText("İlk 5 sürücü (tümünü görmek için tıklayınız)")).toBeInTheDocument();
  });

  it("opens the shared public driver profile from stats", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /06 PWA 101/i }));
    await user.click(screen.getByRole("button", { name: /Social/i }));
    await user.click((await screen.findAllByRole("button", { name: /35 SRT 908/i }))[0]);

    expect(screen.getByText("Konvoy Uyumu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mesaj Gönder" })).toBeInTheDocument();
  });
});
