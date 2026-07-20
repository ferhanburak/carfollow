import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionToast, inferActionToastTone } from "./ActionToast";

describe("ActionToast", () => {
  it("classifies request progress, success and errors", () => {
    expect(inferActionToastTone("İstek gönderiliyor...")).toBe("pending");
    expect(inferActionToastTone("Servis kaydi siliniyor...")).toBe("pending");
    expect(inferActionToastTone("Arkadaşlık isteği gönderildi.")).toBe("success");
    expect(inferActionToastTone("Secilen servis kaydi gecmisten silindi ve Vehicle Passport yeniden hesaplandi.")).toBe("success");
    expect(inferActionToastTone("İstek gönderilemedi.")).toBe("error");
  });

  it("announces feedback and can be dismissed", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <ActionToast
        onDismiss={onDismiss}
        toast={{ id: "social-1", message: "Arkadaslik istegi gonderildi.", tone: "success" }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Arkadaslik istegi gonderildi.");
    await user.click(screen.getByRole("button", { name: "Bildirimi kapat" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
