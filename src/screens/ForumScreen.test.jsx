import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForumScreen } from "./ForumScreen";

const props = {
  addReply: vi.fn(),
  createThread: vi.fn(),
  feedback: "",
  form: { category: "roadlife", title: "", body: "", location: "", setup: "", vehicleKm: "" },
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
    expect(screen.getByRole("button", { name: "Tüm Akis" })).toBeInTheDocument();
    expect(screen.getByText("Bu kategoride henüz paylaşım yok. İlk paylaşımı sen yap.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ne paylasmak istersin?" }));
    expect(screen.getByPlaceholderText("Başlık *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paylaş" })).toBeInTheDocument();
  });
});
