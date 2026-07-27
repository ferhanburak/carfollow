import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForumScreen } from "./ForumScreen";

vi.mock("../hooks/useReverseGeocodedLocation", () => ({
  useReverseGeocodedLocation: (location) => ({
    label: location ? "Çankaya / Ankara" : "",
    status: location ? "ready" : "idle",
  }),
}));

const props = {
  addReply: vi.fn(),
  createThread: vi.fn(),
  feedback: "",
  form: { category: "roadlife", body: "", location: null },
  onFormChange: vi.fn(),
  pendingKey: "",
  threads: [],
  toggleLike: vi.fn(),
  user: { fullName: "Test Driver", avatar: "" },
};

describe("ForumScreen", () => {
  it("opens the category-aware composer from the Forum page", async () => {
    const user = userEvent.setup();
    render(<ForumScreen {...props} />);

    expect(screen.queryByRole("heading", { name: "Forum" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tüm Paylaşımlar" })).toBeInTheDocument();
    expect(screen.getByText("Bu kategoride henüz paylaşım yok. İlk paylaşımı sen yap.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ne paylaşmak istersin?" }));
    expect(screen.queryByRole("button", { name: "Ne paylaşmak istersin?" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Başlık *")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paylaşımını anlat *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Görsel ekle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paylaşımı iptal et" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paylaş" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Konum ekle" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Mekan veya rota")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Parçalar ve setup")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Araç kilometresi")).not.toBeInTheDocument();
  });

  it("shows a clear error when the selected image is larger than 10 MB", async () => {
    const user = userEvent.setup();
    const { container } = render(<ForumScreen {...props} />);
    await user.click(screen.getByRole("button", { name: "Ne paylaşmak istersin?" }));

    const image = new File(["large-image"], "large.jpg", { type: "image/jpeg" });
    Object.defineProperty(image, "size", { value: 10 * 1024 * 1024 + 1 });
    await user.upload(container.querySelector('input[type="file"]'), image);

    expect(screen.getByRole("alert")).toHaveTextContent("Görsel en fazla 10 MB olabilir.");
  });

  it("rejects non-image files with a visible error", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<ForumScreen {...props} />);
    await user.click(screen.getByRole("button", { name: "Ne paylaşmak istersin?" }));
    await user.upload(
      container.querySelector('input[type="file"]'),
      new File(["not-an-image"], "notes.txt", { type: "text/plain" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Yalnızca görsel dosyası seçebilirsiniz.");
  });

  it("adds the current GPS location only after the user requests it", async () => {
    const user = userEvent.setup();
    const onFormChange = vi.fn();
    const getCurrentPosition = vi.fn((onSuccess) => onSuccess({
      coords: { accuracy: 8.4, latitude: 39.92077, longitude: 32.85411 },
    }));
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    render(<ForumScreen {...props} onFormChange={onFormChange} />);
    await user.click(screen.getByRole("button", { name: "Ne paylaşmak istersin?" }));
    await user.click(screen.getByRole("button", { name: "Konum ekle" }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    const updateForm = onFormChange.mock.calls.at(-1)[0];
    expect(updateForm(props.form).location).toEqual({
      accuracy: 8,
      label: "Konum belirleniyor...",
      lat: 39.92077,
      lng: 32.85411,
    });
  });

  it("filters the feed using the visible category names", async () => {
    const user = userEvent.setup();
    const threads = [
      { id: "place-1", authorName: "Rota", body: "Etkinlik paylaşımı", category: "places" },
      { id: "tech-1", authorName: "Usta", body: "Teknik paylaşım", category: "technical" },
    ];
    render(<ForumScreen {...props} threads={threads} />);

    await user.click(screen.getByRole("button", { name: "Arıza & Teknik Destek" }));
    expect(screen.getByText("Teknik paylaşım")).toBeInTheDocument();
    expect(screen.queryByText("Etkinlik paylaşımı")).not.toBeInTheDocument();
  });
});
