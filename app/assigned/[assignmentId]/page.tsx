import type { Metadata } from "next";
import AssignedScreen from "@/features/game/components/AssignedScreen";

export const metadata: Metadata = {
  title: "Devoir",
};

// La page d'un devoir. Elle ne fait rien d'autre que passer son identifiant :
// l'ecran appelle les trois routes du chemin assigne, et l'identite vient du
// cookie, jamais de l'adresse. Une adresse ne prouve rien, donc un eleve qui
// ouvrirait le devoir d'une autre classe recoit un refus « pas destinataire ».
export default async function AssignedPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  return <AssignedScreen assignmentId={assignmentId} />;
}
