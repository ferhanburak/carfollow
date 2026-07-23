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
};

describe("ForumScreen", () => {
  it("opens the category-aware composer from the Forum page", async () => {
    const user = userEvent.setup();
    render(<ForumScreen {...props} />);

    expect(screen.getByRole("heading", { name: "Forum" })).toBeInTheDocument();
    expect(screen.getByText("Bu kategoride henuz paylasim yok. Ilk paylasimi sen yap.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Paylas" }));
    expect(screen.getByPlaceholderText("Baslik *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Foruma Yayinla" })).toBeInTheDocument();
  });
});
