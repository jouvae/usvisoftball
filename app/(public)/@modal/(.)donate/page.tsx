import { DonateSheet } from "@/components/client/donate-sheet";

// An in-site click on any "Support" link (/donate) opens the donation panel over the current
// page; a direct load or refresh renders the full /donate page instead.
export default function DonateModal() {
  return <DonateSheet />;
}
