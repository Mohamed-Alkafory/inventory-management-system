import { useParams } from "react-router-dom";
import MessageDetailsView from "../../../features/contact/MessageDetailsView";

/** /support/messages/:id — triage one contact message. */
export default function SupportMessageDetails() {
  const { id = "" } = useParams();
  return <MessageDetailsView id={id} />;
}
