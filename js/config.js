const CFG = {
  SHEET_ID:    '1zbnly7aZ8AzZlJDsQA5I3hiKAbD2zlpXedvyNcdtsAQ',
  API_KEY:     'AIzaSyCyvTQg8tzasPEvi2-fDtNkO2n6KEcDL-8',
  SHEET_NAME:  'Feuille 1',
  ADMIN_PWD:   'leroy2025',
  SCRIPT_URL:  'https://script.google.com/macros/s/AKfycbzVyE-VoVVtr9iuw3tsW38Iw-lbT_YGlneYlQpRznG9p-PjIfOAWWvNoMhF7FdhUe-Fcg/exec',
  BASE_PATH:   '/suividossierlm',
};

const STEPS = [
  { l:'Démarche lancée',      ic:'rocket',     desc:'Votre projet a été enregistré.' },
  { l:'RDV planifié',         ic:'calendar',   desc:'Un conseiller va vous contacter.' },
  { l:'Retour technicien',    ic:'ruler',      desc:'Visite technique effectuée.' },
  { l:'Devis envoyé',         ic:'filetext',   desc:'Votre devis est disponible ci-dessous.' },
  { l:'Commande signée',      ic:'signature',  desc:'Signez votre bon de commande pour valider votre projet.' },
  { l:'Commande confirmée',   ic:'check',      desc:'Votre commande est confirmée et en cours de traitement.' },
  { l:'Livraison',            ic:'truck',      desc:'Vos matériaux sont en cours de livraison.' },
  { l:'Pose effectuée',       ic:'home',       desc:'Votre projet est terminé, merci de votre confiance !' },
];

const DOCS = [
  { key:'predevis_url', l:'Pré-devis', ic:'filetext', minStep:1 },
  { key:'devis_url',    l:'Devis',      ic:'filetext', minStep:4 },
  { key:'commande_signee_url', l:'Commande signée', ic:'signature', minStep:5 },
];
