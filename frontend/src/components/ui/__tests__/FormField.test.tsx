import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import Input from "../Input";
import Select from "../Select";
import Field from "../form/Field";
import FormField from "../form/FormField";

afterEach(cleanup);

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Pick a category"),
});
type Values = z.infer<typeof schema>;

function Demo({ onValid }: { onValid: (v: Values) => void }) {
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", category: "" },
  });

  return (
    <form onSubmit={handleSubmit(onValid)}>
      <FormField control={control} name="name" label="Product name" required hint="Shown to customers">
        {({ field, aria }) => <Input {...field} {...aria} />}
      </FormField>
      <FormField control={control} name="category" label="Category">
        {({ field, aria }) => (
          <Select {...field} {...aria} placeholder="Select a category">
            <option value="tools">Tools</option>
          </Select>
        )}
      </FormField>
      <button type="submit">Save</button>
    </form>
  );
}

describe("FormField (React Hook Form + Zod)", () => {
  it("shows Zod error messages and links them to the control", async () => {
    const onValid = vi.fn();
    render(<Demo onValid={onValid} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Pick a category")).toBeInTheDocument();

    const input = screen.getByLabelText(/product name/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
  });

  it("submits when the values are valid", async () => {
    const onValid = vi.fn();
    render(<Demo onValid={onValid} />);

    fireEvent.change(screen.getByLabelText(/product name/i), { target: { value: "Hammer" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "tools" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onValid).toHaveBeenCalled());
    expect(onValid.mock.calls[0][0]).toEqual({ name: "Hammer", category: "tools" });
  });
});

describe("Field", () => {
  it("shows the hint, and swaps it for the error when one exists", () => {
    const { rerender } = render(
      <Field label="SKU" hint="Unique code">
        {(c) => <Input {...c} />}
      </Field>,
    );
    expect(screen.getByText("Unique code")).toBeInTheDocument();

    rerender(
      <Field label="SKU" hint="Unique code" error="Already used">
        {(c) => <Input {...c} />}
      </Field>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Already used");
    expect(screen.queryByText("Unique code")).toBeNull();
  });
});
