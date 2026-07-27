import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForumScreen } from "./ForumScreen";

const props = {
  addReply: vi.fn(),
  createThread: vi.fn(),
  feedback: "",
  form: { category: "roadlife", body: "", location: "", setup: "", vehicleKm: "" },
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
  });
});
