// Any other route clears the @modal slot, so following a link out of an open event overlay
// (team, tournament, nav) closes it instead of leaving it stacked over the new page.
export default function ModalCatchAll() {
  return null;
}
