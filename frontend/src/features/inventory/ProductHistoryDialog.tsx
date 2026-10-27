import Modal from "../../components/ui/Modal";
import MovementsPanel from "./MovementsPanel";
import type { InventoryItem } from "./types";

/** Stock history of a single product. */
export default function ProductHistoryDialog({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  return (
    <Modal open={item !== null} onClose={onClose} title={item ? `Stock history · ${item.name}` : "Stock history"} widthClass="max-w-4xl">
      {item && <MovementsPanel productId={item.id} />}
    </Modal>
  );
}
