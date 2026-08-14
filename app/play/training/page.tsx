import { redirect } from "next/navigation";

// D5 of the defects reported on 2026-08-15. This route used to render a static
// intro that restated kicker, title, subtitle and a rules list, then offered a
// second button to actually start. It was the last survivor of the layout that
// preceded the mode select board: since /play gives every mode its own Rules
// button and its own Play button, the Play button of Training landed the player
// on a SECOND rules screen instead of the game, while /play/competition went
// straight to the game. The rules it restated now live in one place only, the
// unified ModeRulesPage behind /play/training/rules.
//
// Retired by redirect rather than deleted outright: /play/{mode} is the shape
// the mode select builds its Play links from, and the landing footer points
// here too, so the URL has to keep resolving. Temporary on purpose (307, not
// 308): a permanent redirect is cached hard by browsers, which would make it
// painful to reverse if the owner later wants the training game to live at this
// address instead of /game.
export default function PlayTrainingPage() {
  redirect("/game");
}
