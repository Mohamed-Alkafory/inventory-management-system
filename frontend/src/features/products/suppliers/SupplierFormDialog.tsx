import Modal from "../../../components/ui/Modal";
import SupplierForm from "./SupplierForm";
import type { Supplier } from "./types";

/** `supplier` set → edit, otherwise → create. */
export default function SupplierFormDialog({
  open,
  supplier,
  onClose,
}: {
  open: boolean;
  supplier?: Supplier;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={supplier ? "Edit supplier" : "Add supplier"} size="md">
      <SupplierForm supplier={supplier} onSaved={onClose} onCancel={onClose} />
    </Modal>
  );
}
