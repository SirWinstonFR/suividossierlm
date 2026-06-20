const CFG = {
  SHEET_ID:    '1zbnly7aZ8AzZlJDsQA5I3hiKAbD2zlpXedvyNcdtsAQ',
  API_KEY:     'AIzaSyCyvTQg8tzasPEvi2-fDtNkO2n6KEcDL-8',
  SHEET_NAME:  'Feuille 1',
  ADMIN_PWD:   'leroy2025',
  SCRIPT_URL:  'https://script.google.com/macros/s/AKfycbzVyE-VoVVtr9iuw3tsW38Iw-lbT_YGlneYlQpRznG9p-PjIfOAWWvNoMhF7FdhUe-Fcg/exec',
  BASE_PATH:   '/suividossierlm',
};

const STEPS = [
  { l:'Démarche lancée',      i:'ti-rocket',        desc:'Votre projet a été enregistré.' },
  { l:'RDV planifié',         i:'ti-calendar',      desc:'Un conseiller va vous contacter.' },
  { l:'Retour technicien',    i:'ti-ruler-2',       desc:'Visite technique effectuée.' },
  { l:'Devis envoyé',         i:'ti-file-text',     desc:'Votre devis est disponible ci-dessous.' },
  { l:'Commande signée',      i:'ti-signature',     desc:'Signez votre bon de commande pour valider votre projet.' },
  { l:'Commande confirmée',   i:'ti-circle-check',  desc:'Votre commande est confirmée et en cours de traitement.' },
  { l:'Livraison',            i:'ti-truck-delivery',desc:'Vos matériaux sont en cours de livraison.' },
  { l:'Pose effectuée',       i:'ti-home-check',    desc:'Votre projet est terminé, merci de votre confiance !' },
];

const DOCS = [
  { key:'predevis_url', l:'Pré-devis', i:'ti-file-description', minStep:1 },
  { key:'devis_url',    l:'Devis',      i:'ti-file-text',        minStep:4 },
  { key:'sig_commande', l:'Commande signée', i:'ti-signature',  minStep:5 },
];
