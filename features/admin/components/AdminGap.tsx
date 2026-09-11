// CE QUI MANQUE, DIT EN PHRASES, ET JAMAIS UN PANNEAU VIDE.
//
// Une entree de la barre existe des que le sujet existe, meme quand la donnee
// n'est pas encore la : c'est ce qui evite de refaire la navigation plus tard.
// Mais une page sans donnee ne montre ni graphique grise, ni chiffre invente, ni
// « lorem ». Elle dit deux choses : ce qui manque, et ce qui la remplira. Une
// maquette de donnee absente se construit deux fois, une fois maintenant et une
// fois quand la vraie donnee arrive avec une autre forme.
export default function AdminGap({
  missing,
  fills,
}: {
  /** Ce qui n'existe pas encore, en une phrase. */
  missing: string;
  /** Ce qui remplira cette page, et dans quel ordre. */
  fills: string[];
}) {
  return (
    <section className="ad-gap" aria-label="Pas encore de données">
      <p className="ad-gap__missing">{missing}</p>
      <ul className="ad-gap__fills">
        {fills.map((fill) => (
          <li key={fill}>{fill}</li>
        ))}
      </ul>
    </section>
  );
}
