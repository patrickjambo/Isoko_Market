/**
 * Localized API error messages (Section 6.6 / 11). Route handlers throw
 * `ApiError` with a plain-English message; the `route()` wrapper runs that
 * message through {@link localizeError} using the request's `NEXT_LOCALE` so the
 * client toast shows it in rw/en/fr. The English text IS the lookup key, so no
 * throw site has to change and any unmapped/dynamic message falls back to
 * English (never breaks). Pure + dependency-free → unit-testable.
 */
type LocalizedError = { rw: string; fr: string };

const ERROR_TRANSLATIONS: Record<string, LocalizedError> = {
  // ── NOT_FOUND ──
  "Admin not found.": { rw: "Umuyobozi ntabonetse.", fr: "Administrateur introuvable." },
  "Application not found.": { rw: "Ubusabe ntibwabonetse.", fr: "Candidature introuvable." },
  "Build your CV first.": { rw: "Banza wubake CV yawe.", fr: "Créez d’abord votre CV." },
  "Conversation not found.": { rw: "Ikiganiro ntikibonetse.", fr: "Conversation introuvable." },
  "Job not found.": { rw: "Akazi ntikabonetse.", fr: "Offre introuvable." },
  "Listing not found.": { rw: "Igicuruzwa ntikibonetse.", fr: "Annonce introuvable." },
  "No CV was submitted.": { rw: "Nta CV yatanzwe.", fr: "Aucun CV n’a été soumis." },
  "Order not found.": { rw: "Ubuguzi ntibwabonetse.", fr: "Commande introuvable." },
  "Partner not found.": { rw: "Umufatanyabikorwa ntabonetse.", fr: "Partenaire introuvable." },
  "Report not found.": { rw: "Raporo ntiyabonetse.", fr: "Signalement introuvable." },
  "Saved search not found.": { rw: "Ishakisha ryabitswe ntiryabonetse.", fr: "Recherche enregistrée introuvable." },
  "User not found.": { rw: "Umukoresha ntabonetse.", fr: "Utilisateur introuvable." },
  "Verification request not found.": { rw: "Ubusabe bwo kwemeza ntibwabonetse.", fr: "Demande de vérification introuvable." },

  // ── CONFLICT ──
  "Already completed.": { rw: "Byararangiye.", fr: "Déjà terminé." },
  "Order already advanced.": { rw: "Ubuguzi bwamaze gutera imbere.", fr: "La commande a déjà avancé." },
  "This item is no longer available.": { rw: "Iki gicuruzwa ntikiboneka.", fr: "Cet article n’est plus disponible." },
  "This job is closed.": { rw: "Aka kazi karafunze.", fr: "Cette offre est fermée." },
  "This order cannot be disputed.": { rw: "Ubu buguzi ntibushobora kujuririrwa.", fr: "Cette commande ne peut pas être contestée." },
  "Too late to cancel.": { rw: "Byatinze kugira ngo bihagarikwe.", fr: "Trop tard pour annuler." },
  "You already applied to this job.": { rw: "Wamaze gusaba aka kazi.", fr: "Vous avez déjà postulé à cette offre." },
  "You already reviewed this order.": { rw: "Wamaze gutanga isuzuma kuri ubu buguzi.", fr: "Vous avez déjà évalué cette commande." },
  "You can review after completing the order.": { rw: "Ushobora gutanga isuzuma nyuma yo kurangiza ubuguzi.", fr: "Vous pourrez évaluer après avoir terminé la commande." },
  "You have reached the saved-search limit.": { rw: "Wageze ku mubare ntarengwa w’amashakisha yabitswe.", fr: "Vous avez atteint la limite de recherches enregistrées." },

  // ── FORBIDDEN ──
  "Admin access required.": { rw: "Bisaba uburenganzira bw’umuyobozi.", fr: "Accès administrateur requis." },
  "Admins cannot be suspended or banned here.": { rw: "Abayobozi ntibashobora guhagarikwa cyangwa kwirukanwa hano.", fr: "Les administrateurs ne peuvent pas être suspendus ou bannis ici." },
  "Not your conversation.": { rw: "Si ikiganiro cyawe.", fr: "Ce n’est pas votre conversation." },
  "Please verify your account to do that.": { rw: "Emeza konti yawe kugira ngo ubikore.", fr: "Vérifiez votre compte pour faire cela." },
  "This conversation is not under an active report.": { rw: "Iki kiganiro nticyari muri raporo ikora.", fr: "Cette conversation ne fait pas l’objet d’un signalement actif." },
  "You are not part of this conversation.": { rw: "Ntabwo uri mu kiganiro.", fr: "Vous ne faites pas partie de cette conversation." },
  "You are not allowed to do that.": { rw: "Nta burenganzira ufite bwo kubikora.", fr: "Vous n’êtes pas autorisé à faire cela." },
  "You don't have permission to do that.": { rw: "Nta ruhushya ufite rwo kubikora.", fr: "Vous n’avez pas la permission de faire cela." },

  // ── BAD_REQUEST ──
  "Add at least one filter before saving this search.": { rw: "Ongeraho nibura akayunguruzo kamwe mbere yo kubika iri shakisha.", fr: "Ajoutez au moins un filtre avant d’enregistrer cette recherche." },
  "A reason is required for this action.": { rw: "Impamvu irakenewe kuri iki gikorwa.", fr: "Une raison est requise pour cette action." },
  "At least one Super Admin is required.": { rw: "Nibura Umuyobozi Mukuru umwe arakenewe.", fr: "Au moins un Super Admin est requis." },
  "Create your CV before applying.": { rw: "Kora CV yawe mbere yo gusaba.", fr: "Créez votre CV avant de postuler." },
  "Enter the institution name.": { rw: "Andika izina ry’ikigo.", fr: "Saisissez le nom de l’établissement." },
  "Invalid division level.": { rw: "Urwego rw’akarere ntirwemewe.", fr: "Niveau de division invalide." },
  "Invalid institution type.": { rw: "Ubwoko bw’ikigo ntibwemewe.", fr: "Type d’établissement invalide." },
  "No file provided.": { rw: "Nta dosiye yatanzwe.", fr: "Aucun fichier fourni." },
  "No recipient for this conversation.": { rw: "Nta uwakira iki kiganiro.", fr: "Aucun destinataire pour cette conversation." },
  "Payment failed. Please try again.": { rw: "Kwishyura byanze. Ongera ugerageze.", fr: "Le paiement a échoué. Réessayez." },
  "That code is incorrect or has expired.": { rw: "Iyo kode ntiyo cyangwa yararengeje igihe.", fr: "Ce code est incorrect ou a expiré." },
  "Upload failed.": { rw: "Kohereza byanze.", fr: "Le téléversement a échoué." },
  "You cannot apply to your own job.": { rw: "Ntushobora gusaba akazi kawe bwite.", fr: "Vous ne pouvez pas postuler à votre propre offre." },
  "You cannot buy your own listing.": { rw: "Ntushobora kugura igicuruzwa cyawe bwite.", fr: "Vous ne pouvez pas acheter votre propre annonce." },
  "You cannot message yourself.": { rw: "Ntushobora kwiyandikira.", fr: "Vous ne pouvez pas vous envoyer un message." },
  "You cannot perform this action on your own account.": { rw: "Ntushobora gukora iki gikorwa kuri konti yawe bwite.", fr: "Vous ne pouvez pas effectuer cette action sur votre propre compte." },

  // ── RATE_LIMITED ──
  "Slow down.": { rw: "Gabanya umuvuduko.", fr: "Ralentissez." },
  "Too many attempts. Please wait a few minutes.": { rw: "Wagerageje kenshi cyane. Tegereza iminota mike.", fr: "Trop de tentatives. Patientez quelques minutes." },
  "Too many attempts. Request a new code.": { rw: "Wagerageje kenshi cyane. Saba kode nshya.", fr: "Trop de tentatives. Demandez un nouveau code." },
  "Too many reports. Try again later.": { rw: "Raporo nyinshi cyane. Ongera ugerageze nyuma.", fr: "Trop de signalements. Réessayez plus tard." },
  "Too many uploads. Try again later.": { rw: "Wohereje dosiye nyinshi cyane. Ongera ugerageze nyuma.", fr: "Trop de téléversements. Réessayez plus tard." },

  // ── UNAUTHORIZED ──
  "Please log in to continue.": { rw: "Injira kugira ngo ukomeze.", fr: "Connectez-vous pour continuer." },

  // ── form validation (Zod field messages) ──
  "Add a job title.": { rw: "Andika umutwe w’akazi.", fr: "Ajoutez un intitulé de poste." },
  "Add a location.": { rw: "Andika aho biherereye.", fr: "Ajoutez un lieu." },
  "Add a partner name.": { rw: "Andika izina ry’umufatanyabikorwa.", fr: "Ajoutez un nom de partenaire." },
  "Add a short, clear title.": { rw: "Andika umutwe mugufi kandi usobanutse.", fr: "Ajoutez un titre court et clair." },
  "Describe the item.": { rw: "Sobanura igicuruzwa.", fr: "Décrivez l’article." },
  "Describe the role.": { rw: "Sobanura akazi.", fr: "Décrivez le poste." },
  "Enter a valid price.": { rw: "Andika igiciro cyemewe.", fr: "Saisissez un prix valide." },
  "Enter a valid Rwandan phone number.": { rw: "Andika nimero ya telefoni y’u Rwanda yemewe.", fr: "Saisissez un numéro de téléphone rwandais valide." },
  "Enter the 6-digit code.": { rw: "Andika kode y’imibare 6.", fr: "Saisissez le code à 6 chiffres." },
  "Maximum pay must be at least the minimum.": { rw: "Umushahara ntarengwa ugomba kuba nibura ungana n’uto.", fr: "Le salaire maximum doit être au moins égal au minimum." },
  "Upload your ID first.": { rw: "Banza wohereze indangamuntu yawe.", fr: "Téléversez d’abord votre pièce d’identité." },
  "Use a hex colour like #0F766E.": { rw: "Koresha ibara rya hex nka #0F766E.", fr: "Utilisez une couleur hexadécimale comme #0F766E." },
  "Write a message.": { rw: "Andika ubutumwa.", fr: "Écrivez un message." },

  // ── generic wrapper messages (VALIDATION / INTERNAL) ──
  "Please check the highlighted fields.": { rw: "Reba ibisabwa byagaragajwe.", fr: "Veuillez vérifier les champs indiqués." },
  "Something went wrong. Please try again.": { rw: "Habaye ikibazo. Ongera ugerageze.", fr: "Une erreur s’est produite. Réessayez." },
};

// Dynamic permission-denied messages carry the permission key, e.g.
// "Missing permission: analytics.export" — translate the prefix, keep the key.
const MISSING_PERMISSION = "Missing permission: ";

/** Translate a known API error message into `locale`; unknown/dynamic messages
 *  and `en` pass through unchanged (English is the source of truth). */
export function localizeError(message: string, locale: string): string {
  if (locale === "en") return message;
  if (locale !== "rw" && locale !== "fr") return message; // unknown locale → source
  if (message.startsWith(MISSING_PERMISSION)) {
    const perm = message.slice(MISSING_PERMISSION.length);
    return locale === "fr" ? `Autorisation manquante : ${perm}` : `Nta ruhushya: ${perm}`;
  }
  const entry = ERROR_TRANSLATIONS[message];
  if (!entry) return message;
  return entry[locale];
}
