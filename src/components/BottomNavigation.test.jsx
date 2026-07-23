import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomNavigation } from "./BottomNavigation";

const items = [
  { key: "map", label: "Harita" },
  { key: "liveMap", label: "Live Map" },
  { key: "drive", label: "Surus" },
  { key: "social", label: "Social" },
  { key: "forum", label: "Forum" },
  { key: "leaderboard", label: "Leaders" },
  { key: "profile", label: "Profil" },
];

describe("BottomNavigation", () => {
  it("renders icon-only accessible navigation and selects a tab", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BottomNavigation activeTab="map" items={items} onSelect={onSelect} />);

    expect(screen.getByRole("navigation", { name: "Ana navigasyon" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Harita" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Harita" })).toHaveTextContent("");
    expect(screen.queryByRole("button", { name: "Servis" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Social" }));
    expect(onSelect).toHaveBeenCalledWith("social");
  });
});
