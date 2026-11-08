import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Eye, Trash2, Server, HelpCircle } from "lucide-react";

export const metadata = {
  title: "Protection des Données & nLPD | Village en Fête",
  description: "Politique de confidentialité et protection des données personnelles selon la nouvelle loi suisse sur la protection des données (nLPD).",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F4] text-stone-800 px-4 py-12 md:py-16 selection:bg-amber-200">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à la carte du village</span>
        </Link>

        <header className="mb-10 pb-6 border-b border-stone-200">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Conformité nLPD (Suisse)
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900 font-serif">
            Protection des données personnelles & Vie privée
          </h1>
          <p className="mt-2 text-stone-600 text-sm md:text-base">
            Dernière mise à jour : 8 novembre 2026 · Conforme à la Loi fédérale sur la protection des données (nLPD) et à la législation vaudoise (LPrD).
          </p>
        </header>

        <div className="space-y-8 text-sm md:text-base leading-relaxed text-stone-700">
          {/* Section 1 */}
          <section className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-stone-900">
                1. Responsable du traitement & Finalité
              </h2>
            </div>
            <p>
              L’application <strong>Village en Fête</strong> est une plateforme communautaire et citoyenne d’animation locale (Vufflens-la-Ville). Elle a pour unique finalité l’organisation conviviale et sécurisée des fêtes de village, notamment :
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>La tournée d’Halloween (repérage des maisons distributrices de bonbons).</li>
              <li>Le calendrier des Fenêtres de l’Avent (répartition des 24 fenêtres illuminées et verrées).</li>
            </ul>
            <p className="mt-3 font-semibold text-stone-900">
              Aucune donnée n’est vendue, louée, transmise à des tiers commerciaux ou utilisée à des fins publicitaires.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-800">
                <Eye className="w-5 h-5" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-stone-900">
                2. Données collectées et principe de minimisation
              </h2>
            </div>
            <p>
              Conformément à l’article 6 de la nLPD, nous appliquons un principe strict de minimisation :
            </p>
            <div className="mt-3 space-y-3">
              <div className="border-l-2 border-amber-400 pl-3">
                <strong className="text-stone-900">Adresse email :</strong> Utilisée exclusivement pour l’envoi du lien de connexion sans mot de passe (Magic Link) et des notifications liées à l’événement (confirmation, rappel de veille).
              </div>
              <div className="border-l-2 border-amber-400 pl-3">
                <strong className="text-stone-900">Adresse postale :</strong> Sélectionnée parmi le référentiel officiel communal pour positionner votre foyer sur la carte festive.
              </div>
              <div className="border-l-2 border-amber-400 pl-3">
                <strong className="text-stone-900">Photos et instructions d'accueil :</strong> Strictement facultatives, publiées uniquement sur votre initiative volontaire.
              </div>
              <div className="border-l-2 border-amber-400 pl-3">
                <strong className="text-stone-900">Statistiques d'affluence :</strong> Entièrement anonymisées (aucun cookie de traçage publicitaire, pas de Google Analytics, aucun profilage).
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-stone-900">
                3. Le Sas Villageois : protection de votre vie privée
              </h2>
            </div>
            <p>
              Contrairement à un annuaire public ouvert sur Internet, <strong>Village en Fête</strong> intègre une barrière d’accès communale (le <em>Code Villageois</em>).
            </p>
            <p className="mt-2">
              Ce mécanisme garantit que la carte des maisons participantes et les horaires d’accueil des enfants ne sont pas indexés par les moteurs de recherche (Google, Bing) et restent réservés aux résidents de la commune et à leurs familles.
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-800">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-stone-900">
                4. Vos droits (Accès, Rectification, Suppression)
              </h2>
            </div>
            <p>
              En application des articles 25 à 29 de la nLPD, vous bénéficiez en tout temps des droits suivants :
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Droit d'accès et d'information :</strong> Connaître les informations enregistrées vous concernant.</li>
              <li><strong>Droit de retrait immédiat :</strong> Vous pouvez à tout moment désactiver ou supprimer votre participation depuis votre <strong>Espace Citoyen</strong>. Votre adresse disparaît alors instantanément de la carte.</li>
              <li><strong>Droit à l'effacement :</strong> Demander la suppression totale de votre compte et de vos données sur simple demande auprès de l'équipe communale ou via l'interface.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-800">
                <Server className="w-5 h-5" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-stone-900">
                5. Sécurité technique & Hébergement
              </h2>
            </div>
            <p>
              Les données sont hébergées dans un environnement sécurisé (Suisse / France) conforme aux standards européens et suisses.
            </p>
            <p className="mt-2">
              Les communications sont intégralement chiffrées en HTTPS (TLS), les sessions utilisent des jetons HTTP-Only protégés contre les failles XSS, et la base de données PostgreSQL applique des politiques de sécurité strictes au niveau des lignes (<em>Row Level Security</em>).
            </p>
          </section>

          {/* Section 6 */}
          <section className="bg-stone-100 rounded-2xl p-6 border border-stone-300/80">
            <div className="flex items-center gap-3 mb-2">
              <HelpCircle className="w-5 h-5 text-stone-700" />
              <h2 className="text-lg font-bold text-stone-900">
                6. Contact & Renseignements
              </h2>
            </div>
            <p className="text-sm text-stone-600">
              Pour toute question relative à la protection de vos données ou pour exercer vos droits, vous pouvez contacter les délégués à l'animation communale de Vufflens-la-Ville directement via l'adresse de contact fournie lors de la remise du code communal ou via l'espace municipal.
            </p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-block rounded-xl bg-stone-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 transition"
          >
            J'ai compris, revenir à la carte
          </Link>
        </div>
      </div>
    </main>
  );
}
