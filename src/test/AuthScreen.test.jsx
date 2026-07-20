import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AuthScreen } from "../screens/AuthScreen";
import { createSignUpState } from "../utils/garage";
import { validateSignUpForm } from "../utils/validation";

function renderFirebaseAuthScreen(overrides = {}) {
  return render(
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
    />,
  );
}

describe("Firebase authentication screen", () => {
  it("uses e-mail for secure account login and hides mock profiles", () => {
    renderFirebaseAuthScreen();

    expect(screen.getByText("Guvenli Hesap")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "E-mail" })).toBeInTheDocument();
    expect(screen.queryByText("Quick Test Profiles")).not.toBeInTheDocument();
  });

  it("requires a valid e-mail only for Firebase registration", () => {
    const baseForm = {
      ...createSignUpState(),
      fullName: "Poyraz Alkan",
      plate: "06 PWA 101",
      password: "seat1907",
      model: "Seat Ibiza Cupra",
      horsepower: "248",
      garage: "Ankara Apex Garage",
    };

    expect(validateSignUpForm(baseForm, { requireEmail: true }).email).toBe("E-mail is required.");
    expect(validateSignUpForm({ ...baseForm, email: "driver@example.com" }, { requireEmail: true }).email).toBeUndefined();
    expect(validateSignUpForm({ ...baseForm, email: "driver@example.com" }, { requireEmail: true }).privacyNoticeAccepted).toBeTruthy();
    expect(validateSignUpForm({ ...baseForm, email: "driver@example.com", privacyNoticeAccepted: true }, { requireEmail: true }).privacyNoticeAccepted).toBeUndefined();
  });
});
