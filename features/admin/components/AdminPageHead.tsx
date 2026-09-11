import { adminEntry } from "@/features/admin/components/admin-nav";

// Le titre d'une page de l'administration, et la question a laquelle elle repond.
//
// LA QUESTION VIENT DE LA CARTE, pas du fichier de la page : c'est la meme phrase
// qui decrit l'entree dans la barre et la page elle meme, donc elles ne peuvent
// pas diverger.
export default function AdminPageHead({ href }: { href: string }) {
  const entry = adminEntry(href);
  return (
    <header className="ad-head">
      <h1 className="ad-head__title">{entry.label}</h1>
      <p className="ad-head__question">{entry.question}</p>
    </header>
  );
}
