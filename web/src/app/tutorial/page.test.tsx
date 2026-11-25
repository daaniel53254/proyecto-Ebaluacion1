import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Tutorial from "./page";

afterEach(cleanup);

describe("Tutorial", () => {
  it("tiene los 5 pasos, el aviso de 30 días y el enlace a subir", () => {
    render(<Tutorial />);
    expect(screen.getAllByRole("listitem", { name: /paso/i })).toHaveLength(5);
    expect(screen.getByText(/hasta 30 días/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /privacidad de la cuenta/i })).toHaveAttribute(
      "href",
      "https://www.spotify.com/es/account/privacy/",
    );
    expect(screen.getByRole("link", { name: /ya lo tengo/i })).toHaveAttribute("href", "/subir");
  });
});
