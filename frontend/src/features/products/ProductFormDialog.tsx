import Modal from "../../components/ui/Modal";
import ProductForm from "./ProductForm";
import type { Product } from "./types";

/** `product` set → edit, otherwise → create. */
export default function ProductFormDialog({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product?: Product;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={product ? "Edit product" : "Add product"} size="lg">
      <ProductForm product={product} onSaved={onClose} onCancel={onClose} />
    </Modal>
  );
}
