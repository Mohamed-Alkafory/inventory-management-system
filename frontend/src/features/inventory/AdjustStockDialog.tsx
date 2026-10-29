import Modal from "../../components/ui/Modal";
import AdjustStockForm from "./AdjustStockForm";
import type { InventoryItem } from "./types";

export default function AdjustStockDialog({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  return (
    <Modal open={item !== null} onClose={onClose} title="Adjust stock" widthClass="max-w-md">
      {item && <AdjustStockForm item={item} onSaved={onClose} onCancel={onClose} />}
    </Modal>
  );
}
