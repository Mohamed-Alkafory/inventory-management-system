import Modal from "../../../components/ui/Modal";
import CategoryForm from "./CategoryForm";
import type { Category } from "./types";

/** `category` set → edit, otherwise → create. */
export default function CategoryFormDialog({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category?: Category;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={category ? "Edit category" : "Add category"} size="md">
      <CategoryForm category={category} onSaved={onClose} onCancel={onClose} />
    </Modal>
  );
}
