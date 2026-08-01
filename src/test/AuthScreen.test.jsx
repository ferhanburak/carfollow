import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { LanguageProvider } from "../providers/LanguageProvider";
import { AuthScreen } from "../screens/AuthScreen";
import { createSignUpState } from "../utils/garage";
import { validateSignUpForm } from "../utils/validation";

function renderFirebaseAuthScreen(overrides = {}) {
  return render(
    <LanguageProvider>
      <AuthScreen
      authError=""
      authMode="locked"
      authTab="login"
      isFirebaseAuth
      loginForm={{ email: "", plate: "", password: "" }}
      onAuthTabChange={vi.fn()}
      onLogin={vi.fn((event) => event.preventDefault())}
      onLoginFormChange={vi.fn()}
      onQuickLogin={vi.fn()}
      onSignUp={vi.fn((event) => event.preventDefault())}
      onSignUpFormChange={vi.fn()}
      quickProfiles={[]}
      signUpErrors={{}}
      signUpForm={createSignUpState()}
      tuningOptions={["Stock", "Stage 1"]}
        {...overrides}
      />
    </LanguageProvider>,
  );
}

describe("Firebase authentication screen", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses e-mail for secure account login and hides mock profiles", () => {
    renderFirebaseAuthScreen();

    expect(screen.queryByText("Güvenli Hesap")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "E-posta" })).toBeInTheDocument();
    expect(screen.queryByText("Quick Test Profiles")).not.toBeInTheDocument();
  });

  it("switches the login screen between Turkish and English", async () => {
    const user = userEvent.setup();
    renderFirebaseAuthScreen();

    expect(screen.getByRole("button", { name: "Kayıt Ol" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "EN" }));

    expect(screen.getByRole("button", { name: "Sign Up" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
    expect(window.localStorage.getItem("tracksnap.language.preference.v1")).toBe("en");
  });

  it("requires a valid e-mail only for Firebase registration", () => {
    const baseForm = {
      ...createSignUpState(),
      fullName: "Poyraz Alkan",
      plate: "06 PWA 101",
      password: "seat1907",
      model: "Seat Ibiza Cupra",
      horsepower: "248",
      odometer: "68420",
      garage: "Ankara Apex Garage",
      termsAccepted: true,
    };

    expect(validateSignUpForm(baseForm, { requireEmail: true }).email).toBe("E-mail is required.");
    expect(validateSignUpForm({ ...baseForm, email: "driver@example.com" }, { requireEmail: true }).email).toBeUndefined();
    expect(validateSignUpForm({ ...baseForm, email: "driver@example.com", termsAccepted: false }, { requireEmail: true }).termsAccepted).toBeTruthy();
    expect(validateSignUpForm({ ...baseForm, email: "driver@example.com", horsepower: "", garage: "" }, { requireEmail: true })).toEqual({});
  });
});
